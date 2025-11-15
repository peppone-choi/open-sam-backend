// @ts-nocheck - Type issues need investigation
import { generalRepository } from '../../repositories/general.repository';
import { sessionRepository } from '../../repositories/session.repository';
import { cityRepository } from '../../repositories/city.repository';
import { generalRecordRepository } from '../../repositories/general-record.repository';
import { generalTurnRepository } from '../../repositories/general-turn.repository';
import { User } from '../../models/user.model';
import { RankData } from '../../models/rank_data.model';
import { UserRecord } from '../../models/user_record.model';
import { GeneralTurn } from '../../models/general_turn.model';
import { GeneralRecord } from '../../models/general_record.model';
import { KVStorage } from '../../utils/KVStorage';
import crypto from 'crypto';

/**
 * Join Service (장수 가입)
 * 새로운 장수를 생성하고 게임에 등록
 */
export class JoinService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const userId = user?.userId || user?.id || data.user_id;
    
    if (!userId) {
      return { 
        success: false, 
        message: '로그인이 필요합니다. userId를 찾을 수 없습니다.' 
      };
    }
    
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
        politics,
        charm,
        trait: selectedTrait,
        pic,
        character,
        inheritSpecial,
        inheritTurntimeZone,
        inheritCity: inheritCityParam,
        inheritBonusStat,
        city: cityParam,
        nation: selectedNation
      } = data;
      
      // city 파라미터가 있으면 inheritCity로 사용 (도시 선택)
      const inheritCity = cityParam !== undefined && cityParam !== null ? cityParam : inheritCityParam;

      // 2. 이름 검증 및 정제
      if (!rawName || typeof rawName !== 'string' || rawName.trim().length === 0) {
        return { success: false, message: '장수명을 입력해주세요.' };
      }
      
      let name = this.sanitizeName(rawName);
      
      // sanitizeName 후에도 이름이 비어있으면 에러
      if (!name || name.trim().length === 0) {
        return { success: false, message: '유효한 장수명을 입력해주세요. (특수문자만 입력할 수 없습니다)' };
      }

      // 3. 세션 및 게임 환경 로드
      const session = await sessionRepository.findBySessionId(sessionId );
      if (!session) {
        return { success: false, message: '세션을 찾을 수 없습니다' };
      }

      const gameEnv = session.data?.game_env || {};
      
      // 4. 장수 생성 가능 여부 확인
      const blockCheck = this.checkBlockCreate(gameEnv, session);
      if (blockCheck) {
        return { success: false, message: blockCheck };
      }

      // 5. 중복 확인
      const duplicateCheck = await this.checkDuplicates(sessionId, userId, name);
      if (duplicateCheck) {
        return { success: false, message: duplicateCheck };
      }

      // 6. 장수 수 제한 확인 (플레이어 장수만 카운트)
      const currentGenCount = await generalRepository.count({ 
        session_id: sessionId,
        owner: { $ne: 'NPC' } // NPC가 아닌 장수만 카운트
      });
      const maxGeneral = gameEnv.maxgeneral || 500;
      
      console.log('[Join] General count check:', {
        sessionId,
        currentGenCount,
        maxGeneral,
        canJoin: currentGenCount < maxGeneral
      });
      
      if (currentGenCount >= maxGeneral) {
        return { success: false, message: '더이상 등록할 수 없습니다!' };
      }

      // 7. 능력치 검증 및 트레잇 판정
      const statTotal = gameEnv.defaultStatTotal || 275; // 통무지정매 5개 능력치 기본 275 (평균 55)
      const totalStats = leadership + strength + intel + politics + charm;
      if (totalStats > statTotal) {
        return { 
          success: false, 
          message: `능력치가 ${statTotal}을 넘어섰습니다. 다시 가입해주세요!` 
        };
      }

      // 8. 트레잇 판정 (프론트엔드에서 선택한 트레잇 사용)
      const traitResult = this.getTraitByName(selectedTrait || '범인');
      const statMax = traitResult.maxStat; // 트레잇에 따른 최대 능력치 상한
      
      // 트레잇 범위 검증
      if (totalStats < traitResult.totalMin || totalStats > traitResult.totalMax) {
        return {
          success: false,
          message: `${traitResult.name} 트레잇은 능력치 합이 ${traitResult.totalMin}~${traitResult.totalMax} 사이여야 합니다. (현재: ${totalStats})`
        };
      }

      // 9. 유산 시스템 (inheritance) 처리 + 트레잇 비용
      const inheritResult = await this.processInheritance(
        userId,
        sessionId,
        gameEnv,
        {
          inheritSpecial,
          inheritTurntimeZone,
          inheritCity,
          inheritBonusStat
        },
        traitResult.inheritCost // 트레잇 비용 추가
      );

      if (!inheritResult.success) {
        return inheritResult;
      }

      // 10. 보너스 능력치 계산 (트레잇에 따른 보너스 개수)
      const bonusStats = this.calculateBonusStats(
        inheritBonusStat,
        leadership,
        strength,
        intel,
        politics,
        charm,
        userId,
        traitResult.bonusMin,
        traitResult.bonusMax
      );

      // 트레잇의 최댓값으로 클램프
      const finalLeadership = Math.min(leadership + bonusStats.leadership, statMax);
      const finalStrength = Math.min(strength + bonusStats.strength, statMax);
      const finalIntel = Math.min(intel + bonusStats.intel, statMax);
      const finalPolitics = Math.min(politics + bonusStats.politics, statMax);
      const finalCharm = Math.min(charm + bonusStats.charm, statMax);

      // 11. 나이 계산 (트레잇 페널티 적용)
      const relYear = Math.max(
        (gameEnv.year || 184) - (gameEnv.startyear || 184),
        0
      );
      const totalBonus = bonusStats.leadership + bonusStats.strength + bonusStats.intel + bonusStats.politics + bonusStats.charm;
      const rng = this.createRNG(userId);
      const baseAge = 20 + totalBonus * 2 - (rng % 2);
      const age = Math.max(15, baseAge + traitResult.ageModifier); // 트레잇에 따라 나이 조정

      // 12. 천재(genius) 여부 결정
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
        finalPolitics,
        finalCharm,
        rng
      );

      // 13. 세력 결정: 사용자가 선택한 세력 사용 (없으면 0 = 재야)
      const nationId = selectedNation !== undefined && selectedNation !== null ? Number(selectedNation) : 0;
      
      console.log('[Join] Selected nation:', {
        selectedNation,
        nationId,
        isReya: nationId === 0
      });

      // 14. 태어날 도시 결정
      const bornCityResult = await this.determineBornCity(
        sessionId,
        inheritCity,
        rng,
        nationId // 선택한 국가 전달
      );

      if (!bornCityResult) {
        console.error('[Join] No cities available in session:', sessionId);
        return { 
          success: false, 
          message: '태어날 도시를 찾을 수 없습니다. 게임 세션에 도시가 없거나 초기화되지 않았습니다.' 
        };
      }
      
      // city 번호 추출 (최상위 필드 우선, 없으면 data.city)
      const bornCityID = bornCityResult.city || bornCityResult.data?.city;
      const bornCityName = bornCityResult.name || bornCityResult.data?.name || '알 수 없는 도시';
      
      if (!bornCityID) {
        console.error('[Join] CRITICAL: bornCity ID is null/undefined!', {
          bornCityResult,
          hasCity: !!bornCityResult.city,
          hasDataCity: !!bornCityResult.data?.city,
          keys: Object.keys(bornCityResult)
        });
        return { 
          success: false, 
          message: '도시 번호를 가져올 수 없습니다. 도시 데이터가 손상되었을 수 있습니다.' 
        };
      }
      
      console.log('[createGeneral] Born city info:', {
        cityID: bornCityID,
        cityName: bornCityName,
        originalObject: bornCityResult
      });

      // 15. 경험치 계산
      const experience = await this.calculateStartExperience(
        sessionId,
        relYear
      );

      // 16. 턴타임 계산 (세션의 turntime에 맞춰서)
      const turnterm = gameEnv.turnterm || 10; // 기본 10분
      const sessionTurntime = session.data?.turntime || session.turntime;
      const turntime = this.calculateTurntime(
        turnterm,
        sessionTurntime,
        rng,
        inheritTurntimeZone
      );

      // 17. 얼굴 이미지 설정
      const faceResult = await this.determineFace(
        userId,
        gameEnv.show_img_level || 0,
        pic
      );

      // 18. 성격 및 상성 결정
      const personality = this.determinePersonality(character, rng);
      const affinity = (rng % 150) + 1;

      // 19. 배신 수치 계산
      const betray = relYear >= 4 ? 2 : 0;

      // 20. 익명 모드 체크
      const blockCustomName = (gameEnv.block_general_create || 0) & 2;
      if (blockCustomName) {
        name = this.generateRandomName();
      }

      // 21. 장수 번호 생성 (autoincrement 시뮬레이션)
      const generals = await generalRepository.findByFilter({ session_id: sessionId })
        .sort({ no: -1 })
        .limit(1);
      const lastGeneral = generals.length > 0 ? generals[0] : null;
      const generalNo = (lastGeneral?.no || 0) + 1;
      
      // 22. 장수 생성
      let newGeneral;
      try {
        const generalData = {
          no: generalNo,
          session_id: sessionId,
          owner: String(userId),
          name: name,
          picture: faceResult.picture || '/default_portrait.png',
          npc: 0, // 최상위 필드로 평탄화
          leadership: finalLeadership, // 최상위 필드로 평탄화
          strength: finalStrength, // 최상위 필드로 평탄화
          intel: finalIntel, // 최상위 필드로 평탄화
          politics: finalPolitics, // 최상위 필드로 평탄화
          charm: finalCharm, // 최상위 필드로 평탄화
          nation: nationId, // 최상위 필드로 평탄화 (사용자가 선택한 세력)
          city: bornCityID, // 최상위 필드로 평탄화 (프론트엔드에서 general.city로 직접 참조)
          officer_level: character ? 1 : 0, // 최상위 필드로 평탄화 (국가 소속이면 관직 1)
          data: {
            owner_name: user?.name || 'Unknown',
            imgsvr: faceResult.imgsvr,
            nation: nationId, // 사용자가 선택한 세력
            city: bornCityID, // PHP 원본과 동일하게 city 번호 할당
            troop: 0,
            affinity: affinity,
            leadership: finalLeadership,
            strength: finalStrength,
            intel: finalIntel,
            politics: finalPolitics,
            charm: finalCharm,
            trait: traitResult.name, // 트레잇
            trait_desc: traitResult.description, // 트레잇 설명
            experience: experience,
            dedication: 0,
            gold: Math.floor((gameEnv.defaultGold || 1000) * traitResult.goldMultiplier),
            rice: Math.floor((gameEnv.defaultRice || 1000) * traitResult.riceMultiplier),
            crew: 0,
            train: 0,
            atmos: 0,
            officer_level: character ? 1 : 0,
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
        };
        
        // 최종 name 검증 (빈 문자열이면 에러)
        if (!name || name.trim().length === 0) {
          return {
            success: false,
            message: '장수명이 비어있습니다. 유효한 이름을 입력해주세요.'
          };
        }
        
        console.log('[Join] Creating general with data:', {
          no: generalNo,
          session_id: sessionId,
          owner: String(userId),
          name: name,
          nameLength: name.length,
          picture: faceResult.picture,
          dataKeys: Object.keys(generalData.data)
        });
        
        newGeneral = await generalRepository.create(generalData);
        console.log('[Join] General created successfully:', newGeneral.no);
      } catch (createError: any) {
        console.error('[Join] General creation failed:', {
          error: createError.message,
          stack: createError.stack,
          name: createError.name || createError.constructor?.name || 'Unknown',
          code: createError.code || null,
          errors: createError.errors || null
        });
        
        // Mongoose ValidationError 처리
        if (createError.name === 'ValidationError') {
          const validationErrors = Object.values(createError.errors || {}).map((err: any) => `${err.path}: ${err.message}`);
          return {
            success: false,
            message: `유효성 검사 실패: ${validationErrors.join(', ')}`
          };
        }
        
        // Unique index 위반 (중복 키)
        if (createError.code === 11000) {
          return {
            success: false,
            message: `장수 번호 ${generalNo}가 이미 존재합니다. 다시 시도해주세요.`
          };
        }
        
        throw createError; // 다른 에러는 상위 catch로 전달
      }

      // 22. 턴 슬롯 생성 (최대 턴까지 휴식으로 채움)
      const turnRows = [];
      const maxTurn = gameEnv.maxTurn || 30;
      for (let i = 0; i < maxTurn; i++) {
        turnRows.push({
          session_id: sessionId,
          data: {
            general_id: generalNo,
            turn_idx: i,
            action: '휴식',
            arg: {},
            brief: '휴식'
          }
        });
      }
      if (turnRows.length > 0) {
        try {
          await GeneralTurn.insertMany(turnRows, { ordered: false });
        } catch (error: any) {
          // 중복 키 에러는 무시 (이미 존재하는 경우)
          if (error.code !== 11000) {
            console.error('Failed to insert general turns:', error);
            throw error;
          }
        }
      }

      // 23. 랭크 데이터 생성
      const rankColumns = [
        'firenum', 'warnum', 'killnum', 'deathnum', 'killcrew', 'deathcrew',
        'ttw', 'ttd', 'ttl', 'ttg', 'ttp',
        'tlw', 'tld', 'tll', 'tlg', 'tlp',
        'tsw', 'tsd', 'tsl', 'tsg', 'tsp',
        'tiw', 'tid', 'til', 'tig', 'tip',
        'betwin', 'betgold', 'betwingold',
        'killcrew_person', 'deathcrew_person',
        'occupied',
        'inherit_earned', 'inherit_spent', 'inherit_earned_dyn', 'inherit_earned_act', 'inherit_spent_dyn'
      ];

      const rankDataRows = rankColumns.map(type => ({
        session_id: sessionId,
        data: {
          id: `${generalNo}_${type}`, // unique index를 위한 id
          general_id: generalNo,
          nation_id: 0,
          type: type,
          value: 0
        }
      }));

      if (rankDataRows.length > 0) {
        try {
          await RankData.insertMany(rankDataRows, { ordered: false });
        } catch (error: any) {
          // 중복 키 에러는 무시 (이미 존재하는 경우)
          if (error.code !== 11000) {
            console.error('Failed to insert rank data:', error);
            throw error;
          }
        }
      }

      // 24. 익명 모드면 장수 번호 기반 이름 재생성
      if (blockCustomName) {
        name = this.generateObfuscatedName(generalNo);
        newGeneral.name = name;
        await newGeneral.save();
      }

      // 25. 유산 포인트 소비 기록
      if (inheritResult.requiredPoint > 0) {
        try {
          // KVStorage에서 유산 포인트 차감
          const gameStor = KVStorage.getStorage(`game_env:${sessionId}`);
          const inheritStor = KVStorage.getStorage(`inheritance_${userId}:${sessionId}`);
          
          const currentPoint = await inheritStor.getValue('previous');
          const previousPoint = Array.isArray(currentPoint) ? currentPoint[0] : (currentPoint || 0);
          
          if (previousPoint >= inheritResult.requiredPoint) {
            const newPoint = previousPoint - inheritResult.requiredPoint;
            await inheritStor.setValue('previous', [newPoint, null]);
            
            // 유산 포인트 로깅
            const [year, month] = await gameStor.getValuesAsArray(['year', 'month']);
            await UserRecord.create({
              session_id: sessionId,
              user_id: String(userId),
              log_type: 'inheritPoint',
              text: `장수 생성 시 ${inheritResult.requiredPoint} 포인트 소비`,
              year: year || 0,
              month: month || 0,
              date: new Date().toISOString()
            });
          }
        } catch (error: any) {
          console.error('Failed to log inheritance point:', error);
          // 유산 포인트 로깅 실패해도 계속 진행
        }
      }

      // 26. 로그 기록
      await this.createJoinLogs(
        sessionId,
        generalNo,
        name,
        bornCityName,
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
          city: bornCityName,
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
    const required = ['name', 'leadership', 'strength', 'intel', 'politics', 'charm', 'character'];
    for (const field of required) {
      if (data[field] === undefined || data[field] === null) {
        return { success: false, message: `${field}는 필수 항목입니다` };
      }
    }

    const { leadership, strength, intel, politics, charm } = data;
    const min = 15; // GameConst::$defaultStatMin (PHP: 15)
    const max = 90; // GameConst::$defaultStatMax (PHP: 80, 우리는 90)

    if (leadership < min || leadership > max) {
      return { success: false, message: `통솔은 ${min}~${max} 사이여야 합니다` };
    }
    if (strength < min || strength > max) {
      return { success: false, message: `무력은 ${min}~${max} 사이여야 합니다` };
    }
    if (intel < min || intel > max) {
      return { success: false, message: `지력은 ${min}~${max} 사이여야 합니다` };
    }
    if (politics < min || politics > max) {
      return { success: false, message: `정치는 ${min}~${max} 사이여야 합니다` };
    }
    if (charm < min || charm > max) {
      return { success: false, message: `매력은 ${min}~${max} 사이여야 합니다` };
    }

    const nameWidth = this.getStringWidth(data.name);
    if (nameWidth < 1 || nameWidth > 18) {
      return { success: false, message: '이름은 1~18자 사이여야 합니다' };
    }

    return { success: true };
  }

  private static sanitizeName(name: string): string {
    // PHP 버전과 동일한 로직: StringUtil::removeSpecialCharacter + textStrip
    // 1. HTML 태그 제거 (htmlPurify)
    let sanitized = name.replace(/<[^>]*>/g, '');
    
    // 2. 특정 특수문자 제거 (removeSpecialCharacter)
    // PHP: ["'ⓝⓜⓖⓞⓧ㉥\\\/`#|\-] 제거
    sanitized = sanitized.replace(/["'ⓝⓜⓖⓞⓧ㉥\\\/`#|\-]/g, '');
    
    // 3. 앞뒤 공백/제어문자 제거 (textStrip)
    // PHP: preg_replace('/^[\pZ\pC]+|[\pZ\pC]+$/u','',$str)
    sanitized = sanitized.replace(/^[\p{Z}\p{C}]+|[\p{Z}\p{C}]+$/gu, '');
    
    return sanitized;
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

  private static checkBlockCreate(gameEnv: any, session: any): string | null {
    const blockCreate = gameEnv.block_general_create || 0;
    if (blockCreate & 1) {
      return '장수 직접 생성이 불가능한 모드입니다.';
    }
    
    // 세션 상태 확인
    const sessionStatus = session.status || 'running';
    
    // preparing (가오픈): 장수 생성 허용
    // running: 장수 생성 허용
    // paused: 장수 생성 금지
    // finished/united: 장수 생성 금지
    if (sessionStatus === 'paused') {
      return '서버가 일시정지 상태입니다.';
    }
    if (sessionStatus === 'finished' || sessionStatus === 'united') {
      return '이미 종료된 서버입니다.';
    }
    
    return null;
  }

  private static getTraitByName(traitName: string): any {
    // 트레잇 이름으로 정보 반환
    switch (traitName) {
      case '천재':
        return {
          name: '천재',
          description: '하늘이 내린 재능',
          maxStat: 95,
          bonusMin: 5,
          bonusMax: 7,
          totalMin: 220,
          totalMax: 240,
          inheritCost: 1000, // 유산 포인트 소모
          goldMultiplier: 0.5, // 초기 자원 절반
          riceMultiplier: 0.5,
          ageModifier: -7 // 나이 -7 (더 어림)
        };
      case '영재':
        return {
          name: '영재',
          description: '남다른 자질',
          maxStat: 92,
          bonusMin: 4,
          bonusMax: 6,
          totalMin: 241,
          totalMax: 255,
          inheritCost: 500,
          goldMultiplier: 0.7,
          riceMultiplier: 0.7,
          ageModifier: -4
        };
      case '수재':
        return {
          name: '수재',
          description: '뛰어난 소질',
          maxStat: 91,
          bonusMin: 4,
          bonusMax: 5,
          totalMin: 256,
          totalMax: 265,
          inheritCost: 200,
          goldMultiplier: 0.85,
          riceMultiplier: 0.85,
          ageModifier: -2
        };
      case '범인':
      default:
        return {
          name: '범인',
          description: '평범한 인물',
          maxStat: 90,
          bonusMin: 3,
          bonusMax: 5,
          totalMin: 266,
          totalMax: 275,
          inheritCost: 0,
          goldMultiplier: 1.0,
          riceMultiplier: 1.0,
          ageModifier: 0
        };
    }
  }

  private static async checkDuplicates(
    sessionId: string,
    userId: number | string | undefined,
    name: string
  ): Promise<string | null> {
    if (!userId) {
      return '사용자 ID가 없습니다';
    }
    
    const existingUser = await generalRepository.findBySessionAndOwner(sessionId, String(userId));
    if (existingUser) {
      return '이미 등록하셨습니다!';
    }

    const existingName = await generalRepository.findOneByFilter({
      session_id: sessionId,
      name: name
    });
    if (existingName) {
      return '이미 있는 장수입니다. 다른 이름으로 등록해 주세요!';
    }

    return null;
  }

  private static async processInheritance(
    userId: number | string,
    sessionId: string,
    gameEnv: any,
    options: any,
    traitCost: number = 0
  ): Promise<any> {
    let requiredPoint = traitCost; // 트레잇 비용부터 시작
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

    // FUTURE: 유산 포인트 확인 로직
    // 현재는 무제한으로 허용
    const totalPoint = 999999;

    if (totalPoint < requiredPoint) {
      return { success: false, message: `유산 포인트가 부족합니다. (필요: ${requiredPoint}, 보유: ${totalPoint})` };
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
    politics: number,
    charm: number,
    userId: number | string,
    bonusMin: number = 3,
    bonusMax: number = 5
  ): any {
    if (inheritBonusStat && Array.isArray(inheritBonusStat) && inheritBonusStat.length === 5) {
      const sum = inheritBonusStat.reduce((a, b) => a + b, 0);
      if (sum >= bonusMin && sum <= bonusMax) {
        return {
          leadership: inheritBonusStat[0],
          strength: inheritBonusStat[1],
          intel: inheritBonusStat[2],
          politics: inheritBonusStat[3],
          charm: inheritBonusStat[4]
        };
      }
    }

    // PHP 원본 로직: 능력치를 가중치로 사용
    // 트레잇에 따라 보너스 개수 변동
    // PRNG (Pseudo Random Number Generator) 생성
    const seed = this.createRNG(userId);
    let rngState = seed;
    
    // LCG (Linear Congruential Generator) 구현
    const nextRandom = () => {
      rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
      return rngState;
    };
    
    const bonusRange = bonusMax - bonusMin + 1;
    const bonusCount = bonusMin + (nextRandom() % bonusRange); // bonusMin ~ bonusMax
    const stats = [leadership, strength, intel, politics, charm];
    const bonuses = [0, 0, 0, 0, 0];

    for (let i = 0; i < bonusCount; i++) {
      const totalWeight = stats[0] + stats[1] + stats[2] + stats[3] + stats[4];
      const rand = nextRandom() % totalWeight;
      let cumulative = 0;
      for (let j = 0; j < 5; j++) {
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
      intel: bonuses[2],
      politics: bonuses[3],
      charm: bonuses[4]
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
    politics: number,
    charm: number,
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
        // 능력치 기반 특기 선택 (5개 능력치 기반)
        const maxStat = Math.max(leadership, strength, intel, politics, charm);
        if (leadership === maxStat) {
          special2 = '귀모';
        } else if (strength === maxStat) {
          special2 = '정예';
        } else if (intel === maxStat) {
          special2 = '신속';
        } else if (politics === maxStat) {
          special2 = '부농';
        } else {
          special2 = '명성';
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
    rng: number,
    selectedNation?: number // 선택한 국가 ID
  ): Promise<any> {
    // 상속 도시가 지정된 경우
    if (inheritCity !== null && inheritCity !== undefined && inheritCity !== 0) {
      console.log('[determineBornCity] Looking for inherited city:', inheritCity);
      const city = await cityRepository.findByCityNum(sessionId, inheritCity);
      if (city) {
        console.log('[determineBornCity] Found inherited city:', { city: city.city, name: city.name });
        return city;
      }
      console.warn('[determineBornCity] Inherited city not found, falling back to random selection');
    }

    // 랜덤 선택 로직 (국가별 필터링)
    let cities: any[] = [];
    
    if (selectedNation !== undefined && selectedNation > 0) {
      // 특정 국가를 선택한 경우: 해당 국가의 도시만 선택
      console.log(`[determineBornCity] Looking for cities in nation ${selectedNation}`);
      cities = await cityRepository.findByFilter({
        session_id: sessionId,
        nation: selectedNation
      });
      cities = cities.slice(0, 100);
      console.log(`[determineBornCity] Found ${cities.length} cities in nation ${selectedNation}`);
      
      if (cities.length === 0) {
        console.warn(`[determineBornCity] No cities found for nation ${selectedNation}, falling back to all cities`);
      }
    }
    
    // 재야(nation 0) 또는 국가 도시가 없는 경우: 기존 로직 사용
    if (cities.length === 0) {
      // 공백지(level 5~6, nation 0) 우선
      console.log('[determineBornCity] Step 1: Looking for vacant cities (level 5-6, nation 0)');
      cities = await cityRepository.findByFilter({
        session_id: sessionId,
        level: { $gte: 5, $lte: 6 },
        nation: 0
      });
      cities = cities.slice(0, 100);
      console.log(`[determineBornCity] Found ${cities.length} vacant cities (level 5-6, nation 0)`);

      if (cities.length === 0) {
        // 공백지 없으면 아무 도시나 (level 5~6)
        console.log('[determineBornCity] Step 2: Looking for any cities (level 5-6)');
        cities = await cityRepository.findByFilter({
          session_id: sessionId,
          level: { $gte: 5, $lte: 6 }
        });
        cities = cities.slice(0, 100);
        console.log(`[determineBornCity] Found ${cities.length} cities (level 5-6)`);
      }

      if (cities.length === 0) {
        // level 조건 없이 nation 0인 도시
        console.log('[determineBornCity] Step 3: Looking for vacant cities (any level, nation 0)');
        cities = await cityRepository.findByFilter({
          session_id: sessionId,
          nation: 0
        });
        cities = cities.slice(0, 100);
        console.log(`[determineBornCity] Found ${cities.length} vacant cities (nation 0)`);
      }

      if (cities.length === 0) {
        // 아무 도시나
        console.log('[determineBornCity] Step 4: Looking for any cities');
        cities = await cityRepository.findByFilter({
          session_id: sessionId
        });
        cities = cities.slice(0, 100);
        console.log(`[determineBornCity] Found ${cities.length} total cities`);
      }
    }

    if (cities.length === 0) {
      console.error('[determineBornCity] CRITICAL: No cities found in session:', sessionId);
      return null;
    }

    const selectedCity = cities[Math.abs(rng) % cities.length];
    
    // 도시 필드 normalize (최상위 필드 우선, 없으면 data에서 가져오기)
    if (!selectedCity.city && selectedCity.data?.city) {
      selectedCity.city = selectedCity.data.city;
    }
    if (!selectedCity.name && selectedCity.data?.name) {
      selectedCity.name = selectedCity.data.name;
    }
    
    // 디버깅: 선택된 도시 정보 로그
    console.log('[determineBornCity] Selected city (normalized):', {
      city: selectedCity.city,
      name: selectedCity.name,
      nation: selectedCity.nation || selectedCity.data?.nation,
      level: selectedCity.level || selectedCity.data?.level,
      hasDataCity: !!selectedCity.data?.city,
      hasDataName: !!selectedCity.data?.name
    });
    
    // CRITICAL: city 번호가 여전히 없으면 에러
    if (!selectedCity.city) {
      console.error('[determineBornCity] CRITICAL ERROR: city field is missing!', {
        selectedCity,
        dataKeys: Object.keys(selectedCity.data || {}),
        topLevelKeys: Object.keys(selectedCity)
      });
    }
    
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
    const generals = await generalRepository.findByFilter({
      session_id: sessionId,
      'data.nation': { $ne: 0 },
      'data.npc': { $lt: 4 }
    }).sort({ 'data.experience': 1 }).exec();

    if (generals.length === 0) {
      return 0;
    }

    const targetIndex = Math.round(generals.length * 0.2);
    const targetExp = generals[targetIndex]?.data?.experience || 0;
    return Math.round(targetExp * 0.8);
  }

  private static calculateTurntime(
    turnterm: number,
    sessionTurntime: string | Date | undefined,
    rng: number,
    inheritTurntimeZone: number | null
  ): Date {
    const now = new Date();
    
    let baseTime: Date;
    if (sessionTurntime) {
      baseTime = new Date(sessionTurntime);
    } else {
      baseTime = now;
    }
    
    let turntime: Date;
    
    // 상속 턴타임 처리 (PHP Join.php:357-367)
    if (inheritTurntimeZone !== null && inheritTurntimeZone >= 0) {
      // inheritTurntimeZone: 0-59 사이의 분 단위 존
      // PHP: $inheritTurntime = $inheritTurntimeZone * $admin['turnterm']
      let inheritSeconds = inheritTurntimeZone * turnterm * 60;
      
      // 추가 랜덤: 0 ~ (turnterm - 1)분
      const extraMinutes = Math.abs(rng % turnterm);
      inheritSeconds += extraMinutes * 60;
      
      // 마이크로초 추가 (0 ~ 999999 마이크로초 = 0 ~ 999.999 밀리초)
      const randMicroseconds = Math.abs(rng * 7919) % 1000000; // 다른 시드 사용
      const randMilliseconds = randMicroseconds / 1000;
      
      // cutTurn: 현재 turntime을 turnterm 단위로 내림
      const cutTime = this.cutTurn(baseTime, turnterm);
      
      turntime = new Date(cutTime.getTime() + inheritSeconds * 1000 + randMilliseconds);
      
      console.log(`[Join] Inheritance turntime: zone=${inheritTurntimeZone}, base=${cutTime.toISOString()}, offset=${inheritSeconds}초`);
    } else {
      // 기본 랜덤 턴타임 (PHP getRandTurn)
      // 0 ~ (60 * turnterm - 1) 초 사이의 랜덤 값
      const randSeconds = Math.abs(rng) % (60 * turnterm);
      
      // 마이크로초 추가 (0.000000 ~ 0.999999초 = 0 ~ 999.999 밀리초)
      const randMicroseconds = Math.abs(rng * 7919) % 1000000;
      const randMilliseconds = randMicroseconds / 1000;
      
      turntime = new Date(baseTime.getTime() + randSeconds * 1000 + randMilliseconds);
    }
    
    // 계산된 turntime이 현재 시간보다 과거면 turnterm을 더해서 다음 턴으로
    if (now.getTime() >= turntime.getTime()) {
      turntime = new Date(turntime.getTime() + turnterm * 60 * 1000);
    }
    
    const minutesUntilTurn = Math.round((turntime.getTime() - now.getTime()) / 60000);
    console.log(`[Join] Set turntime: ${turntime.toISOString()} (${minutesUntilTurn}분 후, base: ${baseTime.toISOString()})`);
    
    return turntime;
  }
  
  /**
   * PHP cutTurn 구현: turntime을 turnterm 단위로 내림
   */
  private static cutTurn(time: Date, turnterm: number): Date {
    const turntermMs = turnterm * 60 * 1000;
    const timeMs = time.getTime();
    const remainder = timeMs % turntermMs;
    return new Date(timeMs - remainder);
  }

  private static async determineFace(
    userId: number | string,
    showImgLevel: number,
    usePic: boolean
  ): Promise<{ picture: string | null; imgsvr: number }> {
    // 이미지 표시 레벨이 1 이상이고 사용자가 이미지 사용을 원하는 경우
    if (showImgLevel >= 1 && usePic) {
      try {
        // User 모델에서 이미지 정보 가져오기
        // RootDB는 별도 연결이 필요하지만, 일단 User 모델에서 시도
        const user = await User.findById(userId);
        
        if (user) {
          // User 모델에 picture, imgsvr 필드가 있는 경우
          const picture = user.picture || user.data?.picture || null;
          const imgsvr = user.imgsvr || user.data?.imgsvr || 0;
          
          if (picture) {
            return {
              picture: picture,
              imgsvr: imgsvr || 0
            };
          }
        }
      } catch (error: any) {
        // User 조회 실패 시 기본값 사용
        console.error('Failed to get user image info:', error);
      }
    }

    // 기본값: 이미지 없음
    return {
      picture: null,
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
        log_type: 'global',
        year,
        month,
        text: `${cityName}에서 ${name}라는 기재가 천하에 이름을 알립니다.`,
        created_at: new Date()
      });
      logs.push({
        session_id: sessionId,
        general_id: 0,
        log_type: 'global',
        year,
        month,
        text: `${specialName} 특기를 가진 천재의 등장으로 온 천하가 떠들썩합니다.`,
        created_at: new Date()
      });
    } else {
      logs.push({
        session_id: sessionId,
        general_id: 0,
        log_type: 'global',
        year,
        month,
        text: `${cityName}에서 ${name}라는 호걸이 천하에 이름을 알립니다.`,
        created_at: new Date()
      });
    }

    // 장수 개인 로그
    logs.push({
      session_id: sessionId,
      general_id: generalId,
      log_type: 'history',
      year,
      month,
      text: `${name}, ${cityName}에서 큰 뜻을 품다.`,
      created_at: new Date()
    });

    logs.push({
      session_id: sessionId,
      general_id: generalId,
      log_type: 'action',
      year,
      month,
      text: '삼국지 모의전투 PHP의 세계에 오신 것을 환영합니다 ^o^',
      created_at: new Date()
    });

    logs.push({
      session_id: sessionId,
      general_id: generalId,
      log_type: 'action',
      year,
      month,
      text: `통솔 ${bonusStats.leadership} 무력 ${bonusStats.strength} 지력 ${bonusStats.intel} 정치 ${bonusStats.politics} 매력 ${bonusStats.charm} 의 보너스를 받으셨습니다.`,
      created_at: new Date()
    });

    logs.push({
      session_id: sessionId,
      general_id: generalId,
      log_type: 'action',
      year,
      month,
      text: `연령은 ${age}세로 시작합니다.`,
      created_at: new Date()
    });

    if (isGenius) {
      logs.push({
        session_id: sessionId,
        general_id: generalId,
        log_type: 'action',
        year,
        month,
        text: `축하합니다! 천재로 태어나 처음부터 ${specialName} 특기를 가지게 됩니다!`,
        created_at: new Date()
      });
    }

    if (logs.length > 0) {
      await GeneralRecord.insertMany(logs);
    }
  }

  private static createRNG(userId: number | string): number {
    const data = `MakeGeneral-${String(userId)}-${Date.now()}`;
    const hash = crypto.createHash('sha256').update(data).digest();
    return Math.abs(hash.readInt32BE(0));
  }
}
