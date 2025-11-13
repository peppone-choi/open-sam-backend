/**
 * 기존 데이터를 새 Entity 모델로 마이그레이션하는 스크립트
 * 
 * 실행 방법:
 * - Dry-run (롤백 모드): ts-node src/scripts/migrate-to-entities.ts --dry-run
 * - 실제 마이그레이션: ts-node src/scripts/migrate-to-entities.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Role, createRef } from '../common/@types/role.types';
import { EntityRepository } from '../common/repository/entity-repository';
import { Entity } from '../common/model/entity.model';
import { Edge } from '../common/model/edge.model';

dotenv.config();

// 기존 모델 스키마 (임시 정의)
const GeneralSchema = new mongoose.Schema({}, { strict: false, collection: 'generals' });
const CitySchema = new mongoose.Schema({}, { strict: false, collection: 'cities' });
const NationSchema = new mongoose.Schema({}, { strict: false, collection: 'nations' });

const General = mongoose.model('General', GeneralSchema);
const City = mongoose.model('City', CitySchema);
const Nation = mongoose.model('Nation', NationSchema);

interface MigrationStats {
  commanders: { total: number; migrated: number; failed: number };
  settlements: { total: number; migrated: number; failed: number };
  factions: { total: number; migrated: number; failed: number };
  edges: { total: number; created: number; failed: number };
  errors: Array<{ type: string; id: string; error: string }>;
}

const stats: MigrationStats = {
  commanders: { total: 0, migrated: 0, failed: 0 },
  settlements: { total: 0, migrated: 0, failed: 0 },
  factions: { total: 0, migrated: 0, failed: 0 },
  edges: { total: 0, created: 0, failed: 0 },
  errors: [],
};

/**
 * Commander 마이그레이션 (generals → entities)
 */
