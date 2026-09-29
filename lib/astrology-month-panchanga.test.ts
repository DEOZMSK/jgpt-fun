import assert from "node:assert/strict";
import test from "node:test";
import { calculateMonthPanchanga } from "./astrology/month-panchanga-core";
import { normalizeMonthInput, type MonthInput, type MonthPanchanga } from "./astrology/month-panchanga-contract";
import { validMonthPanchanga } from "./astrology/validate-month-panchanga";
import { panchangaSunMoon } from "./astrology/panchanga-core";
import { PANCHANGA_PARTS } from "./astrology/panchanga-contract";
import { normalizeDegrees } from "./astrology/jyotish";
import { calculateAstrology } from "./astrology/engine-core";
import { WorkspaceController, type MonthTransport } from "./local-workspace/controller";
import { decodeWorkspace, emptyWorkspace, sampleDraft, validateWorkspace, WorkspaceError, type WorkspaceData } from "./local-workspace/model";
import type { WorkspaceStorage } from "./local-workspace/storage";

const input: MonthInput = { month: "2026-09", place: "Synthetic Bishkek", timezone: "Asia/Bishkek", latitude: 42.8746, longitude: 74.5698 };
const draft = { ...input, latitude: String(input.latitude), longitude: String(input.longitude) };

test("monthly calendar covers every interval, native transition and sunrise without changing natal calculations", () => {
  const before = calculateAstrology({ date: "2000-01-01", time: "12:00", place: "Synthetic", timezone: "Etc/UTC", latitude: 0, longitude: 0, accuracy: "exact", nodes: "true" });
  const r = calculateMonthPanchanga(input);
  assert.ok(validMonthPanchanga(r)); assert.equal(r.days.length, 30);
  for (const day of r.days) { assert.equal(day.sunrises.length, 1); assert.equal(day.sunsets.length, 1); assert.equal(day.anchors.length, 1); }
  for (const part of PANCHANGA_PARTS) {
    const divisions = part === "tithi" ? 30 : part === "karana" ? 60 : 27;
    for (let n = 0; n < r.intervals[part].length; n++) {
      const i = r.intervals[part][n];
      if (n) assert.deepEqual(i.start, r.intervals[part][n - 1].end);
      for (const [side, expected] of [[-1, i.index], [1, (i.index + 1) % divisions]]) {
        const [sun, moon] = panchangaSunMoon(i.end.jd + side * 0.1 / 86400);
        const phase = normalizeDegrees(part === "nakshatra" ? moon : part === "yoga" ? sun + moon : moon - sun);
        assert.equal(Math.floor(phase * divisions / 360), expected, `${part}/${n}/${side}`);
      }
    }
  }
  const after = calculateAstrology({ date: "2000-01-01", time: "12:00", place: "Synthetic", timezone: "Etc/UTC", latitude: 0, longitude: 0, accuracy: "exact", nodes: "true" });
  assert.deepEqual(after, before);
});

test("calendar handles leap months, DST and a deleted civil date without fabricating rows", () => {
  for (const [month, count] of [["2024-02", 29], ["2100-02", 28], ["1900-01", 31], ["1972-01", 31]] as const) {
    const r = calculateMonthPanchanga({ ...input, month }); assert.equal(r.days.length, count); assert.ok(validMonthPanchanga(r), month);
  }
  for (const [month, date, hours] of [["2026-03", "2026-03-08", 23], ["2026-11", "2026-11-01", 25]] as const) {
    const r = calculateMonthPanchanga({ ...input, month, timezone: "America/New_York", latitude: 40.7, longitude: -74 });
    assert.ok(validMonthPanchanga(r)); const d = r.days.find(d => d.date === date)!;
    assert.ok(Math.abs((d.end!.jd - d.start!.jd) * 24 - hours) < 0.001);
  }
  const samoa = calculateMonthPanchanga({ ...input, month: "2011-12", timezone: "Pacific/Apia", latitude: -13.8, longitude: -171.75 });
  assert.ok(validMonthPanchanga(samoa));
  const missing = samoa.days.find(d => d.date === "2011-12-30")!;
  assert.deepEqual(missing, { date: "2011-12-30", start: null, end: null, sunrises: [], sunsets: [], anchors: [] });
  assert.deepEqual(samoa.days[28].end, samoa.days[30].start);
});

test("polar calendar retains astronomical transitions without assigning nonexistent sunrise elements", () => {
  for (const month of ["2026-06", "2026-12"]) {
    const r = calculateMonthPanchanga({ ...input, month, timezone: "Etc/UTC", latitude: 80, longitude: 0 });
    assert.ok(validMonthPanchanga(r)); assert.ok(r.days.every(d => d.anchors.length === 0 && d.sunrises.length === 0));
    assert.ok(r.intervals.tithi.length >= 28); assert.ok(r.intervals.karana.length >= 56);
  }
});

