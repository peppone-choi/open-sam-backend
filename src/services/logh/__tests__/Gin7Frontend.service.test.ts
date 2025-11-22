import { tupleAll } from '../Gin7Frontend.service';

describe('tupleAll helper', () => {
  it('preserves tuple ordering and awaited types', async () => {
    const [numberResult, stringResult, objectResult] = await tupleAll([
      Promise.resolve(42),
      Promise.resolve('ops'),
      Promise.resolve({ ok: true }),
    ] as const);

    expect(numberResult).toBe(42);
    expect(stringResult).toBe('ops');
    expect(objectResult).toEqual({ ok: true });
  });
});
