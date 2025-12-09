import { GalaxyTacticalBattle, IGalaxyTacticalBattle, ITacticalUnit } from '../../models/logh/GalaxyTacticalBattle.model';
import { GalaxySession } from '../../models/logh/GalaxySession.model';
import { getRankIndex } from '../../utils/logh-rank-system';

export class GalaxyTacticalBattleService {
  
  // 전투 초기화 (메뉴얼 2112행 발생 조건)
  static async initBattle(sessionId: string, gridId: string, initialUnits: any[]): Promise<IGalaxyTacticalBattle> {
    // 기존 전투 확인
    const existing = await GalaxyTacticalBattle.findOne({ session_id: sessionId, gridId, status: 'active' });
    if (existing) return existing;

    const battleId = `battle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 유닛 초기화 및 지휘권 할당 (메뉴얼 2173행)
    const units: ITacticalUnit[] = initialUnits.map(u => ({
      unitId: u.id,
      name: u.name,
      type: u.type || 'ship_unit',
      subtype: u.subtype,
      faction: u.faction,
      position: u.position || { x: Math.random() * 10000, y: Math.random() * 10000, z: 0, heading: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      status: 'active',
      mode: 'nav',
      stats: {
        durability: u.durability || 100,
        maxDurability: u.maxDurability || 100,
        shipCount: u.shipCount || 300,
        crew: u.crew || 100,
        morale: u.morale || 100,
        supplies: u.supplies || 100
      },
      energyDistribution: { beam: 20, gun: 20, shield: 20, engine: 20, warp: 0, sensor: 20 },
      commandRange: { currentRadius: 0, maxRadius: 1000, expansionRate: 10 },
      // 지휘관 ID는 나중에 자동 할당 로직으로 처리
      commanderId: u.commanderId
    }));

    const battle = new GalaxyTacticalBattle({
      session_id: sessionId,
      battleId,
      gridId,
      status: 'active',
      units,
      factions: [
        { code: 'empire', label: '은하제국', commanderIds: [], unitCount: units.filter(u => u.faction === 'empire').length },
        { code: 'alliance', label: '자유행성동맹', commanderIds: [], unitCount: units.filter(u => u.faction === 'alliance').length }
      ],
      startTime: new Date(),
      lastTick: new Date()
    });

    await battle.save();
    return battle;
  }

  // 틱 업데이트 (RTS 엔진)
  static async tick(battleId: string): Promise<void> {
    const battle = await GalaxyTacticalBattle.findOne({ battleId });
    if (!battle || battle.status !== 'active') return;

    const now = new Date();
    const deltaTime = (now.getTime() - battle.lastTick.getTime()) / 1000; // 초 단위

    // 각 유닛 상태 업데이트
    battle.units.forEach(unit => {
      if (unit.status !== 'active') return;

      // 1. 명령 처리 (메뉴얼 2215행)
      if (unit.currentCommand) {
        this.processCommand(unit, deltaTime);
      }

      // 2. 이동 처리
      unit.position.x += unit.velocity.x * deltaTime;
      unit.position.y += unit.velocity.y * deltaTime;
      
      // 3. 커맨드 레인지 확장 (메뉴얼 2202행)
      if (unit.commandRange.currentRadius < unit.commandRange.maxRadius) {
        // 확장 속도는 지휘관 능력 등에 따라 다름 (여기서는 단순화)
        unit.commandRange.currentRadius += unit.commandRange.expansionRate * deltaTime;
        if (unit.commandRange.currentRadius > unit.commandRange.maxRadius) {
          unit.commandRange.currentRadius = unit.commandRange.maxRadius;
        }
      }
    });

    battle.lastTick = now;
    await battle.save();
  }

  // 명령 처리 로직
  private static processCommand(unit: ITacticalUnit, deltaTime: number) {
    const cmd = unit.currentCommand!;
    
    if (cmd.state === 'preparing') {
      // 실행 대기 시간 처리 (메뉴얼 2215행: 0~20초)
      cmd.progress += deltaTime * 10; // 임시 속도
      if (cmd.progress >= 100) {
        cmd.state = 'executing';
        cmd.progress = 0;
        // 커맨드 레인지 리셋 (메뉴얼 2203행)
        unit.commandRange.currentRadius = 0;
      }
    } else if (cmd.state === 'executing') {
      // 실제 명령 수행 (이동, 공격 등)
      if (cmd.code === 'MOVE' && cmd.targetPos) {
        // 속도 벡터 계산 등
        const dx = cmd.targetPos.x - unit.position.x;
        const dy = cmd.targetPos.y - unit.position.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist < 10) {
          unit.velocity = { x: 0, y: 0, z: 0 };
          unit.currentCommand = undefined; // 명령 완료
        } else {
          const speed = (unit.energyDistribution.engine / 20) * 50; // 엔진 출력에 따른 속도
          unit.velocity.x = (dx / dist) * speed;
          unit.velocity.y = (dy / dist) * speed;
        }
      }
    }
  }

  // 명령 발령 (메뉴얼 2409행~)
  static async issueCommand(battleId: string, unitId: string, commandCode: string, target: any): Promise<boolean> {
    const battle = await GalaxyTacticalBattle.findOne({ battleId });
    if (!battle) return false;

    const unit = battle.units.find(u => u.unitId === unitId);
    if (!unit) return false;

    // 커맨드 레인지 체크 (지휘관이 발령하는 경우)
    // ... 생략 (지휘관과 유닛 거리 계산 필요)

    unit.currentCommand = {
      code: commandCode,
      targetId: target.id,
      targetPos: target.position,
      progress: 0,
      state: 'preparing'
    };

    await battle.save();
    return true;
  }

  // 조함 패널 조작 (메뉴얼 884행)
  static async updateEnergy(battleId: string, unitId: string, distribution: any): Promise<boolean> {
    const battle = await GalaxyTacticalBattle.findOne({ battleId });
    if (!battle) return false;

    const unit = battle.units.find(u => u.unitId === unitId);
    if (!unit) return false;

    // 합계 120 체크 등 검증 로직 필요
    unit.energyDistribution = distribution;
    
    await battle.save();
    return true;
  }
}

