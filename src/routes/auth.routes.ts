// @ts-nocheck - Type issues need investigation
import { Router } from 'express';
import { User, BannedEmail, KVStorage } from '../models';
import { OAuthService } from '../services/oauth.service';
import { EmailService } from '../services/email.service';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { authLimiter } from '../middleware/rate-limit.middleware';
import { validate, authRegisterSchema, authLoginSchema, preventMongoInjection } from '../middleware/validation.middleware';
import { configManager } from '../config/ConfigManager';
import { logger } from '../common/logger';

const router = Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: 회원가입
 *     tags: [Auth]
 */
router.post('/register', authLimiter, preventMongoInjection('body'), validate(authRegisterSchema), async (req, res) => {
  try {
    const { username, email, name, password } = req.body;

    const banned = await BannedEmail.findOne({ email: email.toLowerCase() });
    if (banned) {
      return res.status(403).json({ error: '가입이 제한된 이메일입니다.' });
    }

    const existingUser = await User.findOne({
      $or: [
        { username: new RegExp(`^${username}$`, 'i') },
        { email: new RegExp(`^${email}$`, 'i') },
        { name },
      ],
    }).select('username email name');

    if (existingUser) {
      if (existingUser.username.toLowerCase() === username.toLowerCase()) {
        return res.status(400).json({ error: '이미 존재하는 사용자 아이디입니다' });
      }
      if (existingUser.email.toLowerCase() === email.toLowerCase()) {
        return res.status(400).json({ error: '이미 존재하는 이메일입니다' });
      }
      if (existingUser.name === name) {
        return res.status(400).json({ error: '이미 존재하는 닉네임입니다' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      email,
      name,
      password: hashedPassword,
    });

    res.json({
      message: '회원가입 성공',
      userId: user._id,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: 로그인
 *     tags: [Auth]
 */
router.post('/login', authLimiter, preventMongoInjection('body'), validate(authLoginSchema), async (req, res) => {
  try {
    const { username, password, otp } = req.body;

    const user = await User.findOne({ username }).select('+password');
    if (!user) {
      return res.status(401).json({ error: '사용자를 찾을 수 없습니다' });
    }

    let valid = false;
    if (user.password.startsWith('$2')) {
      valid = await bcrypt.compare(password, user.password);
    } else {
      // Legacy SHA-512 Support
      const { configManager } = await import('../config/ConfigManager');
      const { hiddenSeed } = configManager.get().system;
      const { Util } = await import('../utils/Util');
      
      // PHP Legacy: hash('sha512', $newSalt . hash('sha512', $globalSalt . $newPassword . $globalSalt) . $newSalt)
      // user.global_salt stores the per-user salt
      const globalSalt = hiddenSeed;
      const userSalt = user.global_salt || '';
      
      // 프론트엔드에서 넘어온 비밀번호는 평문(Plaintext)이라고 가정 (이미 SHA-512 처리되어 넘어온게 아님)
      // 1단계: 글로벌 솔트로 해싱
      const tmpPassword = Util.hashPassword(globalSalt, password);
      // 2단계: 유저별 솔트로 해싱
      const legacyHash = Util.hashPassword(userSalt, tmpPassword);
      
      valid = (legacyHash === user.password);
      
      // 만약 실패했다면, 프론트엔드에서 이미 한 번 해싱해서 보냈을 가능성도 체크 (레거시 호환)
      if (!valid && password.length === 128) { // SHA-512 결과물은 128자
          const legacyHash2 = Util.hashPassword(userSalt, password);
          valid = (legacyHash2 === user.password);
      }
      
      if (valid) {
        // Auto-upgrade to bcrypt
        user.password = await bcrypt.hash(password, 10);
        await user.save();
        logger.info(`User ${user.username} password upgraded to bcrypt`);
      }
    }

    if (!valid) {
      return res.status(401).json({ error: '비밀번호가 틀렸습니다' });
    }

    if (user.delete_after && new Date() < new Date(user.delete_after)) {
      return res.status(403).json({ 
        error: '삭제 대기 중인 계정입니다.',
        delete_after: user.delete_after 
      });
    }

    if (!otp) {
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const validUntil = new Date(Date.now() + 3 * 60 * 1000);
      
      await KVStorage.findOneAndUpdate(
        { session_id: 'system', storage_id: `auth_otp_${user.username}` },
        { 
          $set: { 
            value: { code: otpCode, attempts: 0 },
            data: { validUntil }
          }
        },
        { upsert: true }
      );

      const emailSent = await EmailService.sendOtp(user.email, otpCode);
      
      if (user.oauth_type === 'kakao' && user.oauth_refresh_token) {
        try {
          const refreshResult = await OAuthService.refreshKakaoToken(user.oauth_refresh_token);
          if (refreshResult.success && refreshResult.accessToken) {
             user.oauth_access_token = refreshResult.accessToken;
             if (refreshResult.refreshToken) user.oauth_refresh_token = refreshResult.refreshToken;
             await user.save();

             const msgResult = await OAuthService.sendKakaoMessage(
               refreshResult.accessToken, 
               `[OpenSAM] 로그인 인증 코드: ${otpCode}\n\n3분 내에 입력해주세요.`
             );
             if (!msgResult.success) logger.error('Failed to send Kakao OTP:', msgResult.message);
           }
        } catch (kErr) {
          logger.error('Kakao OTP error:', kErr);
        }
      }

      return res.json({
        result: true,
        reqOTP: true,
        message: emailSent 
          ? `인증 코드가 이메일(${user.email})로 발송되었습니다.` 
          : '인증 코드 발송에 실패했습니다. 관리자에게 문의하세요.'
      });
    }

    const storedOtp = await KVStorage.findOne({ 
      session_id: 'system', 
      storage_id: `auth_otp_${user.username}` 
    });

    if (!storedOtp || !storedOtp.data?.validUntil || new Date(storedOtp.data.validUntil) < new Date()) {
       return res.status(400).json({ error: '인증 코드가 만료되었거나 존재하지 않습니다. 다시 로그인해주세요.' });
    }

    if (storedOtp.value.code !== otp) {
      logger.warn(`OTP verification failed for ${user.username}: expected ${storedOtp.value.code}, got ${otp}`);
      return res.status(400).json({ error: '인증 코드가 올바르지 않습니다.' });
    }

    await KVStorage.deleteOne({ _id: storedOtp._id });

    const { jwtSecret, cookieSecure, cookieSameSite, nodeEnv } = configManager.get().system;
    if (!jwtSecret) return res.status(500).json({ error: 'JWT_SECRET is not configured' });

    const token = jwt.sign(
      { userId: user._id, username: user.username, grade: user.grade || 1 },
      jwtSecret,
      { expiresIn: '7d' }
    );

    // httpOnly 쿠키 설정
    const isProd = nodeEnv === 'production';
    const cookieOptions = {
      httpOnly: true,
      path: '/',
      sameSite: (cookieSameSite as any) || 'lax',
      secure: isProd || cookieSecure,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };

    res.cookie('authToken', token, cookieOptions);
    res.cookie('token', token, cookieOptions); // 레거시 호환성용

    res.json({
      result: true, // result: true 추가
      message: '로그인 성공',
      token,
      userId: user._id,
      grade: user.grade || 1
    });
  } catch (error: any) {
    logger.error('Login error:', error);
    res.status(500).json({ error: error.message || '서버 오류가 발생했습니다' });
  }
});

/**
 * @swagger
 * /api/auth/me:
 */
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '인증 토큰이 없습니다' });
    }

    const token = authHeader.substring(7);
    const { jwtSecret } = configManager.get().system;
    const decoded = jwt.verify(token, jwtSecret) as unknown as { userId: string; username: string; grade?: number };
    
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다' });
    
    res.json({ 
      userId: user._id,
      username: user.username,
      name: user.name,
      grade: user.grade || 1,
      game_mode: user.game_mode
    });
  } catch (error) {
    res.status(401).json({ error: '유효하지 않은 토큰입니다' });
  }
});

/**
 * @swagger
 * /api/auth/grade:
 */
router.get('/grade', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '인증 토큰이 없습니다' });
    }

    const token = authHeader.substring(7);
    const { jwtSecret } = configManager.get().system;
    const decoded = jwt.verify(token, jwtSecret) as unknown as { userId: string };
    
    const user = await User.findById(decoded.userId).select('grade');
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다' });

    res.json({ grade: user.grade || 1 });
  } catch (error) {
    res.status(401).json({ error: '유효하지 않은 토큰입니다' });
  }
});

