import test from "node:test";
import assert from "node:assert/strict";
import * as sweph from "sweph";
import { calculateDayPanchanga, risingSignIntervals } from "./astrology/day-panchanga-core";
import { validDayPanchanga } from "./astrology/validate-day-panchanga";
import { daySolarPeriods } from "./astrology/day-solar-periods";
import { dayReady, emptyDayWorkspace } from "./astrology/day-panchanga-contract";
import { lahiriMotion } from "./astrology/positions-core";
import { WorkspaceController, type DayPanchangaTransport } from "./local-workspace/controller";
import { emptyWorkspace, decodeWorkspace, sampleDraft, validateWorkspace, WorkspaceError, type WorkspaceData } from "./local-workspace/model";
import type { MonthInterval } from "./astrology/month-panchanga-contract";
import type { WorkspaceStorage } from "./local-workspace/storage";

const input = { date: "2026-09-08", time: "12:00:00", place: "Synthetic UTC", timezone: "Etc/UTC", latitude: 0, longitude: 0, nodes: "true" as const };
const daily = () => calculateDayPanchanga(input);

test("daily phases and lunar sign cover the civil day and agree with the actual Moon at interval midpoints", () => {
  const r = daily(); assert.ok(validDayPanchanga(r));
  for (const rows of Object.values(r.intervals)) {
    assert.ok(Date.parse(rows[0].start.utc) <= Date.parse(r.start.utc)); assert.ok(Date.parse(rows.at(-1)!.end.utc) >= Date.parse(r.end.utc));
    for (let i = 1; i < rows.length; i++) assert.deepEqual(rows[i].start, rows[i - 1].end);
  }
  for (const row of r.intervals.moonSign) assert.equal(Math.floor(lahiriMotion((row.start.jd + row.end.jd) / 2, "Moon", "true").longitude / 30), row.index);
});

test("Lagna intervals agree with Swiss midpoint houses and bracket sign changes under doubled density", () => {
  const r = calculateDayPanchanga({ ...input, latitude: 55.75, longitude: 37.62, timezone: "Europe/Moscow" });
  assert.equal(r.lagna.status, "available"); if (r.lagna.status !== "available") return;
  const position = (jd: number) => sweph.houses_ex(jd, sweph.constants.SEFLG_SIDEREAL, r.input.latitude, r.input.longitude, "W").data.points[0];
  const dense = risingSignIntervals(r.start.jd, r.end.jd, position, r.input.timezone, 1 / 2880);
  assert.equal(dense.length, r.lagna.intervals.length);
  for (let i = 0; i < dense.length; i++) {
    const row: MonthInterval = r.lagna.intervals[i]; assert.equal(row.index, dense[i].index);
    assert.ok(Math.abs(row.end.jd - dense[i].end.jd) * 86400 < 0.1);
    assert.equal(Math.floor(position((row.start.jd + row.end.jd) / 2) / 30), row.index);
    if (i + 1 < dense.length) { assert.equal(Math.floor(position(row.end.jd - 1 / 86400) / 30), row.index); assert.equal(Math.floor(position(row.end.jd + 1 / 86400) / 30), (row.index + 1) % 12); }
  }
});

test("daylight fractions vary with solar duration and Wednesday omits Abhijit", () => {
  for (let weekday = 1; weekday <= 7; weekday++) {
    const r = calculateDayPanchanga({ ...input, date: `2026-09-${String(6 + weekday).padStart(2, "0")}`, latitude: 51.5, timezone: "Europe/London" });
    const rows = daySolarPeriods(r.solarEvents), start = Date.parse(r.start.utc), end = Date.parse(r.end.utc);
    const day = rows.find(i => i.kind === "day" && i.start >= start && i.start < end)!;
    const rahu = rows.find(i => i.kind === "rahu" && i.start >= day.start && i.end <= day.end)!;
    const index = [2, 7, 5, 6, 4, 3, 8][weekday - 1] - 1, duration = day.end - day.start;
    assert.ok(Math.abs(rahu.start - day.start - duration * index / 8) < 1);
    assert.ok(Math.abs(rahu.end - rahu.start - duration / 8) < 1);
    const abhijit = rows.filter(i => i.kind === "abhijit" && i.start >= day.start && i.end <= day.end);
    assert.equal(abhijit.length, weekday === 3 ? 0 : 1);
    if (abhijit.length) assert.ok(Math.abs(abhijit[0].start - day.start - duration * 7 / 15) < 1);
    assert.equal(rows.filter(i => i.kind === "muhurta" && i.start >= day.start && i.end <= day.end + 1).length, 15);
    assert.equal(rows.filter(i => i.kind === "yamardha" && i.start >= day.start && i.end <= day.end + 1).length, 8);
  }
});

