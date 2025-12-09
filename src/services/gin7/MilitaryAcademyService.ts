/**
 * MilitaryAcademyService - 사관학교 시스템
 * 
 * 기능:
 * - 사관학교 입학 (enrollCadet)
 * - 교육 과정 (전술/공학/의무)
 * - 졸업 및 임관 (graduate)
 * - 교관 배치 효과
 */

import { EventEmitter } from 'events';
import { Planet, IPlanet, IPlanetFacility } from '../../models/gin7/Planet';
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';
import { TimeEngine, GIN7_EVENTS, MonthStartPayload } from '../../core/gin7/TimeEngine';
import { logger } from '../../common/logger';

// ============================================================
// Enums & Types
// ============================================================

/**
 * 교육 과정 유형
 */
export enum AcademyCourse {
  TACTICS = 'TACTICS',           // 전술과 - 함대 지휘
  STRATEGY = 'STRATEGY',         // 전략과 - 대규모 작전 계획
  ENGINEERING = 'ENGINEERING',   // 공학과 - 기술/정비
  MEDICAL = 'MEDICAL',           // 의무과 - 의료
  NAVIGATION = 'NAVIGATION',     // 항법과 - 조종/항해
  INTELLIGENCE = 'INTELLIGENCE', // 정보과 - 첩보/암호
  COMMAND = 'COMMAND',           // 지휘과 - 고급 지휘관
}

/**
 * 생도 상태
 */
export enum CadetStatus {
  ENROLLED = 'ENROLLED',         // 입학
  TRAINING = 'TRAINING',         // 훈련 중
  FINAL_EXAM = 'FINAL_EXAM',     // 최종 시험
  GRADUATED = 'GRADUATED',       // 졸업
  DROPPED_OUT = 'DROPPED_OUT',   // 중퇴
}

/**
 * 생도 정보
 */
export interface Cadet {
  cadetId: string;
  name: string;
  sessionId: string;
  factionId: string;
  academyId: string;            // 소속 사관학교 ID
  planetId: string;             // 사관학교 위치
  
  // 상태
  status: CadetStatus;
  course: AcademyCourse;
  
  // 진행도
  enrolledAt: Date;
  graduationDate?: Date;
  trainingProgress: number;     // 0-100
  currentSemester: number;      // 1-8 (4년제)
  
  // 성적
  grades: {
    theory: number;             // 이론 (0-100)
    practical: number;          // 실습 (0-100)
    physical: number;           // 체력 (0-100)
    leadership: number;         // 리더십 (0-100)
  };
  
  // 잠재 스탯 (졸업 시 캐릭터에 반영)
  potentialStats: {
    command: number;
    might: number;
    intellect: number;
    politics: number;
    charm: number;
  };
  
  // 습득한 스킬
  skills: string[];
  
  // 메타데이터
  instructorId?: string;        // 담당 교관
  data?: Record<string, unknown>;
}

/**
 * 사관학교 시설 확장 데이터
 */
export interface MilitaryAcademyData {
  academyId: string;
  planetId: string;
  name: string;
  level: number;                // 1-10
  
  // 용량
  maxCadets: number;
  currentCadets: number;
  
  // 교육 품질
  educationQuality: number;     // 0-100
  
  // 교관진
  instructors: Array<{
    characterId: string;
    specialization: AcademyCourse;
    teachingSkill: number;      // 0-100
  }>;
  
  // 교육 과정 제공
  availableCourses: AcademyCourse[];
  
  // 통계
  totalGraduates: number;
  averageGraduationGrade: number;
}

// ============================================================
// 과정별 정의
// ============================================================

