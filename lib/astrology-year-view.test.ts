import test from "node:test";
import assert from "node:assert/strict";
import { DateTime } from "luxon";
import { calculateYearTransits } from "./astrology/year-transit-core";
import { EVENT_PLANETS, type YearTransitResult } from "./astrology/year-transit-contract";
import { calculateTransit } from "./astrology/transit-core";
import { yearDateAtFraction, yearDirectionIntervals, yearMonthGeometry } from "./astrology/timeline-layout";
import { initialYearMomentDate, yearMomentInput, yearMomentReady, yearMomentUtc } from "./astrology/year-transit-moment";
import { emptyTransitWorkspace } from "./astrology/transit-contract";
import { WorkspaceController, type TransitTransport } from "./local-workspace/controller";
import { emptyWorkspace, decodeWorkspace, validateWorkspace, sampleDraft, WorkspaceError, type WorkspaceData } from "./local-workspace/model";
import type { WorkspaceStorage } from "./local-workspace/storage";

const timelines = new Map<string, YearTransitResult>();
const timeline = (year = 2026, timezone = "Etc/UTC") => {
  const key = `${year}/${timezone}`;
  if (!timelines.has(key)) timelines.set(key, calculateYearTransits({ year, timezone, nodes: "true" }));
  return structuredClone(timelines.get(key)!);
};
class Store implements WorkspaceStorage {
  data = emptyWorkspace(); revision = 0; fail = false;
  async load() { return { data: structuredClone(this.data), revision: this.revision }; }
  async save(data: WorkspaceData, revision: number) {
    if (this.fail) throw new WorkspaceError("storage_quota");
    assert.equal(revision, this.revision); this.data = structuredClone(data); return ++this.revision;
  }
  close() {}
}
function prepared(year = 2026, timezone = "Etc/UTC") {
  const s = new Store();
  s.data.ui.yearTransits = { ...s.data.ui.yearTransits, draft: { year: String(year), timezone, nodes: "true" }, result: timeline(year, timezone) };
  s.data.ui.yearTransitMoment.draft = { date: `${year}-09-07`, time: "12:00:00", place: "Synthetic UTC", latitude: "0", longitude: "0", timezone, utcOffsetMinutes: "", nodes: "true" };
  return s;
}
const make = (store: Store, transit: TransitTransport = async input => calculateTransit(input)) => new WorkspaceController(store, undefined, () => new Date("2026-09-08T12:34:56.000Z"), () => crypto.randomUUID(), undefined, transit);

test("direction bands cover the year and agree with independently evaluated midpoint motion", () => {
  const r = timeline(), before = JSON.stringify(r);
  for (const planet of EVENT_PLANETS) {
    const bands = yearDirectionIntervals(r, planet);
    assert.equal(bands[0].start.utc, r.start.utc); assert.equal(bands.at(-1)!.end.utc, r.end.utc);
    for (let i = 0; i < bands.length; i++) {
      const band = bands[i];
      if (i) assert.equal(bands[i - 1].end.utc, band.start.utc);
      const midpoint = new Date((Date.parse(band.start.utc) + Date.parse(band.end.utc)) / 2).toISOString();
      const value = calculateTransit({ date: midpoint.slice(0, 10), time: midpoint.slice(11, 19), place: "Synthetic UTC", timezone: "Etc/UTC", latitude: 0, longitude: 0, nodes: "true" }).planets.find(p => p.name === planet)!;
      assert.equal(value.speed < 0, band.direction === "retrograde", `${planet} ${midpoint}`);
    }
  }
  assert.equal(JSON.stringify(r), before);
});

