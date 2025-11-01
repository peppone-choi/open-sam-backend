import { Router } from 'express';
import { GetMapTemplateService } from '../services/battlemap/GetMapTemplate.service';
import { CreateMapTemplateService } from '../services/battlemap/CreateMapTemplate.service';
import { UpdateMapTemplateService } from '../services/battlemap/UpdateMapTemplate.service';
import { DeleteMapTemplateService } from '../services/battlemap/DeleteMapTemplate.service';
import { GenerateDefaultMapsService } from '../services/battlemap/GenerateDefaultMaps.service';

const router = Router();

/**
 * @swagger
 * /api/battlemap/templates:
 *   get:
 *     summary: 전투 맵 템플릿 목록 조회
 *     tags: [Battlemap]
 *     parameters:
 *       - in: query
 *         name: session_id
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 성공
 */
router.get('/templates', async (req, res) => {
  try {
    const session_id = req.query.session_id as string;
    const result = await GetMapTemplateService.execute({ session_id });
    
    if (!result.success) {
      return res.status(404).json(result);
    }
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/battlemap/templates/{cityId}:
 *   get:
 *     summary: 특정 도시의 전투 맵 템플릿 조회
 *     tags: [Battlemap]
 *     parameters:
 *       - in: path
 *         name: cityId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: session_id
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 성공
 */
router.get('/templates/:cityId', async (req, res) => {
  try {
    const session_id = req.query.session_id as string;
    const city_id = parseInt(req.params.cityId);
    
    const result = await GetMapTemplateService.execute({ session_id, city_id });
    
    if (!result.success) {
      return res.status(404).json(result);
    }
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/battlemap/templates:
 *   post:
 *     summary: 새 전투 맵 템플릿 생성
 *     tags: [Battlemap]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: 생성 성공
 */
router.post('/templates', async (req, res) => {
  try {
    const result = await CreateMapTemplateService.execute(req.body);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/battlemap/templates/{id}:
 *   put:
 *     summary: 전투 맵 템플릿 수정
 *     tags: [Battlemap]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: 성공
 */
router.put('/templates/:id', async (req, res) => {
  try {
    const result = await UpdateMapTemplateService.execute({
      id: req.params.id,
      ...req.body
    });
    
    if (!result.success) {
      return res.status(404).json(result);
    }
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/battlemap/templates/{id}:
 *   delete:
 *     summary: 전투 맵 템플릿 삭제
 *     tags: [Battlemap]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 성공
 */
router.delete('/templates/:id', async (req, res) => {
  try {
    const result = await DeleteMapTemplateService.execute({ id: req.params.id });
    
    if (!result.success) {
      return res.status(404).json(result);
    }
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/battlemap/generate-default:
 *   post:
 *     summary: 기본 전투 맵 생성
 *     tags: [Battlemap]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               session_id:
 *                 type: string
 *     responses:
 *       201:
 *         description: 생성 성공
 */
router.post('/generate-default', async (req, res) => {
  try {
    const session_id = req.body.session_id;
    const result = await GenerateDefaultMapsService.execute({ session_id });
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
