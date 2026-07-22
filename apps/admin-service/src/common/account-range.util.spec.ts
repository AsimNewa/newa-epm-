import { accountMatchesRange, isValidAccountRangeExpr, parseAccountRange, rangeSpecificity } from './account-range.util';

describe('account-range.util', () => {
  describe('parseAccountRange', () => {
    it('parses a single account code', () => {
      expect(parseAccountRange('12100')).toEqual([{ start: '12100', end: '12100' }]);
    });

    it('parses an inclusive range', () => {
      expect(parseAccountRange('11100..11999')).toEqual([{ start: '11100', end: '11999' }]);
    });

    it('parses a comma-separated mix of ranges and single codes', () => {
      expect(parseAccountRange('11100..11999,12100,12200..12300')).toEqual([
        { start: '11100', end: '11999' },
        { start: '12100', end: '12100' },
        { start: '12200', end: '12300' },
      ]);
    });

    it('trims whitespace around segments and delimiters', () => {
      expect(parseAccountRange(' 11100 .. 11999 , 12100 ')).toEqual([
        { start: '11100', end: '11999' },
        { start: '12100', end: '12100' },
      ]);
    });
  });

  describe('accountMatchesRange', () => {
    it('matches a code within a range', () => {
      expect(accountMatchesRange('11150', '11100..11999')).toBe(true);
    });

    it('matches range boundaries inclusively', () => {
      expect(accountMatchesRange('11100', '11100..11999')).toBe(true);
      expect(accountMatchesRange('11999', '11100..11999')).toBe(true);
    });

    it('does not match a code outside the range', () => {
      expect(accountMatchesRange('12000', '11100..11999')).toBe(false);
    });

    it('matches a single-code selector only exactly', () => {
      expect(accountMatchesRange('12100', '12100')).toBe(true);
      expect(accountMatchesRange('12101', '12100')).toBe(false);
    });

    it('matches any segment in a comma-separated list', () => {
      expect(accountMatchesRange('12100', '11100..11999,12100,12200..12300')).toBe(true);
      expect(accountMatchesRange('12250', '11100..11999,12100,12200..12300')).toBe(true);
      expect(accountMatchesRange('15000', '11100..11999,12100,12200..12300')).toBe(false);
    });
  });

  describe('isValidAccountRangeExpr', () => {
    it('accepts a single code, a range, and a mixed list', () => {
      expect(isValidAccountRangeExpr('12100')).toBe(true);
      expect(isValidAccountRangeExpr('11100..11999')).toBe(true);
      expect(isValidAccountRangeExpr('11100..11999,12100')).toBe(true);
    });

    it('rejects an empty expression', () => {
      expect(isValidAccountRangeExpr('')).toBe(false);
      expect(isValidAccountRangeExpr(',,')).toBe(false);
    });

    it('rejects a range where the start is after the end', () => {
      expect(isValidAccountRangeExpr('11999..11100')).toBe(false);
    });

    it('rejects a malformed segment with too many ".." delimiters', () => {
      expect(isValidAccountRangeExpr('11100..11500..11999')).toBe(false);
    });
  });

  describe('rangeSpecificity', () => {
    it('a single code is more specific (smaller) than a range', () => {
      expect(rangeSpecificity('12100')).toBeLessThan(rangeSpecificity('11100..11999'));
    });

    it('a narrower range is more specific than a broader one', () => {
      expect(rangeSpecificity('11100..11140')).toBeLessThan(rangeSpecificity('11100..11999'));
    });

    it('sums specificity across comma-separated segments', () => {
      expect(rangeSpecificity('12100,12200')).toBe(2);
    });
  });
});
