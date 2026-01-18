export const isNullOrUndefined = (value: unknown): value is null | undefined => {
  return value === undefined || value === null;
}

/**
 * Performs a shallow equality check - arrays or objects will only be compared by their references
 * @param value1 - The first value to be compared.
 * @param value2 - The second value to be compared.
 */
export const areEqualNullOrUndefined = (value1: unknown, value2: unknown): boolean => {
  return isNullOrUndefined(value1) && isNullOrUndefined(value2) || value1 === value2;
}

export const isValidNumber = (value: unknown): value is number => {
  return typeof value === 'number' && !isNaN(value);
}

export const isValidPositiveNumber = (value: unknown): value is number => {
  return isValidNumber(value) && value > 0;
}
