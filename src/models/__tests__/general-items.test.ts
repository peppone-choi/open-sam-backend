import { General } from '../general.model';

describe('General item helpers', () => {
  it('returns item actions via getItem and getActionObjects', () => {
    const general = new General({
      no: 1,
      session_id: 'test',
      owner: '1',
      name: 'Tester',
      data: {
        item: 'che_계략_향낭',
        weapon: 'None',
        book: 'None',
        horse: 'None',
      },
    });

    const item = general.getItem('item');
    expect(item.getName()).toContain('향낭');

    const actions = general.getActionObjects();
    expect(actions.some((action) => (action as any).getRawName?.() === item.getRawName?.())).toBe(true);
  });

  it('deletes items through helper', () => {
    const general = new General({
      no: 2,
      session_id: 'test',
      owner: '1',
      name: 'Tester',
      data: {
        item: 'che_계략_향낭',
      },
    });

    expect(general.getItem().getRawName()).toBe('향낭');
    general.deleteItem();
    expect(general.getItem().getRawName()).toBe('None');
  });
});
