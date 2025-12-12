import { Router } from 'express';
import authorityRoutes from './authority.routes';
import operationsRoutes from './operations.routes';
import stateRoutes from './state.routes';
import adminRoutes from './admin.routes';
import characterRoutes from './character.routes';
import mapRoutes from './map.routes';
import intelRoutes from './intel.routes';
import logisticsRoutes from './logistics.routes';
import marketRoutes from './market.routes';
import tacticalRoutes from './tactical.routes';
import facilityRoutes from './facility.routes';
import groundRoutes from './ground.routes';
import politicsRoutes from './politics.routes';
import npcRoutes from './npc.routes';
import scenarioRoutes from './scenario.routes';
import bureaucracyRoutes from './bureaucracy.routes';
import fighterRoutes from './fighter.routes';
import commandDelayRoutes from './command-delay.routes';
import fezzanRoutes from './fezzan.routes';
import socialRoutes from './social.routes';
import battleRoutes from './battle.routes';

const router = Router();

router.use('/', stateRoutes);
router.use('/authority', authorityRoutes);
router.use('/operations', operationsRoutes);
router.use('/admin', adminRoutes);
router.use('/character', characterRoutes);
router.use('/map', mapRoutes);
router.use('/intel', intelRoutes);
router.use('/', logisticsRoutes);  // gin7-logistics: warehouse, fleet, production
router.use('/market', marketRoutes);  // gin7-economy-trade: market, trade routes
router.use('/tactical', tacticalRoutes);  // gin7-tactical-engine: RTS combat
router.use('/facility', facilityRoutes);  // gin7-facility-build: facility construction, upgrade, repair
router.use('/ground', groundRoutes);  // gin7-ground-combat: ground battle, drop, withdraw, orbital strike
router.use('/politics', politicsRoutes);  // gin7-politics: budget, support, government
router.use('/npc', npcRoutes);  // gin7-npc-ai: NPC faction AI, presets, controller
router.use('/', scenarioRoutes);  // gin7-scenario-script: scenario, events, campaigns
router.use('/bureaucracy', bureaucracyRoutes);  // gin7-bureaucracy: operation approval, merit calculation
router.use('/fighter', fighterRoutes);  // gin7-fighter-wing: fighter launch/recover, dogfight, anti-ship
router.use('/command-delay', commandDelayRoutes);  // gin7-command-delay: command queue, delay, electronic warfare
router.use('/fezzan', fezzanRoutes);  // gin7-fezzan-diplomacy: pass permits, info broker, financial services
router.use('/social', socialRoutes);  // gin7-social-interaction: relationships, factions, private funds
router.use('/battle', battleRoutes);  // gin7-mmo-battle: MMO-Battle integration, realtime combat

export default router;
