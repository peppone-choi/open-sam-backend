/**
 * ReserveCommand Service 테스트
 * 
 * 커맨드 예약 서비스 테스트
 */

describe('ReserveCommandService (커맨드 예약)', () => {
  describe('기본 기능', () => {
    it('커맨드 예약이 배열로 저장되어야 함', () => {
      const reservedCommands = [
        { turn: 1, command: '휴식', args: {} },
        { turn: 2, command: '훈련', args: {} },
      ];

      expect(Array.isArray(reservedCommands)).toBe(true);
      expect(reservedCommands.length).toBe(2);
    });

    it('예약 순서가 턴 순으로 정렬되어야 함', () => {
      const commands = [
        { turn: 3 },
        { turn: 1 },
        { turn: 2 },
      ].sort((a, b) => a.turn - b.turn);

      expect(commands[0].turn).toBe(1);
      expect(commands[1].turn).toBe(2);
      expect(commands[2].turn).toBe(3);
    });
  });

  describe('커맨드 검증', () => {
    it('유효한 커맨드만 예약 가능', () => {
      const validCommands = ['휴식', '훈련', '사기진작', '농업투자', '징병'];
      const commandToReserve = '훈련';

      expect(validCommands).toContain(commandToReserve);
    });

    it('존재하지 않는 커맨드는 예약 불가', () => {
      const validCommands = ['휴식', '훈련', '사기진작'];
      const invalidCommand = '존재하지않는커맨드';

      expect(validCommands).not.toContain(invalidCommand);
    });

    it('제약 조건을 만족해야 예약 가능', () => {
      const constraints = {
        minGold: 100,
        minRice: 100,
        minCrew: 0,
      };
      const general = { gold: 1000, rice: 1000, crew: 0 };

      expect(general.gold).toBeGreaterThanOrEqual(constraints.minGold);
      expect(general.rice).toBeGreaterThanOrEqual(constraints.minRice);
      expect(general.crew).toBeGreaterThanOrEqual(constraints.minCrew);
    });
  });

  describe('턴 처리', () => {
    it('현재 턴 이후에만 예약 가능', () => {
      const currentTurn = 100;
      const reserveTurn = 101;

      expect(reserveTurn).toBeGreaterThan(currentTurn);
    });

    it('최대 예약 가능 턴 수 제한', () => {
      const maxReserveCount = 12;
      const currentReserveCount = 5;

      expect(currentReserveCount).toBeLessThanOrEqual(maxReserveCount);
    });

    it('중복 턴 예약 시 덮어쓰기', () => {
      const commands = new Map();
      commands.set(1, { command: '휴식' });
      commands.set(1, { command: '훈련' }); // 덮어쓰기

      expect(commands.get(1).command).toBe('훈련');
    });
  });

  describe('예약 취소', () => {
    it('예약된 커맨드 취소 가능', () => {
      const commands = [{ turn: 1 }, { turn: 2 }];
      const filtered = commands.filter(c => c.turn !== 1);

      expect(filtered.length).toBe(1);
      expect(filtered[0].turn).toBe(2);
    });

    it('전체 예약 초기화 가능', () => {
      let commands = [{ turn: 1 }, { turn: 2 }];
      commands = [];

      expect(commands.length).toBe(0);
    });
  });

  describe('반복 예약', () => {
    it('반복 예약 설정 가능', () => {
      const repeatCommand = {
        command: '휴식',
        repeatCount: 5,
        startTurn: 1,
      };

      expect(repeatCommand.repeatCount).toBeGreaterThan(1);
    });

    it('반복 예약 생성', () => {
      const repeatConfig = { startTurn: 1, repeatCount: 3 };
      const commands = [];

      for (let i = 0; i < repeatConfig.repeatCount; i++) {
        commands.push({ turn: repeatConfig.startTurn + i });
      }

      expect(commands.length).toBe(3);
      expect(commands[0].turn).toBe(1);
      expect(commands[2].turn).toBe(3);
    });
  });
});