test("month input and stored results reject malformed structure, method, events and references", () => {
  for (const patch of [{ month: "2026-13" }, { month: "1899-12" }, { month: "2101-01" }, { timezone: "Invented/Zone" }, { latitude: 90 }, { longitude: Infinity }, { place: "" }, { extra: "anything" }]) assert.throws(() => normalizeMonthInput({ ...input, ...patch }));
  const r = calculateMonthPanchanga(input); assert.ok(validMonthPanchanga(JSON.parse(JSON.stringify(r))));
  const changes: Array<(v: MonthPanchanga) => void> = [
    v => { v.days.pop(); }, v => { v.method = "fake" as never; }, v => { v.days[0].sunrises.push(v.days[0].sunrises[0]); },
    v => { v.intervals.tithi[0].ref = "https://outside.invalid"; }, v => { v.intervals.yoga[2].index = 99; },
    v => { v.days[0].anchors[0].moon = 999; }, v => { v.days[0].start = { ...v.days[0].start!, local: { ...v.days[0].start!.local!, utcOffsetMinutes: 0 } }; },
    v => { v.days[1].start = v.days[0].start; }, v => { v.input.month = "2026-10"; }
  ];
  for (const change of changes) { const bad = structuredClone(r); change(bad); assert.equal(validMonthPanchanga(bad), false); }
});

class Store implements WorkspaceStorage {
  data = emptyWorkspace(); revision = 0; fail = false;
  async load() { return { data: structuredClone(this.data), revision: this.revision }; }
  async save(data: WorkspaceData, revision: number) { if (this.fail) throw new WorkspaceError("storage_quota"); if (revision !== this.revision) throw new WorkspaceError("storage_conflict"); this.data = structuredClone(data); return ++this.revision; }
  close() {}
}
const clock = () => new Date("2026-09-07T12:00:00.000Z");
const make = (s: Store, transport: MonthTransport = async i => calculateMonthPanchanga(i)) => new WorkspaceController(s, async i => calculateAstrology(i), clock, () => crypto.randomUUID(), transport);

test("monthly result survives storage/reload and navigation while charts and legacy snapshots remain untouched", async () => {
  const store = new Store(), c = make(store); await c.initialize();
  await c.dispatch({ type: "create-profile", draft: sampleDraft() }); await c.dispatch({ type: "calculate", kind: "astrology" }); await c.dispatch({ type: "save-calculation" });
  const original = structuredClone(c.getSnapshot().data.calculations);
  await c.dispatch({ type: "month-use-profile" }); assert.equal(c.getSnapshot().data.ui.monthPanchanga.draft.month, "2026-09");
  await c.dispatch({ type: "month-calculate" }); assert.equal(c.getSnapshot().error, null);
  await c.dispatch({ type: "select-panel", panel: "periods" }); await c.dispatch({ type: "select-dasha-system", system: "yogini" });
  await c.dispatch({ type: "select-panel", panel: "month-panchanga" });
  validateWorkspace(c.getSnapshot().data);
  const reloaded = make(store); await reloaded.initialize();
  assert.deepEqual(reloaded.getSnapshot().data.ui.monthPanchanga, c.getSnapshot().data.ui.monthPanchanga);
  assert.deepEqual(reloaded.getSnapshot().data.calculations, original);
  const legacy = structuredClone(store.data) as unknown as { ui: Record<string, unknown> }; delete legacy.ui.monthPanchanga;
  assert.deepEqual(decodeWorkspace(legacy).calculations, original); assert.equal(decodeWorkspace(legacy).ui.monthPanchanga.result, null);
});

test("month request rejects stale and forged responses; failed storage keeps prior durable data and exposes retry", async () => {
  const store = new Store(), c = make(store); await c.initialize(); await c.dispatch({ type: "month-edit", patch: draft }); await c.dispatch({ type: "month-calculate" });
  const old = structuredClone(store.data.ui.monthPanchanga.result);
  await c.dispatch({ type: "month-edit", patch: { month: "2026-10" } }); store.fail = true; await c.dispatch({ type: "month-calculate" });
  assert.equal(c.getSnapshot().storageError, "storage_quota"); assert.deepEqual(store.data.ui.monthPanchanga.result, old);
  store.fail = false; await c.dispatch({ type: "retry-storage" }); assert.equal(store.data.ui.monthPanchanga.result!.input.month, "2026-10");
  let resolve!: (v: MonthPanchanga) => void;
  const delayed = make(store, () => new Promise(r => { resolve = r; })); await delayed.initialize();
  const request = delayed.dispatch({ type: "month-calculate" });
  await delayed.dispatch({ type: "month-edit", patch: { month: "2026-11" } }); resolve(calculateMonthPanchanga({ ...input, month: "2026-10" })); await request;
  assert.equal(delayed.getSnapshot().error, "calculation_changed"); assert.equal(delayed.getSnapshot().data.ui.monthPanchanga.result!.input.month, "2026-10");
  const forged = make(store, async i => ({ ...calculateMonthPanchanga(i), input: { ...i, place: "Unexpected" } })); await forged.initialize();
  await forged.dispatch({ type: "month-calculate" }); assert.equal(forged.getSnapshot().error, "invalid_month_calendar");
});
