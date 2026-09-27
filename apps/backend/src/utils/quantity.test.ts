import { pluralUnit, quantityText, formatQuantity } from './quantity';

describe('quantity wording', () => {
  it('pluralises everyday units', () => {
    expect(pluralUnit('bag')).toBe('bags');
    expect(pluralUnit('box')).toBe('boxes');
    expect(pluralUnit('battery')).toBe('batteries');
    expect(pluralUnit('tray')).toBe('trays');
    expect(pluralUnit('50kg bag')).toBe('50kg bags');
  });

  it('leaves metric symbols and plural words alone', () => {
    expect(pluralUnit('kg')).toBe('kg');
    expect(pluralUnit('ml')).toBe('ml');
    expect(pluralUnit('pieces')).toBe('pieces');
  });

  it('uses the singular for exactly one', () => {
    expect(quantityText(1, 'carton')).toBe('1 carton');
    expect(quantityText(-1, 'carton')).toBe('-1 carton');
    expect(quantityText(3, 'carton')).toBe('3 cartons');
    expect(quantityText(2.5, 'litre')).toBe('2.5 litres');
  });

  it('formats large and fractional numbers', () => {
    expect(formatQuantity(1200)).toBe('1,200');
    expect(formatQuantity(0.333)).toBe('0.33');
  });
});