const COURSE_DEFINITIONS: Record<AcademyCourse, {
  name: string;
  nameKo: string;
  duration: number;             // 학기 수
  primaryStat: keyof Cadet['potentialStats'];
  secondaryStat: keyof Cadet['potentialStats'];
  skills: string[];
  requirements: {
    intellect?: number;
    might?: number;
  };
}> = {
  [AcademyCourse.TACTICS]: {
    name: 'Tactical Studies',
    nameKo: '전술과',
    duration: 8,
    primaryStat: 'command',
    secondaryStat: 'intellect',
    skills: ['FLEET_TACTICS', 'COMBAT_PLANNING', 'FORMATION_CONTROL'],
    requirements: { intellect: 60 },
  },
  [AcademyCourse.STRATEGY]: {
    name: 'Strategic Studies',
    nameKo: '전략과',
    duration: 10,
    primaryStat: 'intellect',
    secondaryStat: 'command',
    skills: ['GRAND_STRATEGY', 'CAMPAIGN_PLANNING', 'RESOURCE_ALLOCATION', 'THEATER_COMMAND'],
    requirements: { intellect: 75 },
  },
  [AcademyCourse.ENGINEERING]: {
    name: 'Engineering',
    nameKo: '공학과',
    duration: 8,
    primaryStat: 'intellect',
    secondaryStat: 'might',
    skills: ['SHIP_REPAIR', 'SYSTEM_OPTIMIZATION', 'DAMAGE_CONTROL'],
    requirements: { intellect: 70 },
  },
  [AcademyCourse.MEDICAL]: {
    name: 'Medical Corps',
    nameKo: '의무과',
    duration: 8,
    primaryStat: 'intellect',
    secondaryStat: 'charm',
    skills: ['EMERGENCY_MEDICINE', 'SURGERY', 'CREW_MORALE'],
    requirements: { intellect: 65 },
  },
  [AcademyCourse.NAVIGATION]: {
    name: 'Navigation',
    nameKo: '항법과',
    duration: 6,
    primaryStat: 'intellect',
    secondaryStat: 'command',
    skills: ['WARP_NAVIGATION', 'EVASIVE_MANEUVER', 'STELLAR_CARTOGRAPHY'],
    requirements: { intellect: 55 },
  },
  [AcademyCourse.INTELLIGENCE]: {
    name: 'Intelligence',
    nameKo: '정보과',
    duration: 6,
    primaryStat: 'intellect',
    secondaryStat: 'politics',
    skills: ['CODE_BREAKING', 'ESPIONAGE', 'COUNTER_INTELLIGENCE'],
    requirements: { intellect: 70 },
  },
  [AcademyCourse.COMMAND]: {
    name: 'Command School',
    nameKo: '지휘과',
    duration: 10,
    primaryStat: 'command',
    secondaryStat: 'charm',
    skills: ['STRATEGIC_COMMAND', 'FLEET_COORDINATION', 'INSPIRATION'],
    requirements: { intellect: 75 },
  },
};

// 기본 훈련 비용 (학기당)
const BASE_TUITION_COST = 500;

// 졸업 성적 기준
const GRADUATION_THRESHOLD = 60;

// ============================================================
// Request/Response Types
// ============================================================

export interface EnrollCadetRequest {
  sessionId: string;
  factionId: string;
  planetId: string;
  cadetName: string;
  course: AcademyCourse;
  potentialStats?: {
    command?: number;
    might?: number;
    intellect?: number;
    politics?: number;
    charm?: number;
  };
}

export interface EnrollCadetResult {
  success: boolean;
  cadet?: Cadet;
  enrollmentCost: number;
  error?: string;
}

export interface GraduateResult {
  success: boolean;
  character?: IGin7Character;
  finalGrade: number;
  rank: string;
  skills: string[];
  error?: string;
}

export interface AssignInstructorRequest {
  sessionId: string;
  academyId: string;
  characterId: string;
  specialization: AcademyCourse;
}

// ============================================================
// MilitaryAcademyService Class
// ============================================================

export class MilitaryAcademyService extends EventEmitter {
  private static instance: MilitaryAcademyService;
  
  // 생도 저장소
  private cadets: Map<string, Cadet> = new Map();
  
  // 사관학교 데이터
  private academies: Map<string, MilitaryAcademyData> = new Map();

  private constructor() {
    super();
    this.setupTimeEngineEvents();
    logger.info('[MilitaryAcademyService] Initialized');
  }

  public static getInstance(): MilitaryAcademyService {
    if (!MilitaryAcademyService.instance) {
      MilitaryAcademyService.instance = new MilitaryAcademyService();
    }
    return MilitaryAcademyService.instance;
  }

