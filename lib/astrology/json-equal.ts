/** JSONB may reorder object keys. Array order and every scalar remain significant. */
export function equalJson(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length
      && left.every((item, index) => equalJson(item, right[index]));
  }
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key => Object.prototype.hasOwnProperty.call(right, key)
    && equalJson((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]));
}
