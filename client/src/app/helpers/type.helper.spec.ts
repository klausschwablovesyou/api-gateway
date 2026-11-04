import { areEqualNullOrUndefined, isNullOrUndefined, isValidNumber, isValidPositiveNumber } from './type.helper';

describe('type helpers', () => {
  describe('isNullOrUndefined', () => {
    it('should be true for null and undefined', () => {
      expect(isNullOrUndefined(null)).toBeTrue();
      expect(isNullOrUndefined(undefined)).toBeTrue();
    });

    it('should be false for other falsy values', () => {
      for (const value of [0, '', false, NaN]) {
        expect(isNullOrUndefined(value)).toBeFalse();
      }
    });
  });

  describe('areEqualNullOrUndefined', () => {
    it('should treat null and undefined as equal', () => {
      expect(areEqualNullOrUndefined(null, undefined)).toBeTrue();
      expect(areEqualNullOrUndefined(undefined, null)).toBeTrue();
    });

    it('should compare primitives by value', () => {
      expect(areEqualNullOrUndefined('a', 'a')).toBeTrue();
      expect(areEqualNullOrUndefined('a', 'b')).toBeFalse();
    });

    it('should not treat null as equal to other falsy values', () => {
      expect(areEqualNullOrUndefined(null, 0)).toBeFalse();
      expect(areEqualNullOrUndefined('', undefined)).toBeFalse();
    });

    it('should compare objects by reference', () => {
      const object = { a: 1 };

      expect(areEqualNullOrUndefined(object, object)).toBeTrue();
      expect(areEqualNullOrUndefined(object, { a: 1 })).toBeFalse();
    });
  });

  describe('isValidNumber', () => {
    it('should accept numbers', () => {
      for (const value of [0, -1, 1.5, Infinity]) {
        expect(isValidNumber(value)).toBeTrue();
      }
    });

    it('should reject NaN and non-numbers', () => {
      for (const value of [NaN, '1', null, undefined, {}]) {
        expect(isValidNumber(value)).toBeFalse();
      }
    });
  });

  describe('isValidPositiveNumber', () => {
    it('should accept only numbers above zero', () => {
      expect(isValidPositiveNumber(0.1)).toBeTrue();
      expect(isValidPositiveNumber(0)).toBeFalse();
      expect(isValidPositiveNumber(-1)).toBeFalse();
      expect(isValidPositiveNumber(NaN)).toBeFalse();
      expect(isValidPositiveNumber('1')).toBeFalse();
    });
  });
});