  /**
   * TimeEngine 이벤트 연동
   */
  private setupTimeEngineEvents(): void {
    try {
      const timeEngine = TimeEngine.getInstance();
      
      // 월 시작 시 훈련 진행
      timeEngine.on(GIN7_EVENTS.MONTH_START, async (payload: MonthStartPayload) => {
        await this.processMonthlyTraining(payload.sessionId);
      });
    } catch (error) {
      logger.warn('[MilitaryAcademyService] TimeEngine not available yet');
    }
  }

  // ============================================================
  // 사관학교 초기화
  // ============================================================

  /**
   * 행성에 사관학교 초기화
   */
  public async initializeAcademy(
    sessionId: string,
    planetId: string,
    facility: IPlanetFacility,
  ): Promise<MilitaryAcademyData> {
    const academyId = `ACADEMY-${sessionId}-${planetId}-${facility.facilityId}`;
    
    const academy: MilitaryAcademyData = {
      academyId,
      planetId,
      name: `${planetId} 사관학교`,
      level: facility.level,
      maxCadets: 50 + facility.level * 20,
      currentCadets: 0,
      educationQuality: 50 + facility.level * 5,
      instructors: [],
      availableCourses: this.getAvailableCourses(facility.level),
      totalGraduates: 0,
      averageGraduationGrade: 0,
    };

    const key = `${sessionId}-${academyId}`;
    this.academies.set(key, academy);

    logger.info(`[MilitaryAcademyService] Initialized academy ${academyId} on planet ${planetId}`);

    return academy;
  }

  /**
   * 레벨에 따른 개설 과정
   */
  private getAvailableCourses(level: number): AcademyCourse[] {
    const courses: AcademyCourse[] = [AcademyCourse.NAVIGATION];
    
    if (level >= 2) courses.push(AcademyCourse.TACTICS);
    if (level >= 3) courses.push(AcademyCourse.ENGINEERING);
    if (level >= 4) courses.push(AcademyCourse.MEDICAL);
    if (level >= 5) courses.push(AcademyCourse.INTELLIGENCE);
    if (level >= 6) courses.push(AcademyCourse.STRATEGY);
    if (level >= 7) courses.push(AcademyCourse.COMMAND);
    
    return courses;
  }

  // ============================================================
  // 입학
  // ============================================================

