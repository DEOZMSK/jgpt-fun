/** Fixed saved offset only; never consult the browser zone or current IANA rules. */
export function formatDashaInstant(utc: string, offsetMinutes: number): string {
  const milliseconds = Date.parse(utc);
  if (!utc.endsWith("Z") || !Number.isFinite(milliseconds) || !Number.isFinite(offsetMinutes) || Math.abs(offsetMinutes) > 840) {
    throw new RangeError("Invalid dasha display instant or offset");
  }
  return new Date(milliseconds + offsetMinutes * 60_000).toISOString().slice(0, 19).replace("T", " ");
}

export function dashaOffsetLabel(offsetMinutes: number): string {
  if (!Number.isFinite(offsetMinutes) || Math.abs(offsetMinutes) > 840) throw new RangeError("Invalid dasha display offset");
  if (offsetMinutes === 0) return "UTC";
  const seconds = Math.round(Math.abs(offsetMinutes) * 60);
  const hours = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor(seconds % 3600 / 60)).padStart(2, "0");
  const remainder = seconds % 60;
  return `UTC${offsetMinutes < 0 ? "−" : "+"}${hours}:${minutes}${remainder ? `:${String(remainder).padStart(2, "0")}` : ""}`;
}