test("month positions use leap days and elapsed DST hours; pointer selection stays within the year", () => {
  const r = timeline(2024, "America/New_York"), months = yearMonthGeometry(r);
  const hours = (Date.parse(r.end.utc) - Date.parse(r.start.utc)) / 3600000;
  assert.ok(Math.abs(months[1].width * hours / 100 - 29 * 24) < 1e-8);
  assert.ok(Math.abs(months[2].width * hours / 100 - (31 * 24 - 1)) < 1e-8);
  assert.ok(Math.abs(months[10].width * hours / 100 - (30 * 24 + 1)) < 1e-8);
  assert.ok(Math.abs(months.reduce((n, m) => n + m.width, 0) - 100) < 1e-8);
  assert.equal(yearDateAtFraction(r, -0.1), "2024-01-01"); assert.equal(yearDateAtFraction(r, 1), "2024-12-31");
  assert.equal(yearDateAtFraction(r, 3), "2024-12-31"); assert.equal(yearDateAtFraction(r, NaN), null);
  const utc = DateTime.fromISO("2024-03-10T12:00", { zone: r.input.timezone }).toMillis();
  assert.equal(yearDateAtFraction(r, (utc - Date.parse(r.start.utc)) / (Date.parse(r.end.utc) - Date.parse(r.start.utc))), "2024-03-10");
});

test("calendar cursor resolves civil time without location and does not guess DST folds or gaps", () => {
  const s = prepared(2024, "America/New_York"), year = s.data.ui.yearTransits, moment = s.data.ui.yearTransitMoment;
  moment.draft.latitude = ""; moment.draft.longitude = "";
  moment.draft.date = "2024-11-03"; moment.draft.time = "01:30:00";
  assert.equal(yearMomentUtc(year, moment), null);
  moment.draft.utcOffsetMinutes = "-300"; assert.equal(yearMomentUtc(year, moment), "2024-11-03T06:30:00.000Z");
  moment.draft.date = "2024-03-10"; moment.draft.time = "02:30:00"; moment.draft.utcOffsetMinutes = "";
  assert.equal(yearMomentUtc(year, moment), null);
  assert.equal(initialYearMomentDate(2024, "2024-02-29", new Date("2026-09-08"), "Etc/UTC"), "2024-02-29");
  assert.equal(initialYearMomentDate(2024, "2024-02-30", new Date("2026-09-08"), "Etc/UTC"), "2024-01-01");
});

test("selected moment calculates without a natal profile, persists and leaves natal transit state intact", async () => {
  const s = prepared(), c = make(s); await c.initialize();
  const protectedState = JSON.stringify([s.data.profiles, s.data.calculations, s.data.ui.transit, s.data.ui.chartOverlay, s.data.ui.yearTransits]);
  await c.dispatch({ type: "year-moment-calculate" }); assert.equal(c.getSnapshot().error, null);
  assert.ok(yearMomentReady(c.getSnapshot().data.ui.yearTransits, c.getSnapshot().data.ui.yearTransitMoment));
  await c.dispatch({ type: "year-moment-select", date: "2026-03-02" }); assert.equal(c.getSnapshot().error, null);
  assert.equal(s.data.ui.yearTransitMoment.result!.input.date, "2026-03-02"); assert.equal(s.data.ui.calendarDate, "2026-03-02");
  assert.equal(JSON.stringify([s.data.profiles, s.data.calculations, s.data.ui.transit, s.data.ui.chartOverlay, s.data.ui.yearTransits]), protectedState);
  validateWorkspace(s.data);
  const reload = make(s); await reload.initialize(); assert.deepEqual(reload.getSnapshot().data.ui.yearTransitMoment, s.data.ui.yearTransitMoment);
});

test("event selection rounds up to a second and explicit profile copy changes only moment coordinates", async () => {
  const s = prepared(), c = make(s); await c.initialize();
  await c.dispatch({ type: "create-profile", draft: sampleDraft() });
  const clock = { ...c.getSnapshot().data.ui.yearTransitMoment.draft };
  await c.dispatch({ type: "year-moment-use-profile" });
  const draft = c.getSnapshot().data.ui.yearTransitMoment.draft;
  assert.equal(draft.timezone, clock.timezone); assert.equal(draft.date, clock.date); assert.equal(draft.time, clock.time);
  assert.equal(draft.latitude, sampleDraft().latitude); assert.equal(draft.place, sampleDraft().place);
  const event = s.data.ui.yearTransits.result!.events.find(e => e.kind === "station" && e.planet === "Mercury")!;
  await c.dispatch({ type: "year-moment-event", ref: event.ref }); assert.equal(c.getSnapshot().error, null);
  assert.equal(c.getSnapshot().data.ui.yearTransitMoment.result!.instant.utc, new Date(Math.ceil(Date.parse(event.at.utc) / 1000) * 1000).toISOString());
  await c.dispatch({ type: "year-moment-now" }); assert.equal(c.getSnapshot().data.ui.yearTransitMoment.result!.instant.utc, "2026-09-08T12:34:56.000Z");
});