  /**
   * 생도 입학
   */
  public async enrollCadet(request: EnrollCadetRequest): Promise<EnrollCadetResult> {
    const { sessionId, factionId, planetId, cadetName, course, potentialStats } = request;

    // 1. 행성 및 사관학교 확인
    const planet = await Planet.findOne({ sessionId, planetId });
    if (!planet) {
      return {
        success: false,
        enrollmentCost: 0,
        error: '행성을 찾을 수 없습니다.',
      };
    }

    const academyFacility = planet.facilities?.find(f => f.type === 'military_academy');
    if (!academyFacility || !academyFacility.isOperational) {
      return {
        success: false,
        enrollmentCost: 0,
        error: '운영 중인 사관학교가 없습니다.',
      };
    }

    // 2. 사관학교 데이터 확인/생성
    const academyId = `ACADEMY-${sessionId}-${planetId}-${academyFacility.facilityId}`;
    const academyKey = `${sessionId}-${academyId}`;
    let academy = this.academies.get(academyKey);
    
    if (!academy) {
      academy = await this.initializeAcademy(sessionId, planetId, academyFacility);
    }

    // 3. 정원 확인
    if (academy.currentCadets >= academy.maxCadets) {
      return {
        success: false,
        enrollmentCost: 0,
        error: '사관학교 정원이 초과되었습니다.',
      };
    }

    // 4. 과정 개설 확인
    if (!academy.availableCourses.includes(course)) {
      return {
        success: false,
        enrollmentCost: 0,
        error: `${COURSE_DEFINITIONS[course].nameKo}은(는) 이 사관학교에서 제공하지 않습니다.`,
      };
    }

    // 5. 입학 요건 확인
    const courseDef = COURSE_DEFINITIONS[course];
    const stats = potentialStats || { command: 50, might: 50, intellect: 50, politics: 50, charm: 50 };
    
    if (courseDef.requirements.intellect && stats.intellect && stats.intellect < courseDef.requirements.intellect) {
      return {
        success: false,
        enrollmentCost: 0,
        error: `입학 요건 미달 (지력 ${courseDef.requirements.intellect} 이상 필요)`,
      };
    }

    // 6. 비용 계산 및 차감
    const enrollmentCost = BASE_TUITION_COST * courseDef.duration;
    if (planet.resources.credits < enrollmentCost) {
      return {
        success: false,
        enrollmentCost,
        error: `자금 부족 (필요: ${enrollmentCost})`,
      };
    }

    planet.resources.credits -= enrollmentCost;
    await planet.save();

    // 7. 생도 생성
    const cadetId = `CADET-${sessionId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const cadet: Cadet = {
      cadetId,
      name: cadetName,
      sessionId,
      factionId,
      academyId,
      planetId,
      status: CadetStatus.ENROLLED,
      course,
      enrolledAt: new Date(),
      trainingProgress: 0,
      currentSemester: 1,
      grades: {
        theory: 50 + Math.floor(Math.random() * 20),
        practical: 50 + Math.floor(Math.random() * 20),
        physical: 50 + Math.floor(Math.random() * 20),
        leadership: 50 + Math.floor(Math.random() * 20),
      },
      potentialStats: {
        command: stats.command || 50,
        might: stats.might || 50,
        intellect: stats.intellect || 50,
        politics: stats.politics || 50,
        charm: stats.charm || 50,
      },
      skills: [],
    };

    // 8. 저장
    const cadetKey = `${sessionId}-${cadetId}`;
    this.cadets.set(cadetKey, cadet);
    academy.currentCadets++;
    this.academies.set(academyKey, academy);

    // 9. 이벤트 발생
    this.emit('cadet:enrolled', {
      sessionId,
      factionId,
      academyId,
      cadet,
      enrollmentCost,
    });

    logger.info(`[MilitaryAcademyService] Cadet ${cadetName} enrolled in ${courseDef.nameKo} at ${academyId}`);

    return {
      success: true,
      cadet,
      enrollmentCost,
    };
  }

  // ============================================================
  // 훈련 진행
  // ============================================================

  /**
   * 월간 훈련 처리
   */
  private async processMonthlyTraining(sessionId: string): Promise<void> {
    const graduationQueue: Cadet[] = [];

    for (const [key, cadet] of this.cadets) {
      if (!key.startsWith(sessionId)) continue;
      if (cadet.status !== CadetStatus.ENROLLED && cadet.status !== CadetStatus.TRAINING) continue;

      cadet.status = CadetStatus.TRAINING;

      // 1. 훈련 진행도 증가
      const courseDef = COURSE_DEFINITIONS[cadet.course];
      const progressPerMonth = 100 / (courseDef.duration * 2); // 한 학기 = 2개월
      
      // 교관 보너스
      const instructorBonus = this.calculateInstructorBonus(sessionId, cadet.academyId, cadet.course);
      const actualProgress = progressPerMonth * (1 + instructorBonus);
      
      cadet.trainingProgress = Math.min(100, cadet.trainingProgress + actualProgress);

      // 2. 학기 업데이트
      const newSemester = Math.ceil(cadet.trainingProgress / (100 / courseDef.duration));
      if (newSemester > cadet.currentSemester) {
        cadet.currentSemester = newSemester;
        this.onSemesterComplete(cadet);
      }

      // 3. 성적 변동
      this.updateGrades(cadet, instructorBonus);

      // 4. 스탯 성장
      this.growPotentialStats(cadet);

      // 5. 졸업 체크
      if (cadet.trainingProgress >= 100) {
        cadet.status = CadetStatus.FINAL_EXAM;
        graduationQueue.push(cadet);
      }

      this.cadets.set(key, cadet);
    }

    // 졸업 처리
    for (const cadet of graduationQueue) {
      await this.processGraduation(cadet);
    }

    logger.debug(`[MilitaryAcademyService] Monthly training processed for session ${sessionId}`);
  }

  /**
   * 학기 완료 처리
   */
  private onSemesterComplete(cadet: Cadet): void {
    const courseDef = COURSE_DEFINITIONS[cadet.course];
    
    // 스킬 습득 (특정 학기에)
    const skillSemester = Math.ceil(courseDef.duration / courseDef.skills.length);
    const skillIndex = Math.floor((cadet.currentSemester - 1) / skillSemester);
    
    if (skillIndex < courseDef.skills.length && !cadet.skills.includes(courseDef.skills[skillIndex])) {
      const avgGrade = this.calculateAverageGrade(cadet);
      // 성적이 일정 이상이면 스킬 습득
      if (avgGrade >= 50) {
        cadet.skills.push(courseDef.skills[skillIndex]);
        
        this.emit('cadet:skillLearned', {
          cadetId: cadet.cadetId,
          skill: courseDef.skills[skillIndex],
          semester: cadet.currentSemester,
        });
      }
    }
  }

  /**
   * 성적 업데이트
   */
  private updateGrades(cadet: Cadet, instructorBonus: number): void {
    // 무작위 성적 변동 (-5 ~ +10)
    const baseChange = (Math.random() - 0.3) * 15;
    const bonusChange = instructorBonus * 5;
    
    const fields: (keyof Cadet['grades'])[] = ['theory', 'practical', 'physical', 'leadership'];
    const randomField = fields[Math.floor(Math.random() * fields.length)];
    
    cadet.grades[randomField] = Math.max(0, Math.min(100, 
      cadet.grades[randomField] + baseChange + bonusChange
    ));
  }

  /**
   * 잠재 스탯 성장
   */
  private growPotentialStats(cadet: Cadet): void {
    const courseDef = COURSE_DEFINITIONS[cadet.course];
    const avgGrade = this.calculateAverageGrade(cadet);
    
    // 성적에 비례한 스탯 성장
    const growthRate = avgGrade / 1000; // 0 ~ 0.1 per month
    
    cadet.potentialStats[courseDef.primaryStat] = Math.min(100,
      cadet.potentialStats[courseDef.primaryStat] + growthRate * 2
    );
    cadet.potentialStats[courseDef.secondaryStat] = Math.min(100,
      cadet.potentialStats[courseDef.secondaryStat] + growthRate
    );
  }

  /**
   * 교관 보너스 계산
   */
  private calculateInstructorBonus(sessionId: string, academyId: string, course: AcademyCourse): number {
    const key = `${sessionId}-${academyId}`;
    const academy = this.academies.get(key);
    if (!academy) return 0;

    const instructor = academy.instructors.find(i => i.specialization === course);
    if (!instructor) return 0;

    return instructor.teachingSkill / 200; // 0 ~ 0.5 bonus
  }

  // ============================================================
  // 졸업
  // ============================================================

  /**
   * 졸업 처리
   */
  private async processGraduation(cadet: Cadet): Promise<void> {
    const avgGrade = this.calculateAverageGrade(cadet);
    
    if (avgGrade < GRADUATION_THRESHOLD) {
      // 낙제
      cadet.status = CadetStatus.DROPPED_OUT;
      this.emit('cadet:droppedOut', {
        cadetId: cadet.cadetId,
        reason: 'failed_graduation',
        finalGrade: avgGrade,
      });
      return;
    }

    // 졸업 성공
    const result = await this.graduate(cadet.sessionId, cadet.cadetId);
    
    if (result.success) {
      logger.info(`[MilitaryAcademyService] Cadet ${cadet.name} graduated with grade ${result.finalGrade}`);
    }
  }

  /**
   * 졸업 및 임관
   */
  public async graduate(sessionId: string, cadetId: string): Promise<GraduateResult> {
    const cadetKey = `${sessionId}-${cadetId}`;
    const cadet = this.cadets.get(cadetKey);
    
    if (!cadet) {
      return {
        success: false,
        finalGrade: 0,
        rank: '',
        skills: [],
        error: '생도를 찾을 수 없습니다.',
      };
    }

    if (cadet.trainingProgress < 100) {
      return {
        success: false,
        finalGrade: 0,
        rank: '',
        skills: [],
        error: '아직 교육 과정이 완료되지 않았습니다.',
      };
    }

    // 1. 최종 성적 계산
    const finalGrade = this.calculateAverageGrade(cadet);
    
    if (finalGrade < GRADUATION_THRESHOLD) {
      cadet.status = CadetStatus.DROPPED_OUT;
      this.cadets.set(cadetKey, cadet);
      return {
        success: false,
        finalGrade,
        rank: '',
        skills: [],
        error: `졸업 기준 미달 (${GRADUATION_THRESHOLD}점 이상 필요)`,
      };
    }

    // 2. 임관 계급 결정
    const rank = this.determineCommissionRank(finalGrade, cadet.course);

    // 3. 캐릭터 생성
    const characterId = `CHAR-${sessionId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newCharacter = new Gin7Character({
      characterId,
      sessionId,
      ownerId: cadet.factionId,
      name: cadet.name,
      stats: {
        command: Math.floor(cadet.potentialStats.command),
        might: Math.floor(cadet.potentialStats.might),
        intellect: Math.floor(cadet.potentialStats.intellect),
        politics: Math.floor(cadet.potentialStats.politics),
        charm: Math.floor(cadet.potentialStats.charm),
      },
      skills: cadet.skills,
      traits: [
        `academy_graduate_${cadet.course.toLowerCase()}`,
        finalGrade >= 90 ? 'honor_graduate' : finalGrade >= 80 ? 'distinguished' : 'certified',
      ],
      state: 'idle',
      data: {
        academyGraduate: true,
        graduationGrade: finalGrade,
        course: cadet.course,
        commissionRank: rank,
      },
    });

    await newCharacter.save();

    // 4. 생도 상태 업데이트
    cadet.status = CadetStatus.GRADUATED;
    cadet.graduationDate = new Date();
    this.cadets.set(cadetKey, cadet);

    // 5. 사관학교 통계 업데이트
    const academyKey = `${sessionId}-${cadet.academyId}`;
    const academy = this.academies.get(academyKey);
    if (academy) {
      academy.currentCadets--;
      academy.totalGraduates++;
      const totalGrades = academy.averageGraduationGrade * (academy.totalGraduates - 1) + finalGrade;
      academy.averageGraduationGrade = totalGrades / academy.totalGraduates;
      this.academies.set(academyKey, academy);
    }

    // 6. 이벤트 발생
    this.emit('cadet:graduated', {
      sessionId,
      cadetId,
      characterId,
      name: cadet.name,
      course: cadet.course,
      finalGrade,
      rank,
      skills: cadet.skills,
    });

    return {
      success: true,
      character: newCharacter,
      finalGrade,
      rank,
      skills: cadet.skills,
    };
  }

  /**
   * 임관 계급 결정
   */
  private determineCommissionRank(grade: number, course: AcademyCourse): string {
    // 지휘과는 한 단계 높은 계급
    const isCommandCourse = course === AcademyCourse.COMMAND;
    
    if (grade >= 95) {
      return isCommandCourse ? 'CAPTAIN' : 'LIEUTENANT_COMMANDER';
    } else if (grade >= 85) {
      return isCommandCourse ? 'LIEUTENANT_COMMANDER' : 'LIEUTENANT';
    } else if (grade >= 75) {
      return isCommandCourse ? 'LIEUTENANT' : 'LIEUTENANT_JG';
    } else {
      return isCommandCourse ? 'LIEUTENANT_JG' : 'ENSIGN';
    }
  }

  // ============================================================
  // 교관 관리
  // ============================================================

  /**
   * 교관 배치
   */
  public async assignInstructor(request: AssignInstructorRequest): Promise<{
    success: boolean;
    teachingSkill: number;
    error?: string;
  }> {
    const { sessionId, academyId, characterId, specialization } = request;

    // 캐릭터 확인
    const character = await Gin7Character.findOne({ sessionId, characterId });
    if (!character) {
      return { success: false, teachingSkill: 0, error: '캐릭터를 찾을 수 없습니다.' };
    }

    // 사관학교 확인
    const academyKey = `${sessionId}-${academyId}`;
    const academy = this.academies.get(academyKey);
    if (!academy) {
      return { success: false, teachingSkill: 0, error: '사관학교를 찾을 수 없습니다.' };
    }

    // 교관 자질 계산
    const teachingSkill = this.calculateTeachingSkill(character, specialization);

    // 기존 교관 제거 (같은 전공)
    academy.instructors = academy.instructors.filter(i => i.specialization !== specialization);

    // 새 교관 추가
    academy.instructors.push({
      characterId,
      specialization,
      teachingSkill,
    });

    // 교육 품질 업데이트
    const avgTeachingSkill = academy.instructors.reduce((sum, i) => sum + i.teachingSkill, 0) / academy.instructors.length;
    academy.educationQuality = Math.min(100, academy.educationQuality + avgTeachingSkill * 0.1);

    this.academies.set(academyKey, academy);

    this.emit('instructor:assigned', {
      sessionId,
      academyId,
      characterId,
      characterName: character.name,
      specialization,
      teachingSkill,
    });

    logger.info(`[MilitaryAcademyService] ${character.name} assigned as instructor at ${academyId}`);

    return {
      success: true,
      teachingSkill,
    };
  }

  /**
   * 교관 자질 계산
   */
  private calculateTeachingSkill(character: IGin7Character, specialization: AcademyCourse): number {
    const courseDef = COURSE_DEFINITIONS[specialization];
    
    // 기본 능력치 기반
    const primaryStat = character.stats[courseDef.primaryStat] || 50;
    const secondaryStat = character.stats[courseDef.secondaryStat] || 50;
    
    // 매력 (교육 능력)
    const charm = character.stats.charm || 50;
    
    // 관련 스킬 보너스
    const hasRelevantSkill = character.skills?.some(s => courseDef.skills.includes(s)) || false;
    const skillBonus = hasRelevantSkill ? 10 : 0;
    
    return Math.min(100, (primaryStat * 0.4 + secondaryStat * 0.3 + charm * 0.3 + skillBonus));
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  private calculateAverageGrade(cadet: Cadet): number {
    const { theory, practical, physical, leadership } = cadet.grades;
    return (theory + practical + physical + leadership) / 4;
  }

  // ============================================================
  // 조회
  // ============================================================

  /**
   * 사관학교 정보 조회
   */
  public getAcademy(sessionId: string, academyId: string): MilitaryAcademyData | undefined {
    const key = `${sessionId}-${academyId}`;
    return this.academies.get(key);
  }

  /**
   * 행성의 사관학교 조회
   */
  public async getAcademyOnPlanet(sessionId: string, planetId: string): Promise<MilitaryAcademyData | null> {
    const planet = await Planet.findOne({ sessionId, planetId });
    if (!planet) return null;

    const facility = planet.facilities?.find(f => f.type === 'military_academy');
    if (!facility) return null;

    const academyId = `ACADEMY-${sessionId}-${planetId}-${facility.facilityId}`;
    const key = `${sessionId}-${academyId}`;
    return this.academies.get(key) || null;
  }

  /**
   * 생도 조회
   */
  public getCadet(sessionId: string, cadetId: string): Cadet | undefined {
    const key = `${sessionId}-${cadetId}`;
    return this.cadets.get(key);
  }

  /**
   * 사관학교 생도 목록 조회
   */
  public getCadetsInAcademy(sessionId: string, academyId: string): Cadet[] {
    const cadets: Cadet[] = [];
    
    for (const [key, cadet] of this.cadets) {
      if (key.startsWith(sessionId) && cadet.academyId === academyId) {
        cadets.push(cadet);
      }
    }
    
    return cadets;
  }

  /**
   * 세력 전체 생도 조회
   */
  public getFactionCadets(sessionId: string, factionId: string): Cadet[] {
    const cadets: Cadet[] = [];
    
    for (const [key, cadet] of this.cadets) {
      if (key.startsWith(sessionId) && cadet.factionId === factionId) {
        cadets.push(cadet);
      }
    }
    
    return cadets;
  }

  /**
   * 과정 정의 조회
   */
  public getCourseDefinition(course: AcademyCourse): typeof COURSE_DEFINITIONS[AcademyCourse] {
    return COURSE_DEFINITIONS[course];
  }

  /**
   * 전체 과정 목록 조회
   */
  public getAllCourses(): typeof COURSE_DEFINITIONS {
    return COURSE_DEFINITIONS;
  }
}

export const militaryAcademyService = MilitaryAcademyService.getInstance();
export default MilitaryAcademyService;

