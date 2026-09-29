/** Stable structural equality; names and birth dates are never identity keys. */
export function archiveSignature(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(archiveSignature).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${archiveSignature((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