test("old workspace gains an empty separate moment; corrupted results and invalid action fields are rejected", async () => {
  const s = prepared(), old = structuredClone(s.data) as unknown as { ui: Record<string, unknown> }; delete old.ui.yearTransitMoment;
  assert.deepEqual(decodeWorkspace(old).ui.yearTransitMoment, emptyTransitWorkspace());
  const bad = structuredClone(s.data); bad.ui.yearTransitMoment.reference = "natal-lagna"; assert.throws(() => validateWorkspace(bad));
  const c = make(s); await c.initialize();
  for (const action of [{ type: "year-moment-edit", patch: { timezone: "Asia/Bishkek" } }, { type: "year-moment-now", extra: true }, { type: "year-moment-event", ref: "untrusted" }, { type: 0 }]) {
    await c.dispatch(action as never); assert.equal(c.getSnapshot().error, "invalid_action");
  }
  await c.dispatch({ type: "year-moment-select", date: "2025-01-01" }); assert.equal(c.getSnapshot().error, "invalid_date");
  const forged = make(prepared(), async i => calculateTransit({ ...i, date: "2026-01-01" })); await forged.initialize();
  await forged.dispatch({ type: "year-moment-calculate" }); assert.equal(forged.getSnapshot().error, "invalid_transit_result");
  assert.equal(forged.getSnapshot().data.ui.yearTransitMoment.result, null);
});

test("stale year settings hide the moment and changed drafts cannot publish an old in-flight result", async () => {
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; }), start = new Promise<void>(resolve => { entered = resolve; });
  const s = prepared(), c = make(s, async i => { entered(); await gate; return calculateTransit(i); }); await c.initialize();
  const job = c.dispatch({ type: "year-moment-calculate" }); await start;
  await c.dispatch({ type: "year-moment-edit", patch: { time: "15:00:00" } }); release(); await job;
  assert.equal(c.getSnapshot().error, "calculation_changed"); assert.equal(c.getSnapshot().data.ui.yearTransitMoment.result, null);
  await c.dispatch({ type: "year-transits-edit", patch: { year: "2027" } });
  assert.throws(() => yearMomentInput(c.getSnapshot().data.ui.yearTransits, c.getSnapshot().data.ui.yearTransitMoment));
  assert.equal(yearMomentReady(c.getSnapshot().data.ui.yearTransits, c.getSnapshot().data.ui.yearTransitMoment), false);
});

test("rapid day selections cancel the earlier request and only publish the final selected day", async () => {
  let release!: () => void, entered!: () => void, aborted = false, count = 0;
  const gate = new Promise<void>(resolve => { release = resolve; }), start = new Promise<void>(resolve => { entered = resolve; });
  const s = prepared(), c = make(s, async (i, signal) => { if (++count === 1) { signal.addEventListener("abort", () => { aborted = true; release(); }); entered(); await gate; } return calculateTransit(i); });
  await c.initialize(); const first = c.dispatch({ type: "year-moment-select", date: "2026-02-03" }); await start;
  const last = c.dispatch({ type: "year-moment-select", date: "2026-02-04" }); await Promise.all([first, last]);
  assert.ok(aborted); assert.equal(c.getSnapshot().error, null); assert.equal(c.getSnapshot().busy, false);
  assert.equal(s.data.ui.yearTransitMoment.result!.input.date, "2026-02-04");
});

test("failed moment storage retains the last durable calculation", async () => {
  const s = prepared(), c = make(s); await c.initialize(); await c.dispatch({ type: "year-moment-calculate" });
  const durable = JSON.stringify(s.data); s.fail = true;
  await c.dispatch({ type: "year-moment-select", date: "2026-10-01" });
  assert.equal(c.getSnapshot().storageError, "storage_quota"); assert.equal(JSON.stringify(s.data), durable);
});