test("polar and missing-sunrise cases retain lunar calculations without invented solar periods", () => {
  for (const date of ["2026-06-21", "2026-12-21"]) {
    const r = calculateDayPanchanga({ ...input, date, latitude: 78, longitude: 15, timezone: "Arctic/Longyearbyen" });
    assert.ok(validDayPanchanga(r)); assert.deepEqual(r.lagna, { status: "unavailable", reason: "polar-circle" });
    assert.equal(daySolarPeriods(r.solarEvents).length, 0); assert.ok(r.intervals.tithi.length);
  }
  assert.equal(daySolarPeriods([]).length, 0);
});

test("civil-day ranges handle 23/25-hour DST, historical offsets and a repeated 47-hour date", () => {
  for (const [date, timezone, hours, offset] of [["2024-03-10", "America/New_York", 23, undefined], ["2024-11-03", "America/New_York", 25, undefined], ["1969-09-30", "Pacific/Kwajalein", 47, 660], ["1900-01-01", "Asia/Bishkek", 24, undefined]] as const) {
    const r = calculateDayPanchanga({ ...input, date, timezone, ...(offset !== undefined ? { utcOffsetMinutes: offset } : {}) });
    assert.ok(validDayPanchanga(r), `${date}/${timezone}`); assert.equal((Date.parse(r.end.utc) - Date.parse(r.start.utc)) / 3600000, hours);
  }
  assert.throws(() => calculateDayPanchanga({ ...input, date: "2011-12-30", timezone: "Pacific/Apia" }));
  assert.throws(() => calculateDayPanchanga({ ...input, date: "2024-11-03", time: "01:30:00", timezone: "America/New_York" }));
});

test("stored validation rejects altered method, intervals, times and input linkage", () => {
  const edits = [
    (r: ReturnType<typeof daily>) => { r.input.date = "2026-09-09"; },
    (r: ReturnType<typeof daily>) => { r.method = "unknown" as never; },
    (r: ReturnType<typeof daily>) => { r.intervals.tithi[0].index = 99; },
    (r: ReturnType<typeof daily>) => { r.intervals.moonSign = []; },
    (r: ReturnType<typeof daily>) => { r.solarEvents.reverse(); },
    (r: ReturnType<typeof daily>) => { r.start = r.end; },
    (r: ReturnType<typeof daily>) => { r.moment.planets = []; }
  ];
  for (const edit of edits) { const r = daily(); edit(r); assert.equal(validDayPanchanga(r), false); }
});

class Store implements WorkspaceStorage {
  data = emptyWorkspace(); revision = 0; fail = false;
  async load() { return { data: structuredClone(this.data), revision: this.revision }; }
  async save(data: WorkspaceData, revision: number) { if (this.fail) throw new WorkspaceError("storage_quota"); assert.equal(revision, this.revision); this.data = structuredClone(data); return ++this.revision; }
  close() {}
}
const make = (s: Store, transport: DayPanchangaTransport = async input => calculateDayPanchanga(input)) => new WorkspaceController(s, undefined, () => new Date("2026-09-08T12:34:00.000Z"), () => crypto.randomUUID(), undefined, undefined, undefined, undefined, transport);
const setup = async (c: WorkspaceController) => { await c.initialize(); await c.dispatch({ type: "day-edit", patch: { ...input, latitude: "0", longitude: "0" } }); };