async function migrateCommander(general: any, scenario: string, dryRun: boolean): Promise<boolean> {
  try {
    const entityData = {
      scenario,
      role: Role.COMMANDER,
      id: general.no.toString(),
      name: general.name,
      version: 1,
      
      // 능력치 매핑: leadership/strength/intel → attributes
      attributes: {
        leadership: general.leadership || 50,
        leadershipExp: general.leadership_exp || 0,
        strength: general.strength || 50,
        strengthExp: general.strength_exp || 0,
        intel: general.intel || 50,
        intelExp: general.intel_exp || 0,
        experience: general.experience || 0,
        dedication: general.dedication || 0,
        injury: general.injury || 0,
        age: general.age || 20,
        startAge: general.startage || 20,
        birthYear: general.bornyear || 184,
        deadYear: general.deadyear || 300,
        
        // 특기 레벨
        dex1: general.dex1 || 0,
        dex2: general.dex2 || 0,
        dex3: general.dex3 || 0,
        dex4: general.dex4 || 0,
        dex5: general.dex5 || 0,
        
        dedLevel: general.dedlevel || 0,
        expLevel: general.explevel || 0,
        
        // 소속 정보
        belong: general.belong || 1,
        betray: general.betray || 0,
        affinity: general.affinity || 0,
        
        officerLevel: general.officer_level || 0,
      },
      
      // 자원 매핑: gold/rice → resources
      resources: {
        gold: general.gold || 0,
        rice: general.rice || 0,
      },
      
      // 병력 정보 (슬롯으로 관리)
      slots: {
        crew: {
          value: general.crew || 0,
          max: (general.leadership || 50) * 100,
          meta: {
            crewType: general.crewtype || 1100, // 병종
            train: general.train || 0, // 훈련도
            atmos: general.atmos || 0, // 사기
          },
        },
      },
      
      // 관계 참조
      refs: {
        assignedSettlement: general.city ? createRef(Role.SETTLEMENT, general.city.toString(), scenario) : null,
        faction: general.nation ? createRef(Role.FACTION, general.nation.toString(), scenario) : null,
        troop: general.troop ? createRef(Role.FORCE, general.troop.toString(), scenario) : null,
      },
      
      // 시스템 상태 (기타 정보)
      systems: {
        combat: {
          weapon: general.weapon || 'None',
          book: general.book || 'None',
          horse: general.horse || 'None',
          item: general.item || 'None',
          personal: general.personal || 'None',
          special: general.special || 'None',
          specAge: general.specage || 0,
          special2: general.special2 || 'None',
          specAge2: general.specage2 || 0,
        },
        player: {
          owner: general.owner || 0,
          ownerName: general.owner_name || null,
          npc: general.npc || 0,
          npcOrg: general.npc_org || 0,
          npcMsg: general.npcmsg || '',
          newMsg: general.newmsg || 0,
        },
        turn: {
          turnTime: general.turntime,
          recentWar: general.recent_war || null,
          lastTurn: general.last_turn || {},
        },
        image: {
          picture: general.picture,
          imgServer: general.imgsvr || 0,
        },
        status: {
          block: general.block || 0,
          killTurn: general.killturn || null,
          makeLimit: general.makelimit || 0,
          defenceTrain: general.defence_train || 80,
        },
        misc: {
          officerCity: general.officer_city || 0,
          permission: general.permission || 'normal',
          tournament: general.tournament || 0,
          newVote: general.newvote || 0,
          aux: general.aux || {},
          penalty: general.penalty || {},
        },
      },
    };

    if (!dryRun) {
      await EntityRepository.create(entityData);
    }

    stats.commanders.migrated++;
    if (stats.commanders.migrated % 100 === 0) {
      console.log(`  ✓ ${stats.commanders.migrated}/${stats.commanders.total} commanders 마이그레이션 완료`);
    }
    
    return true;
  } catch (error) {
    stats.commanders.failed++;
    stats.errors.push({
      type: 'commander',
      id: general.no?.toString() || 'unknown',
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Settlement 마이그레이션 (cities → entities)
 */
async function migrateSettlement(city: any, scenario: string, dryRun: boolean): Promise<boolean> {
  try {
    const entityData = {
      scenario,
      role: Role.SETTLEMENT,
      id: city.city.toString(),
      name: city.name,
      version: 1,
      
      // 속성 매핑
      attributes: {
        level: city.level || 1,
        population: city.pop || 0,
        populationMax: city.pop_max || 0,
        trust: city.trust || 0,
        trade: city.trade || 100,
        dead: city.dead || 0,
        supply: city.supply || 1,
        front: city.front || 0,
        state: city.state || 0,
        region: city.region || 0,
        term: city.term || 0,
        officerSet: city.officer_set || 0,
      },
      
      // 자원 (도시는 금/쌀 없음)
      resources: {},
      
      // 슬롯 매핑: agriculture/commerce/tech/wall/secu → slots
      slots: {
        agriculture: {
          value: city.agri || 0,
          max: city.agri_max || 0,
        },
        commerce: {
          value: city.comm || 0,
          max: city.comm_max || 0,
        },
        security: {
          value: city.secu || 0,
          max: city.secu_max || 0,
        },
        defense: {
          value: city.def || 0,
          max: city.def_max || 0,
        },
        wall: {
          value: city.wall || 0,
          max: city.wall_max || 0,
        },
      },
      
      // 관계 참조
      refs: {
        owner: city.nation ? createRef(Role.FACTION, city.nation.toString(), scenario) : null,
      },
      
      // 시스템 상태
      systems: {
        conflict: city.conflict || {},
      },
    };

    if (!dryRun) {
      await EntityRepository.create(entityData);
    }

    stats.settlements.migrated++;
    if (stats.settlements.migrated % 50 === 0) {
      console.log(`  ✓ ${stats.settlements.migrated}/${stats.settlements.total} settlements 마이그레이션 완료`);
    }
    
    return true;
  } catch (error) {
    stats.settlements.failed++;
    stats.errors.push({
      type: 'settlement',
      id: city.city?.toString() || 'unknown',
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Faction 마이그레이션 (nations → entities)
 */
async function migrateFaction(nation: any, scenario: string, dryRun: boolean): Promise<boolean> {
  try {
    const entityData = {
      scenario,
      role: Role.FACTION,
      id: nation.nation.toString(),
      name: nation.name,
      version: 1,
      
      // 속성 매핑: tech/prestige → attributes
      attributes: {
        tech: nation.tech || 0,
        power: nation.power || 0,
        level: nation.level || 0,
        genNum: nation.gennum || 1,
        capital: nation.capital || 0,
        capSet: nation.capset || 0,
        bill: nation.bill || 0,
        rate: nation.rate || 0,
        rateTemp: nation.rate_tmp || 0,
        secretLimit: nation.secretlimit || 3,
        chiefSet: nation.chief_set || 0,
        scout: nation.scout || 0,
        war: nation.war || 0,
        strategicCmdLimit: nation.strategic_cmd_limit || 36,
        surLimit: nation.surlimit || 72,
      },
      
      // 자원 매핑: gold/rice → resources
      resources: {
        gold: nation.gold || 0,
        rice: nation.rice || 0,
      },
      
      // 슬롯 (국가는 슬롯 없음)
      slots: {},
      
      // 관계 참조
      refs: {
        capital: nation.capset ? createRef(Role.SETTLEMENT, nation.capset.toString(), scenario) : null,
      },
      
      // 시스템 상태
      systems: {
        diplomacy: {
          spy: nation.spy || {},
        },
        visual: {
          color: nation.color || '#000000',
          type: nation.type || 'che_중립',
        },
        misc: {
          aux: nation.aux || {},
        },
      },
    };

    if (!dryRun) {
      await EntityRepository.create(entityData);
    }

    stats.factions.migrated++;
    console.log(`  ✓ ${stats.factions.migrated}/${stats.factions.total} factions 마이그레이션 완료`);
    
    return true;
  } catch (error) {
    stats.factions.failed++;
    stats.errors.push({
      type: 'faction',
      id: nation.nation?.toString() || 'unknown',
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Edge 생성
 */
async function createEdges(scenario: string, dryRun: boolean): Promise<void> {
  console.log('\n[4/4] Edge 생성 중...');

  try {
    // ASSIGNED_SETTLEMENT: commander → settlement
    const commanders = await Entity.find({ scenario, role: Role.COMMANDER }).exec();
    stats.edges.total += commanders.length;

    for (const commander of commanders) {
      try {
        const assignedSettlement = commander.refs?.assignedSettlement;
        const faction = commander.refs?.faction;

        // ASSIGNED_SETTLEMENT edge
        if (assignedSettlement && !dryRun) {
          await EntityRepository.createEdge(
            scenario,
            'ASSIGNED_SETTLEMENT',
            createRef(Role.COMMANDER, commander.id, scenario),
            assignedSettlement,
            {}
          );
          stats.edges.created++;
        }

        // MEMBER_OF edge
        if (faction && !dryRun) {
          await EntityRepository.createEdge(
            scenario,
            'MEMBER_OF',
            createRef(Role.COMMANDER, commander.id, scenario),
            faction,
            {}
          );
          stats.edges.created++;
        }
      } catch (error) {
        stats.edges.failed++;
        stats.errors.push({
          type: 'edge',
          id: commander.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // OWNS: faction → settlement
    const settlements = await Entity.find({ scenario, role: Role.SETTLEMENT }).exec();
    stats.edges.total += settlements.length;

    for (const settlement of settlements) {
      try {
        const owner = settlement.refs?.owner;

        if (owner && !dryRun) {
          await EntityRepository.createEdge(
            scenario,
            'OWNS',
            owner,
            createRef(Role.SETTLEMENT, settlement.id, scenario),
            {}
          );
          stats.edges.created++;
        }
      } catch (error) {
        stats.edges.failed++;
        stats.errors.push({
          type: 'edge',
          id: settlement.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    console.log(`  ✓ ${stats.edges.created}/${stats.edges.total} edges 생성 완료`);
  } catch (error) {
    console.error('  ✗ Edge 생성 실패:', error);
  }
}

/**
 * 메인 마이그레이션 실행
 */
async function migrate(dryRun: boolean = false): Promise<void> {
  const scenario = 'sangokushi'; // 기본 시나리오

  console.log('='.repeat(60));
  console.log('데이터 마이그레이션 시작');
  console.log(`모드: ${dryRun ? 'DRY-RUN (롤백)' : '실제 마이그레이션'}`);
  console.log('='.repeat(60));

  // 1. Commander 마이그레이션
  console.log('\n[1/4] Commander 마이그레이션 중...');
  const generals = await General.find({}).lean().exec();
  stats.commanders.total = generals.length;
  console.log(`  총 ${stats.commanders.total}개의 commanders 발견`);

  for (const general of generals) {
    await migrateCommander(general, scenario, dryRun);
  }

  console.log(`  ✓ 완료: ${stats.commanders.migrated}개 성공, ${stats.commanders.failed}개 실패`);

  // 2. Settlement 마이그레이션
  console.log('\n[2/4] Settlement 마이그레이션 중...');
  const cities = await City.find({}).lean().exec();
  stats.settlements.total = cities.length;
  console.log(`  총 ${stats.settlements.total}개의 settlements 발견`);

  for (const city of cities) {
    await migrateSettlement(city, scenario, dryRun);
  }

  console.log(`  ✓ 완료: ${stats.settlements.migrated}개 성공, ${stats.settlements.failed}개 실패`);

  // 3. Faction 마이그레이션
  console.log('\n[3/4] Faction 마이그레이션 중...');
  const nations = await Nation.find({}).lean().exec();
  stats.factions.total = nations.length;
  console.log(`  총 ${stats.factions.total}개의 factions 발견`);

  for (const nation of nations) {
    await migrateFaction(nation, scenario, dryRun);
  }

  console.log(`  ✓ 완료: ${stats.factions.migrated}개 성공, ${stats.factions.failed}개 실패`);

  // 4. Edge 생성 (Dry-run이 아닐 때만)
  if (!dryRun) {
    await createEdges(scenario, dryRun);
  } else {
    console.log('\n[4/4] Edge 생성 스킵 (Dry-run 모드)');
  }

  // 최종 통계 출력
  console.log('\n' + '='.repeat(60));
  console.log('마이그레이션 완료');
  console.log('='.repeat(60));
  console.log(`Commanders: ${stats.commanders.migrated}/${stats.commanders.total} (실패: ${stats.commanders.failed})`);
  console.log(`Settlements: ${stats.settlements.migrated}/${stats.settlements.total} (실패: ${stats.settlements.failed})`);
  console.log(`Factions: ${stats.factions.migrated}/${stats.factions.total} (실패: ${stats.factions.failed})`);
  console.log(`Edges: ${stats.edges.created}/${stats.edges.total} (실패: ${stats.edges.failed})`);
  
  if (stats.errors.length > 0) {
    console.log('\n⚠️  에러 발생:');
    stats.errors.slice(0, 10).forEach((err, idx) => {
      console.log(`  ${idx + 1}. [${err.type}] ${err.id}: ${err.error}`);
    });
    if (stats.errors.length > 10) {
      console.log(`  ... 외 ${stats.errors.length - 10}개 에러`);
    }
  }

  console.log('='.repeat(60));
}

/**
 * 롤백 함수 (마이그레이션된 데이터 삭제)
 */
async function rollback(scenario: string): Promise<void> {
  console.log('='.repeat(60));
  console.log('롤백 시작');
  console.log('='.repeat(60));

  // Entity 삭제
  console.log('\n엔티티 삭제 중...');
  const entityResult = await Entity.deleteMany({ scenario }).exec();
  console.log(`  ✓ ${entityResult.deletedCount}개의 엔티티 삭제됨`);

  // Edge 삭제
  console.log('\nEdge 삭제 중...');
  const edgeResult = await Edge.deleteMany({ scenario }).exec();
  console.log(`  ✓ ${edgeResult.deletedCount}개의 Edge 삭제됨`);

  console.log('\n' + '='.repeat(60));
  console.log('롤백 완료');
  console.log('='.repeat(60));
}

/**
 * 스크립트 실행
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const doRollback = args.includes('--rollback');

  try {
    // MongoDB 연결
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sangokushi';
    await mongoose.connect(mongoUri);
    console.log('MongoDB 연결 성공');

    if (doRollback) {
      await rollback('sangokushi');
    } else {
      await migrate(dryRun);
    }

    await mongoose.disconnect();
    console.log('\nMongoDB 연결 종료');
  } catch (error) {
    console.error('마이그레이션 실패:', error);
    process.exit(1);
  }
}

// 스크립트 실행
main();
