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
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: 회원가입 성공
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
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: 로그인 성공
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: '사용자를 찾을 수 없습니다' });
    }
    
    // 비밀번호 확인
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: '비밀번호가 틀렸습니다' });
    }
    
    // JWT 생성
    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );
    
    res.json({ 
      message: '로그인 성공',
      token,
      userId: user._id
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
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
 *         description: 성공
 */
router.get('/me', async (_req, res) => {
  try {
    // TODO: JWT 미들웨어 추가 후 구현
    res.json({ message: '사용자 정보' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
