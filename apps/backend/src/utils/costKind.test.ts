import { guessCostKind } from './costKind';

describe('guessCostKind', () => {
  it('leaves sales alone', () => {
    expect(guessCostKind('sale', 'Stock', 'rice')).toBeUndefined();
    expect(guessCostKind('receivable', null, null)).toBeUndefined();
  });

  it('spots goods bought to resell', () => {
    expect(guessCostKind('expense', 'Inventory', 'rice')).toBe('stock');
    expect(guessCostKind('payable', null, 'Restock of sugar')).toBe('stock');
    expect(guessCostKind('expense', 'Goods', null)).toBe('stock');
  });

  it('treats everything else as a running cost', () => {
    expect(guessCostKind('expense', 'Rent', 'Shop rent')).toBe('running');
    expect(guessCostKind('expense', 'Fuel', 'Diesel for generator')).toBe('running');
    expect(guessCostKind('payable', null, null)).toBe('running');
    // "stocking" and "goodsfield" aren't the words.
    expect(guessCostKind('expense', null, 'Stockings for staff uniform')).toBe('running');
  });
});
