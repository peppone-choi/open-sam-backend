import { GlobalRepository } from '../../repositories/global.repository';
import { Session } from '../../models/session.model';
import * as fs from 'fs';
import * as path from 'path';

/**
 * GetConst Service
 * Returns all game constants to frontend
 * Loads: gameConst, gameUnitConst, cityConst, iActionInfo, version
 */
export class GetConstService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    
    try {
      // Load session
      const session = await Session.findOne({ session_id: sessionId });
      if (!session) {
        return {
          success: false,
          message: 'Session not found'
        };
      }

      // Load configuration files
      const configDir = path.join(__dirname, '../../../config');
      
      // Load game constants
      const constantsPath = path.join(configDir, 'constants.json');
      const constantsData = JSON.parse(fs.readFileSync(constantsPath, 'utf-8'));
      const gameConst = constantsData.game_constants || {};

      // Load units
      const unitsPath = path.join(configDir, 'units.json');
      const unitsData = JSON.parse(fs.readFileSync(unitsPath, 'utf-8'));
      const gameUnitConst = unitsData.unit_types || {};

      // Load cities
      const citiesPath = path.join(configDir, 'cities.json');
      const citiesData = JSON.parse(fs.readFileSync(citiesPath, 'utf-8'));
      const cityConst = citiesData.cities || {};

      // Load action info
      const actionsPath = path.join(configDir, 'actions.json');
      const actionsData = JSON.parse(fs.readFileSync(actionsPath, 'utf-8'));
      const iActionInfo = actionsData.items || {};

      // Get version from package.json
      const packagePath = path.join(__dirname, '../../../package.json');
      const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
      const version = packageData.version || '1.0.0';

      return {
        success: true,
        result: {
          gameConst,
          gameUnitConst,
          cityConst,
          iActionInfo,
          version
        }
      };
    } catch (error: any) {
      console.error('GetConst error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}
