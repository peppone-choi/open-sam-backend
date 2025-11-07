import { Router } from 'express';
import { User } from '../models/user.model';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

const router = Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: 회원가입
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: player1
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       200:
 *         description: 회원가입 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 userId:
 *                   type: string
 *       400:
 *         description: 이미 존재하는 사용자
 *       500:
 *         description: 서버 에러
 */
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // 중복 체크
    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(400).json({ error: '이미 존재하는 사용자입니다' });
    }
    
    // 비밀번호 해시
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 사용자 생성
    const user = await User.create({
      username,
      password: hashedPassword
    });
    
    res.json({ 
      message: '회원가입 성공',
      userId: user._id
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: player1
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       200:
 *         description: 로그인 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 token:
 *                   type: string
 *                 userId:
 *                   type: string
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 에러
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // 입력값 검증
    if (!username || !password) {
      return res.status(400).json({ error: '사용자명과 비밀번호를 입력해주세요' });
    }
    
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: '사용자를 찾을 수 없습니다' });
    }
    
    // 비밀번호 확인
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: '비밀번호가 틀렸습니다' });
    }
    
    // JWT 생성 (grade 포함)
    const token = jwt.sign(
      { 
        userId: user._id, 
        username: user.username,
        grade: user.grade || 1
      },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );
    
    // httpOnly 쿠키 설정 (PHP 세션 방식과 유사)
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('authToken', token, {
      httpOnly: true,
      path: '/',
      sameSite: process.env.COOKIE_SAMESITE as any || 'lax',
      secure: isProd || process.env.COOKIE_SECURE === 'true',
      domain: process.env.COOKIE_DOMAIN || undefined,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
    });
    
    res.json({ 
      message: '로그인 성공',
      token,
      userId: user._id,
      grade: user.grade || 1
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message || '서버 오류가 발생했습니다' });
  }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: 내 정보 조회
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 사용자 정보
 *       401:
 *         description: 인증 필요
 */
router.get('/me', async (req, res) => {
  try {
    // JWT 토큰에서 사용자 정보 추출
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '인증 토큰이 없습니다' });
    }

    const token = authHeader.substring(7);
    const secret = process.env.JWT_SECRET || 'secret';
    const decoded = jwt.verify(token, secret) as unknown as { userId: string; username: string; grade?: number };
    
    // 사용자 정보 조회
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다' });
    }
    
    res.json({ 
      userId: user._id,
      username: user.username,
      name: user.name,
      grade: user.grade || 1,
      game_mode: user.game_mode
    });
  } catch (error: any) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: '유효하지 않은 토큰입니다' });
    }
    res.status(500).json({ error: error.message });
  }
});

export default router;
