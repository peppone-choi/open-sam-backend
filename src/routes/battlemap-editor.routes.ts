import { Router } from 'express';
import { GetMapTemplateService } from '../services/battlemap/GetMapTemplate.service';
import { CreateMapTemplateService } from '../services/battlemap/CreateMapTemplate.service';
import { UpdateMapTemplateService } from '../services/battlemap/UpdateMapTemplate.service';
import { DeleteMapTemplateService } from '../services/battlemap/DeleteMapTemplate.service';
import { GenerateDefaultMapsService } from '../services/battlemap/GenerateDefaultMaps.service';

const router = Router();

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
