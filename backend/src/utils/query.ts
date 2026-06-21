/**
 * Helper to safely extract a single string value from Express query params.
 * Express types query params as string | string[] | undefined, but we often
 * expect only a single value. This helper takes the first value if an array
 * is provided.
 */
export function getQueryParam(
  value: string | string[] | undefined,
  defaultValue?: string
): string | undefined {
  if (value === undefined) return defaultValue;
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * Helper to safely extract a number from Express query params.
 * Returns undefined if parsing fails.
 */
export function getQueryNumber(
  value: string | string[] | undefined,
  defaultValue?: number
): number | undefined {
  const str = getQueryParam(value);
  if (str === undefined) return defaultValue;
  const num = Number(str);
  return isNaN(num) ? defaultValue : num;
}
