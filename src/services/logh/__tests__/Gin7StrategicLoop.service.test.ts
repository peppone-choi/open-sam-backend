import { evaluateVictoryState, VictorySnapshot } from '../Gin7StrategicLoop.service';

describe('Gin7StrategicLoop victory evaluation', () => {
  const baseSnapshot: VictorySnapshot = {
    gameTime: new Date(Date.UTC(800, 0, 1)),
    capitalConqueror: null,
    starSystemCounts: { empire: 20, alliance: 20 },
    populationShare: { empire: 0.5, alliance: 0.5 },
    fleetShips: { empire: 1000, alliance: 1000 },
  };

  it('detects decisive victory when capital falls with overwhelming advantage', () => {
    const result = evaluateVictoryState({
      ...baseSnapshot,
      capitalConqueror: 'empire',
      populationShare: { empire: 0.93, alliance: 0.07 },
      fleetShips: { empire: 2000, alliance: 100 },
    });

    expect(result.shouldEnd).toBe(true);
    expect(result.type).toBe('decisive');
    expect(result.winner).toBe('empire');
  });

  it('ends session when a faction drops below 3 star systems', () => {
    const result = evaluateVictoryState({
      ...baseSnapshot,
      starSystemCounts: { empire: 2, alliance: 15 },
    });

    expect(result.shouldEnd).toBe(true);
    expect(result.type).toBe('limited');
    expect(result.winner).toBe('alliance');
  });

  it('awards local victory on time limit ties in favor of alliance', () => {
    const result = evaluateVictoryState({
      ...baseSnapshot,
      gameTime: new Date(Date.UTC(801, 6, 27)),
      populationShare: { empire: 0.4, alliance: 0.6 },
    });

    expect(result.shouldEnd).toBe(true);
    expect(result.type).toBe('local');
    expect(result.winner).toBe('alliance');
  });
});