test("independent daily state persists without natal records and preserves monthly/year/overlay data", async () => {
  const s = new Store(), c = make(s); await setup(c);
  const before = JSON.stringify([s.data.profiles, s.data.calculations, s.data.ui.transit, s.data.ui.yearTransits, s.data.ui.yearTransitMoment, s.data.ui.monthPanchanga]);
  await c.dispatch({ type: "day-calculate" }); assert.equal(c.getSnapshot().error, null); assert.ok(dayReady(s.data.ui.dayPanchanga, input.date));
  await c.dispatch({ type: "day-date", date: "2026-10-01" }); assert.equal(c.getSnapshot().error, null); assert.equal(s.data.ui.dayPanchanga.result!.input.date, "2026-10-01");
  validateWorkspace(s.data); assert.equal(JSON.stringify([s.data.profiles, s.data.calculations, s.data.ui.transit, s.data.ui.yearTransits, s.data.ui.yearTransitMoment, s.data.ui.monthPanchanga]), before);
  const reload = make(s); await reload.initialize(); assert.deepEqual(reload.getSnapshot().data.ui.dayPanchanga, s.data.ui.dayPanchanga);
  const old = structuredClone(s.data) as unknown as { ui: Record<string, unknown> }; delete old.ui.dayPanchanga;
  assert.deepEqual(decodeWorkspace(old).ui.dayPanchanga, emptyDayWorkspace());
});

test("shared calendar date, explicit profile location and day pointer retain their separate semantics", async () => {
  const s = new Store(), c = make(s); await setup(c); await c.dispatch({ type: "create-profile", draft: sampleDraft() });
  await c.dispatch({ type: "day-use-profile" }); assert.equal(c.getSnapshot().data.ui.dayPanchanga.draft.date, input.date); assert.equal(c.getSnapshot().data.ui.dayPanchanga.draft.latitude, sampleDraft().latitude);
  await c.dispatch({ type: "select-calendar-date", date: "2026-10-01" }); await c.dispatch({ type: "day-edit", patch: { time: "10:00:00" } });
  assert.equal(c.getSnapshot().data.ui.calendarDate, "2026-10-01"); await c.dispatch({ type: "day-calculate" });
  const r = c.getSnapshot().data.ui.dayPanchanga.result!;
  await c.dispatch({ type: "day-instant", utc: new Date(Date.parse(r.start.utc) + 3600000).toISOString() }); assert.equal(c.getSnapshot().error, null);
  assert.equal(c.getSnapshot().data.ui.dayPanchanga.result!.input.time, "01:00:00");
  await c.dispatch({ type: "day-instant", utc: r.end.utc }); assert.equal(c.getSnapshot().error, "invalid_action");
});

test("bad actions and forged results are rejected; stale inputs cannot publish an in-flight day", async () => {
  const s = new Store(), c = make(s, async i => calculateDayPanchanga({ ...i, place: "Other" })); await setup(c);
  await c.dispatch({ type: "day-calculate" }); assert.equal(c.getSnapshot().error, "invalid_day_panchanga"); assert.equal(c.getSnapshot().data.ui.dayPanchanga.result, null);
  await c.dispatch({ type: "day-now", extra: true } as never); assert.equal(c.getSnapshot().error, "invalid_action");
  let release!: () => void, enter!: () => void; const gate = new Promise<void>(r => { release = r; }), started = new Promise<void>(r => { enter = r; });
  const d = make(new Store(), async i => { enter(); await gate; return calculateDayPanchanga(i); }); await setup(d);
  const job = d.dispatch({ type: "day-calculate" }); await started; await d.dispatch({ type: "day-edit", patch: { time: "13:00:00" } }); release(); await job;
  assert.equal(d.getSnapshot().error, "calculation_changed"); assert.equal(d.getSnapshot().data.ui.dayPanchanga.result, null);
});

test("rapid day selection supersedes old requests; failed writes preserve durable results", async () => {
  const s = new Store(); let entered!: () => void, calls = 0; const started = new Promise<void>(r => { entered = r; });
  const c = make(s, async (i, signal) => { if (++calls === 1) { entered(); await new Promise<void>(r => signal.addEventListener("abort", () => r())); } return calculateDayPanchanga(i); }); await setup(c);
  const a = c.dispatch({ type: "day-date", date: "2026-09-09" }); await started; const b = c.dispatch({ type: "day-date", date: "2026-09-10" }); await Promise.all([a,b]);
  assert.equal(c.getSnapshot().error, null); assert.equal(s.data.ui.dayPanchanga.result!.input.date, "2026-09-10");
  const before = JSON.stringify(s.data); s.fail = true; await c.dispatch({ type: "day-date", date: "2026-09-11" });
  assert.equal(c.getSnapshot().storageError, "storage_quota"); assert.equal(JSON.stringify(s.data), before);
});
