import { General } from '../../models/general.model';
import { Session } from '../../models/session.model';
import { City } from '../../models/city.model';
import { GeneralRecord } from '../../models/general_record.model';
import { GeneralTurn } from '../../models/general_turn.model';
import { User } from '../../models/user.model';
import crypto from 'crypto';

/**
 * Join Service (장수 가입)
 * 새로운 장수를 생성하고 게임에 등록
 */
export class JoinService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const userId = user?.userId || data.user_id;
    
    try {
      // 1. 입력 검증
      const validation = this.validateInput(data);
      if (!validation.success) {
        return validation;
      }

      const {
        name: rawName,
        leadership,
        strength,
        intel,
        pic,
        character,
        inheritSpecial,
        inheritTurntimeZone,
        inheritCity,
        inheritBonusStat
      } = data;

      // 2. 이름 정제
      let name = this.sanitizeName(rawName);

      // 3. 세션 및 게임 환경 로드
      const session = await Session.findOne({ session_id: sessionId });
      if (!session) {
        return { success: false, message: '세션을 찾을 수 없습니다' };
      }

      const gameEnv = session.data?.game_env || {};
      
      // 4. 장수 생성 가능 여부 확인
      const blockCheck = this.checkBlockCreate(gameEnv);
      if (blockCheck) {
        return { success: false, message: blockCheck };
      }

      // 5. 중복 확인
      const duplicateCheck = await this.checkDuplicates(sessionId, userId, name);
      if (duplicateCheck) {
        return { success: false, message: duplicateCheck };
      }

      // 6. 장수 수 제한 확인
      const currentGenCount = await General.countDocuments({ 
        session_id: sessionId,
        'data.npc': { $lt: 2 }
      });
      const maxGeneral = gameEnv.maxgeneral || 500;
      if (currentGenCount >= maxGeneral) {
        return { success: false, message: '더이상 등록할 수 없습니다!' };
      }

      // 7. 능력치 검증
      const statTotal = gameEnv.defaultStatTotal || 240;
      if (leadership + strength + intel > statTotal) {
        return { 
          success: false, 
          message: `능력치가 ${statTotal}을 넘어섰습니다. 다시 가입해주세요!` 
        };
      }

      // 8. 유산 시스템 (inheritance) 처리
      const inheritResult = await this.processInheritance(
        userId,
        sessionId,
        gameEnv,
        {
          inheritSpecial,
          inheritTurntimeZone,
          inheritCity,
          inheritBonusStat
        }
      );

      if (!inheritResult.success) {
        return inheritResult;
      }

      // 9. 보너스 능력치 계산
      const bonusStats = this.calculateBonusStats(
        inheritBonusStat,
        leadership,
        strength,
        intel,
        userId
      );

      const finalLeadership = leadership + bonusStats.leadership;
      const finalStrength = strength + bonusStats.strength;
      const finalIntel = intel + bonusStats.intel;

      // 10. 나이 계산
      const relYear = Math.max(
        (gameEnv.year || 184) - (gameEnv.startyear || 184),
        0
      );
      const totalBonus = bonusStats.leadership + bonusStats.strength + bonusStats.intel;
      const rng = this.createRNG(userId);
      const age = 20 + totalBonus * 2 - (rng % 2);

      // 11. 천재(genius) 여부 결정
      const geniusResult = this.determineGenius(
        inheritSpecial,
        gameEnv.genius || 0,
        rng
      );

      // 12. 특기(special) 결정
      const specialResult = this.determineSpecials(
        geniusResult.isGenius,
        inheritSpecial,
        age,
        relYear,
        gameEnv.scenario || 0,
        finalLeadership,
        finalStrength,
        finalIntel,
        rng
      );

      // 13. 태어날 도시 결정
      const bornCity = await this.determineBornCity(
        sessionId,
        inheritCity,
        rng
      );

      if (!bornCity) {
        return { success: false, message: '태어날 도시를 찾을 수 없습니다' };
      }

      // 14. 경험치 계산
      const experience = await this.calculateStartExperience(
        sessionId,
        relYear
      );

      // 15. 턴타임 계산
      const turntime = this.calculateTurntime(
        inheritTurntimeZone,
        gameEnv,
        rng
      );

      // 16. 얼굴 이미지 설정
      const faceResult = await this.determineFace(
        userId,
        gameEnv.show_img_level || 0,
        pic
      );

      // 17. 성격 및 상성 결정
      const personality = this.determinePersonality(character, rng);
      const affinity = (rng % 150) + 1;

      // 18. 배신 수치 계산
      const betray = relYear >= 4 ? 2 : 0;

      // 19. 익명 모드 체크
      const blockCustomName = (gameEnv.block_general_create || 0) & 2;
      if (blockCustomName) {
        name = this.generateRandomName();
      }

      // 20. 장수 번호 생성 (autoincrement 시뮬레이션)
      const lastGeneral = await General.findOne({ session_id: sessionId })
        .sort({ no: -1 })
        .select('no');
      const generalNo = (lastGeneral?.no || 0) + 1;

      // 21. 장수 생성
      const newGeneral = await General.create({
        no: generalNo,
        session_id: sessionId,
        owner: userId.toString(),
        name: name,
        picture: faceResult.picture,
        data: {
          owner_name: user?.name || 'Unknown',
          imgsvr: faceResult.imgsvr,
          nation: 0, // 야인으로 시작
          city: bornCity.city,
          troop: 0,
          affinity: affinity,
          leadership: finalLeadership,
          strength: finalStrength,
          intel: finalIntel,
          experience: experience,
          dedication: 0,
          gold: gameEnv.defaultGold || 1000,
          rice: gameEnv.defaultRice || 1000,
          crew: 0,
          train: 0,
          atmos: 0,
          officer_level: 0,
          turntime: turntime,
          killturn: 6,
          crewtype: gameEnv.defaultCrewtype || 0,
          makelimit: 0,
          betray: betray,
          age: age,
          startage: age,
          personal: personality,
          specage: specialResult.specage,
          special: specialResult.special,
          specage2: specialResult.specage2,
          special2: specialResult.special2,
          penalty: {},
          npc: 0
        }
      });

      // 22. 턴 슬롯 생성 (30개)
      const turnRows = [];
      const maxTurn = gameEnv.maxTurn || 30;
      for (let i = 0; i < maxTurn; i++) {
        turnRows.push({
          session_id: sessionId,
          general_id: generalNo,
          turn_idx: i,
          action: '휴식',
          arg: null,
          brief: '휴식'
        });
      }
      await GeneralTurn.insertMany(turnRows);

      // 23. 랭크 데이터 생성
      // TODO: rank_data 테이블 구현 시 추가

      // 24. 익명 모드면 장수 번호 기반 이름 재생성
      if (blockCustomName) {
        name = this.generateObfuscatedName(generalNo);
        newGeneral.name = name;
        await newGeneral.save();
      }

      // 25. 유산 포인트 소비 기록
      if (inheritResult.requiredPoint > 0) {
        // TODO: 유산 포인트 로깅
      }

      // 26. 로그 기록
      await this.createJoinLogs(
        sessionId,
        generalNo,
        name,
        bornCity.name,
        geniusResult.isGenius,
        specialResult.special2Name,
        bonusStats,
        age,
        gameEnv.year || 184,
        gameEnv.month || 1
      );

      return {
        success: true,
        result: true,
        message: '장수 생성 성공',
        data: {
          generalId: generalNo,
          generalName: name,
          city: bornCity.name,
          isGenius: geniusResult.isGenius
        }
      };

    } catch (error: any) {
      console.error('Join error:', error);
      return {
        success: false,
        message: error.message || '장수 생성 중 오류가 발생했습니다'
      };
    }
  }

  // ========== Helper Methods ==========

  private static validateInput(data: any): any {
    const required = ['name', 'leadership', 'strength', 'intel', 'pic', 'character'];
    for (const field of required) {
      if (data[field] === undefined || data[field] === null) {
        return { success: false, message: `${field}는 필수 항목입니다` };
      }
    }

    const { leadership, strength, intel } = data;
    const min = 30; // GameConst::$defaultStatMin
    const max = 100; // GameConst::$defaultStatMax

    if (leadership < min || leadership > max) {
      return { success: false, message: `통솔은 ${min}~${max} 사이여야 합니다` };
    }
    if (strength < min || strength > max) {
      return { success: false, message: `무력은 ${min}~${max} 사이여야 합니다` };
    }
    if (intel < min || intel > max) {
      return { success: false, message: `지력은 ${min}~${max} 사이여야 합니다` };
    }

    const nameWidth = this.getStringWidth(data.name);
    if (nameWidth < 1 || nameWidth > 18) {
      return { success: false, message: '이름은 1~18자 사이여야 합니다' };
    }

    return { success: true };
  }

  private static sanitizeName(name: string): string {
    // HTML 특수문자 제거, 공백 정리
    return name
      .replace(/<[^>]*>/g, '')
      .replace(/[^\w\s가-힣]/g, '')
      .trim();
  }

  private static getStringWidth(str: string): number {
    // 한글은 2, 영문은 1로 계산 (PHP의 mb_strwidth 시뮬레이션)
    let width = 0;
    for (const char of str) {
      if (/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf\uac00-\ud7a3]/.test(char)) {
        width += 2;
      } else {
        width += 1;
      }
    }
    return width;
  }

  private static checkBlockCreate(gameEnv: any): string | null {
    const blockCreate = gameEnv.block_general_create || 0;
    if (blockCreate & 1) {
      return '장수 직접 생성이 불가능한 모드입니다.';
    }
    return null;
  }

  private static async checkDuplicates(
    sessionId: string,
    userId: number,
    name: string
  ): Promise<string | null> {
    const existingUser = await General.findOne({
      session_id: sessionId,
      owner: userId.toString()
    });
    if (existingUser) {
      return '이미 등록하셨습니다!';
    }

    const existingName = await General.findOne({
      session_id: sessionId,
      name: name
    });
    if (existingName) {
      return '이미 있는 장수입니다. 다른 이름으로 등록해 주세요!';
    }

    return null;
  }

  private static async processInheritance(
    userId: number,
    sessionId: string,
    gameEnv: any,
    options: any
  ): Promise<any> {
    let requiredPoint = 0;
    const inheritCityPoint = gameEnv.inheritBornCityPoint || 500;
    const inheritStatPoint = gameEnv.inheritBornStatPoint || 500;
    const inheritSpecialPoint = gameEnv.inheritBornSpecialPoint || 1000;
    const inheritTurntimePoint = gameEnv.inheritBornTurntimePoint || 300;

    if (options.inheritCity !== null && options.inheritCity !== undefined) {
      requiredPoint += inheritCityPoint;
    }
    if (options.inheritBonusStat !== null && options.inheritBonusStat !== undefined) {
      requiredPoint += inheritStatPoint;
    }
    if (options.inheritSpecial !== null && options.inheritSpecial !== undefined) {
      requiredPoint += inheritSpecialPoint;
    }
    if (options.inheritTurntimeZone !== null && options.inheritTurntimeZone !== undefined) {
      requiredPoint += inheritTurntimePoint;
    }

    // TODO: 실제 유산 포인트 확인 로직
    // 현재는 무제한으로 허용
    const totalPoint = 999999;

    if (totalPoint < requiredPoint) {
      return { success: false, message: '유산 포인트가 부족합니다. 다시 가입해주세요!' };
    }

    if (options.inheritSpecial && gameEnv.genius <= 0) {
      return { success: false, message: '이미 천재가 모두 나타났습니다. 다시 가입해주세요!' };
    }

    return { success: true, requiredPoint };
  }

  private static calculateBonusStats(
    inheritBonusStat: number[] | null,
    leadership: number,
    strength: number,
    intel: number,
    userId: number
  ): any {
    if (inheritBonusStat && Array.isArray(inheritBonusStat) && inheritBonusStat.length === 3) {
      const sum = inheritBonusStat.reduce((a, b) => a + b, 0);
      if (sum >= 3 && sum <= 5) {
        return {
          leadership: inheritBonusStat[0],
          strength: inheritBonusStat[1],
          intel: inheritBonusStat[2]
        };
      }
    }

    // 랜덤 보너스 (3~5)
    const rng = this.createRNG(userId);
    const bonusCount = 3 + (rng % 3); // 3, 4, 5
    const stats = [leadership, strength, intel];
    const bonuses = [0, 0, 0];

    for (let i = 0; i < bonusCount; i++) {
      const totalWeight = stats[0] + stats[1] + stats[2];
      const rand = rng % totalWeight;
      let cumulative = 0;
      for (let j = 0; j < 3; j++) {
        cumulative += stats[j];
        if (rand < cumulative) {
          bonuses[j]++;
          break;
        }
      }
    }

    return {
      leadership: bonuses[0],
      strength: bonuses[1],
      intel: bonuses[2]
    };
  }

  private static determineGenius(
    inheritSpecial: string | null,
    geniusQuota: number,
    rng: number
  ): any {
    if (inheritSpecial) {
      return { isGenius: true, quotaUsed: true };
    }

    // 1% 확률로 천재
    const isGenius = (rng % 100) < 1 && geniusQuota > 0;
    return { isGenius, quotaUsed: isGenius };
  }

  private static determineSpecials(
    isGenius: boolean,
    inheritSpecial: string | null,
    age: number,
    relYear: number,
    scenario: number,
    leadership: number,
    strength: number,
    intel: number,
    rng: number
  ): any {
    const retirementYear = 90;
    const defaultSpecialWar = '없음';
    const defaultSpecialDomestic = '없음';

    let specage2: number;
    let special2: string;

    if (isGenius) {
      specage2 = age;
      if (inheritSpecial) {
        special2 = inheritSpecial;
      } else {
        // 능력치 기반 특기 선택 (간략화)
        if (leadership > strength && leadership > intel) {
          special2 = '귀모';
        } else if (strength > intel) {
          special2 = '정예';
        } else {
          special2 = '신속';
        }
      }
    } else {
      const yearsUntilRetirement = retirementYear - age;
      specage2 = Math.max(Math.round(yearsUntilRetirement / 6 - relYear / 2), 3) + age;
      special2 = defaultSpecialWar;
    }

    // 내정 특기
    const yearsUntilRetirement = retirementYear - age;
    const specage = Math.max(Math.round(yearsUntilRetirement / 12 - relYear / 2), 3) + age;
    const special = defaultSpecialDomestic;

    // 시나리오 1000번대는 빠른 특기 습득
    if (scenario >= 1000) {
      return {
        specage: age + 3,
        special,
        specage2: age + 3,
        special2,
        special2Name: special2
      };
    }

    return {
      specage,
      special,
      specage2,
      special2,
      special2Name: special2
    };
  }

  private static async determineBornCity(
    sessionId: string,
    inheritCity: number | null,
    rng: number
  ): Promise<any> {
    if (inheritCity !== null && inheritCity !== undefined) {
      const city = await City.findOne({ session_id: sessionId, city: inheritCity });
      return city;
    }

    // 공백지(level 5~6, nation 0) 우선
    let cities = await City.find({
      session_id: sessionId,
      level: { $gte: 5, $lte: 6 },
      nation: 0
    }).limit(100);

    if (cities.length === 0) {
      // 공백지 없으면 아무 도시나
      cities = await City.find({
        session_id: sessionId,
        level: { $gte: 5, $lte: 6 }
      }).limit(100);
    }

    if (cities.length === 0) {
      return null;
    }

    const selectedCity = cities[Math.abs(rng) % cities.length];
    return selectedCity;
  }

  private static async calculateStartExperience(
    sessionId: string,
    relYear: number
  ): Promise<number> {
    if (relYear < 3) {
      return 0;
    }

    // 상위 20% 장수의 경험치 평균 * 0.8
    const generals = await General.find({
      session_id: sessionId,
      'data.nation': { $ne: 0 },
      'data.npc': { $lt: 4 }
    }).sort({ 'data.experience': 1 }).select('data.experience');

    if (generals.length === 0) {
      return 0;
    }

    const targetIndex = Math.round(generals.length * 0.2);
    const targetExp = generals[targetIndex]?.data?.experience || 0;
    return Math.round(targetExp * 0.8);
  }

  private static calculateTurntime(
    inheritTurntimeZone: number | null,
    gameEnv: any,
    rng: number
  ): Date {
    const turnterm = gameEnv.turnterm || 600; // 10분
    const baseTurntime = new Date(gameEnv.turntime || Date.now());

    if (inheritTurntimeZone !== null && inheritTurntimeZone !== undefined) {
      const inheritMinutes = inheritTurntimeZone * (turnterm / 60);
      const additionalSeconds = rng % Math.max(turnterm - 1, 1);
      const totalSeconds = inheritMinutes * 60 + additionalSeconds;
      
      const turntime = new Date(baseTurntime.getTime());
      turntime.setHours(0, 0, 0, 0);
      turntime.setSeconds(totalSeconds);
      
      return turntime;
    }

    // 랜덤 턴타임
    const randomMinutes = rng % (24 * 60);
    const turntime = new Date(baseTurntime.getTime());
    turntime.setHours(0, 0, 0, 0);
    turntime.setMinutes(randomMinutes);
    
    return turntime;
  }

  private static async determineFace(
    userId: number,
    showImgLevel: number,
    usePic: boolean
  ): Promise<any> {
    // TODO: User 모델에서 실제 이미지 정보 가져오기
    if (showImgLevel >= 1 && usePic) {
      // 실제 구현 시 User 테이블에서 가져옴
      return {
        picture: 'default.jpg',
        imgsvr: 0
      };
    }

    return {
      picture: 'default.jpg',
      imgsvr: 0
    };
  }

  private static determinePersonality(character: string, rng: number): string {
    const availablePersonalities = [
      '냉정', '대담', '맹렬', '침착', '용맹', '지장', '신중', '강직'
    ];

    if (availablePersonalities.includes(character)) {
      return character;
    }

    // 랜덤 선택
    return availablePersonalities[Math.abs(rng) % availablePersonalities.length];
  }

  private static generateRandomName(): string {
    return crypto.randomBytes(5).toString('hex');
  }

  private static generateObfuscatedName(generalNo: number): string {
    // PHP의 Auction::genObfuscatedName 시뮬레이션
    const hash = crypto.createHash('md5').update(generalNo.toString()).digest('hex');
    return `장수${hash.substring(0, 6)}`;
  }

  private static async createJoinLogs(
    sessionId: string,
    generalId: number,
    name: string,
    cityName: string,
    isGenius: boolean,
    specialName: string,
    bonusStats: any,
    age: number,
    year: number,
    month: number
  ): Promise<void> {
    const logs = [];

    // 전역 로그
    if (isGenius) {
      logs.push({
        session_id: sessionId,
        general_id: 0,
        year,
        month,
        type: 'global',
        text: `${cityName}에서 ${name}라는 기재가 천하에 이름을 알립니다.`,
        date: new Date()
      });
      logs.push({
        session_id: sessionId,
        general_id: 0,
        year,
        month,
        type: 'global',
        text: `${specialName} 특기를 가진 천재의 등장으로 온 천하가 떠들썩합니다.`,
        date: new Date()
      });
    } else {
      logs.push({
        session_id: sessionId,
        general_id: 0,
        year,
        month,
        type: 'global',
        text: `${cityName}에서 ${name}라는 호걸이 천하에 이름을 알립니다.`,
        date: new Date()
      });
    }

    // 장수 개인 로그
    logs.push({
      session_id: sessionId,
      general_id: generalId,
      year,
      month,
      type: 'history',
      text: `${name}, ${cityName}에서 큰 뜻을 품다.`,
      date: new Date()
    });

    logs.push({
      session_id: sessionId,
      general_id: generalId,
      year,
      month,
      type: 'action',
      text: '삼국지 모의전투 PHP의 세계에 오신 것을 환영합니다 ^o^',
      date: new Date()
    });

    logs.push({
      session_id: sessionId,
      general_id: generalId,
      year,
      month,
      type: 'action',
      text: `통솔 ${bonusStats.leadership} 무력 ${bonusStats.strength} 지력 ${bonusStats.intel} 의 보너스를 받으셨습니다.`,
      date: new Date()
    });

    logs.push({
      session_id: sessionId,
      general_id: generalId,
      year,
      month,
      type: 'action',
      text: `연령은 ${age}세로 시작합니다.`,
      date: new Date()
    });

    if (isGenius) {
      logs.push({
        session_id: sessionId,
        general_id: generalId,
        year,
        month,
        type: 'action',
        text: `축하합니다! 천재로 태어나 처음부터 ${specialName} 특기를 가지게 됩니다!`,
        date: new Date()
      });
    }

    await GeneralRecord.insertMany(logs);
  }

  private static createRNG(userId: number): number {
    const data = `MakeGeneral-${userId}-${Date.now()}`;
    const hash = crypto.createHash('sha256').update(data).digest();
    return Math.abs(hash.readInt32BE(0));
  }
}