/**
 * @swagger
 * /api/auth/delete-account:
 */
router.post('/delete-account', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '인증 토큰이 없습니다' });
    }

    const token = authHeader.substring(7);
    const { jwtSecret } = configManager.get().system;
    const decoded = jwt.verify(token, jwtSecret) as unknown as { userId: string };

    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다' });

    const deleteDate = new Date();
    deleteDate.setDate(deleteDate.getDate() + 7);
    
    user.delete_after = deleteDate;
    await user.save();

    res.json({ 
      message: '계정 삭제가 요청되었습니다. 7일 후 완전히 삭제됩니다.',
      delete_after: deleteDate
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: 비밀번호 초기화 요청 (이메일 OTP)
 */
router.post('/forgot-password', authLimiter, preventMongoInjection('body'), async (req, res) => {
  try {
    const { username, email } = req.body;
    
    const user = await User.findOne({ 
      username: username.toLowerCase(),
      email: email.toLowerCase()
    });

    if (!user) {
      // 보안상 사용자가 없어도 성공 메시지를 보낼 수 있지만, 여기서는 명확하게 처리
      return res.status(404).json({ error: '일치하는 사용자 정보를 찾을 수 없습니다' });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const validUntil = new Date(Date.now() + 10 * 60 * 1000); // 10분 유효

    await KVStorage.findOneAndUpdate(
      { session_id: 'system', storage_id: `pw_reset_otp_${user.username}` },
      { 
        $set: { 
          value: { code: otpCode },
          data: { validUntil }
        }
      },
      { upsert: true }
    );

    const emailSent = await EmailService.sendOtp(user.email, otpCode);
    if (!emailSent) {
      return res.status(500).json({ error: '이메일 발송에 실패했습니다' });
    }

    res.json({ 
      result: true,
      message: '인증 코드가 이메일로 발송되었습니다'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: 인증 코드로 비밀번호 초기화
 */
router.post('/reset-password', authLimiter, preventMongoInjection('body'), async (req, res) => {
  try {
    const { username, otp, newPassword } = req.body;

    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다' });

    const storedOtp = await KVStorage.findOne({ 
      session_id: 'system', 
      storage_id: `pw_reset_otp_${user.username}` 
    });

    if (!storedOtp || !storedOtp.data?.validUntil || new Date(storedOtp.data.validUntil) < new Date()) {
       return res.status(400).json({ error: '인증 코드가 만료되었거나 존재하지 않습니다' });
    }

    if (storedOtp.value.code !== otp) {
      return res.status(400).json({ error: '인증 코드가 올바르지 않습니다' });
    }

    // 비밀번호 업데이트
    user.password = await bcrypt.hash(newPassword, 10);
    user.token_valid_until = new Date();
    await user.save();

    // OTP 삭제
    await KVStorage.deleteOne({ _id: storedOtp._id });

    res.json({ 
      result: true,
      message: '비밀번호가 초기화되었습니다. 새로운 비밀번호로 로그인해주세요.' 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
