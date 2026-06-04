/**
 * Safe accessor utility function for nested persona values.
 * Returns the fallback value if the target value is null, undefined, or empty.
 */
export function safeGet<T>(value: T | null | undefined, fallback: any = "Not Available"): any {
  if (value === null || value === undefined) {
    return fallback;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return fallback;
  }
  if (Array.isArray(value) && value.length === 0) {
    return fallback;
  }
  if (typeof value === 'object' && Object.keys(value).length === 0) {
    return fallback;
  }
  return value;
}
