import { normalizeFakturowniaBuyerCountry } from './fakturownia-buyer-country.util';

describe('normalizeFakturowniaBuyerCountry', () => {
  it.each([
    ['Poland', 'PL'],
    ['POLAND', 'PL'],
    [' Polska ', 'PL'],
    ['PL', 'PL'],
    ['pl', 'PL'],
  ])('maps %p to %p', (input, expected) => {
    expect(normalizeFakturowniaBuyerCountry(input)).toBe(expected);
  });

  it('passes through unknown country names unchanged', () => {
    expect(normalizeFakturowniaBuyerCountry('Germany')).toBe('Germany');
  });

  it('returns empty string for blank input', () => {
    expect(normalizeFakturowniaBuyerCountry('   ')).toBe('');
  });
});
