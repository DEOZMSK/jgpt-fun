export type ChartTextToken = { label: string; layer: "natal" | "aspects" | "transits"; ref?: string; title?: string; own?: boolean; planet?: string; compactLabel?: string };
export type ChartTextRow = { x: number; y: number; fontSize: number; tokens: ChartTextToken[] };

/** Fit labels inside actual cell geometry; only dense cells use smaller type. */
export function chartTextRows(points: string, tokens: ChartTextToken[], reserved?: readonly number[]): ChartTextRow[] {
  try { return fitChartText(points, tokens, reserved); } catch (error) {
    if (!(error instanceof RangeError) || !tokens.some(t => t.compactLabel && t.compactLabel !== t.label)) throw error;
    // Keep planet labels readable in dense overlays; details remain in titles/tables.
    return fitChartText(points, tokens.map(t => ({ ...t, label: t.compactLabel ?? t.label })), reserved);
  }
}
function fitChartText(points: string, tokens: ChartTextToken[], reserved?: readonly number[]): ChartTextRow[] {
  if (!tokens.length) return [];
  const vertices = points.split(" ").map(p => p.split(",").map(Number));
  const ys = vertices.map(p => p[1]), top = Math.min(...ys), bottom = Math.max(...ys);
  const span = (y: number) => {
    const xs: number[] = [];
    vertices.forEach(([x1, y1], i) => {
      const [x2, y2] = vertices[(i + 1) % vertices.length];
      if (y1 !== y2 && y >= Math.min(y1, y2) && y <= Math.max(y1, y2)) xs.push(x1 + (y - y1) * (x2 - x1) / (y2 - y1));
    });
    return [Math.min(...xs), Math.max(...xs)];
  };
  for (const fontSize of [18, 17, 16, 15, 14, 13, 12, 11, 10]) {
    const slots: { left: number; right: number; y: number }[] = [];
    for (let y = top + fontSize + 7; y < bottom - 6; y += fontSize + 2) {
      const a = span(y - fontSize * .82), b = span(y + fontSize * .25);
      let left = Math.max(a[0], b[0]) + 7, right = Math.min(a[1], b[1]) - 7;
      if (reserved && Math.abs(y - reserved[1]) < fontSize + 5 && reserved[0] >= left && reserved[0] <= right) {
        if (reserved[0] - left > right - reserved[0]) right = reserved[0] - 13; else left = reserved[0] + 13;
      }
      if (right - left >= fontSize * 1.3) slots.push({ left, right, y });
    }
    let best: ChartTextRow[] | null = null, score = Infinity;
    for (let start = 0; start < slots.length; start++) {
      let cursor = 0; const rows: ChartTextRow[] = [];
      for (const slot of slots.slice(start)) {
        if (cursor === tokens.length) break;
        const row: ChartTextToken[] = []; let width = 0;
        while (cursor < tokens.length && (!row.length || row[0].layer === tokens[cursor].layer)) {
          const token = tokens[cursor], nextWidth = token.label.length * fontSize * .64 + (row.length ? 5 : 0);
          if (width + nextWidth > slot.right - slot.left) break;
          row.push(token); cursor++; width += nextWidth;
        }
        if (row.length) rows.push({ x: (slot.left + slot.right) / 2, y: slot.y, fontSize, tokens: row });
      }
      if (cursor === tokens.length) {
        const distance = Math.abs((rows[0].y + rows.at(-1)!.y) / 2 - (top + bottom) / 2) + rows.length;
        if (distance < score) { best = rows; score = distance; }
      }
    }
    if (best) return best;
  }
  throw new RangeError("Chart labels exceed cell capacity");
}
