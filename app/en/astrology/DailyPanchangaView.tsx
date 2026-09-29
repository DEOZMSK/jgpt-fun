"use client";
import { DateTime } from "luxon";
import { NAKSHATRAS, SIGNS } from "../../../lib/astrology/contracts";
import { dayReady, type DayWorkspace } from "../../../lib/astrology/day-panchanga-contract";
import { daySolarPeriods } from "../../../lib/astrology/day-solar-periods";
import { tithiDetails } from "../../../lib/astrology/panchanga-details";
import { muhurtaDefinition } from "../../../lib/astrology/muhurta-definitions";
import { YOGAS, karanaName, nakshatraAt } from "../../../lib/astrology/jyotish";
import type { MonthWorkspace } from "../../../lib/astrology/month-panchanga-contract";
import { PANCHANGA_PARTS, VARA_LORDS } from "../../../lib/astrology/panchanga-contract";
import { intervalGeometry } from "../../../lib/astrology/timeline-layout";
import type { TransitDraft } from "../../../lib/astrology/transit-contract";
import { astrologyName, type AstrologyLocale } from "../../../lib/astrology/workspace-copy";
import type { WorkspaceAction } from "../../../lib/local-workspace/controller";
import { AstrologyChart, degreeLabel, PLANET_SHORT } from "./AstrologyChart";
import { DatePicker } from "./CalendarScreens";
import { SolarDivisionDetails, muhurtaQualityLabel } from "./SolarDivisionDetails";
import { PanchangaLimbDetails } from "./PanchangaLimbDetails";
import { CitySearch } from "./CitySearch";
import styles from "./workspace.module.css";

type Band = { key: string; start: number; end: number; label: string; color: string; detail?: string; half?: "day" | "night" | null };
export function DailyPanchangaView({ state, month, date, locale, act, busy, southern, hasProfile, compact = false }: {
  state: DayWorkspace; month: MonthWorkspace; date: string; locale: AstrologyLocale; act: (action: WorkspaceAction) => void; busy: boolean; southern: boolean; hasProfile: boolean; compact?: boolean;
}) {
  const t = (en: string, ru: string) => locale === "ru" ? ru : en, n = (value: string) => astrologyName(value, locale);
  const result = dayReady(state, date) ? state.result : null, moment = result?.moment;
  const start = result ? Date.parse(result.start.utc) : 0, end = result ? Date.parse(result.end.utc) : 86400000;
  const at = moment ? Date.parse(moment.instant.utc) : start;
  const localLabel = (ms: number) => DateTime.fromMillis(ms, { zone: result?.input.timezone ?? "UTC" }).setLocale(locale).toFormat("dd LLL HH:mm:ss ZZ");
  const solar = result ? daySolarPeriods(result.solarEvents) : [];
  const solarBands = (kind: string): Band[] => solar.filter(i => i.kind === kind).map((i, j) => {
    const definition = muhurtaDefinition(i), half = i.half === "night" ? t("Night", "Ночь") : t("Day", "День");
    return { key: `${kind}/${j}`, start: i.start, end: i.end, half: i.half,
    detail: definition ? `${half} ${i.index + 1} · ${n(definition.name)} · ${muhurtaQualityLabel(definition.quality, locale)}` : i.half ? `${half} · ${i.index + 1} / 8` : undefined,
    color: definition ? ({ favorable: "#c5ddcf", unfavorable: "#ead0cf", restricted: "#e6dfbe" })[definition.quality] : kind === "night" ? "#e1e5e9" : kind === "rahu" ? "#c0c5cc" : kind === "abhijit" ? "#b4e5ba" : ["#ffe08a", "#f5b6b4", "#b1dba9", "#cbb4e1"][i.index % 4],
    label: kind === "vara" ? `${DateTime.fromObject({year:2024,month:1,day:i.weekday}).setLocale(locale).toFormat("cccc")} (${PLANET_SHORT[VARA_LORDS[i.weekday - 1]]})`
      : kind === "day" ? t("Day", "День") : kind === "night" ? t("Night", "Ночь") : kind === "rahu" ? t("Rahu Kala", "Раху Кала") : kind === "abhijit" ? t("Abhijit", "Абхиджит") : `${i.half === "night" ? t("N", "Н") : t("D", "Д")}${i.index + 1}` };
  });
  const parts = [...PANCHANGA_PARTS, "moonSign", "lagna"] as const;
  const partLabel = (part: typeof parts[number], index: number) => part === "tithi" ? `${n(index < 15 ? "Shukla" : "Krishna")} ${n(tithiDetails(index)!.name)}` : part === "nakshatra" ? n(NAKSHATRAS[index]) : part === "yoga" ? n(YOGAS[index]) : part === "karana" ? n(karanaName(index)) : n(SIGNS[index]);
  const bands = (part: typeof parts[number]): Band[] => (part === "lagna" ? result?.lagna.status === "available" ? result.lagna.intervals : [] : result?.intervals[part] ?? []).map(i => ({ key: i.ref, start: Date.parse(i.start.utc), end: Date.parse(i.end.utc), label: partLabel(part, i.index), color: ["#ffe08a", "#a9dca8", "#a4c8e0", "#cab5e4", "#f4b0d5", "#f6aaaa"][i.index % 6] }));
  const rows = [
    { label: t("Vara", "Вара"), bands: solarBands("vara") },
    { label: t("Day / night", "День / ночь"), bands: [...solarBands("day"), ...solarBands("night")] },
    { label: t("Day windows", "Периоды дня"), bands: [...solarBands("rahu"), ...solarBands("abhijit")] },
    ...parts.map(part => ({ label: ({ tithi: t("Tithi", "Титхи"), nakshatra: t("Nakshatra", "Накшатра"), yoga: t("Yoga", "Йога"), karana: t("Karana", "Карана"), moonSign: t("Moon sign", "Знак Луны"), lagna: t("Rising sign", "Лагна") })[part], bands: bands(part) })),
    { label: t("Muhurtas", "Мухурты"), bands: solarBands("muhurta") },
    { label: t("Day / night eighths", "Ямардхи"), bands: solarBands("yamardha") }
  ];
  const field = (key: Exclude<keyof TransitDraft, "nodes" | "date">, label: string, type = "text") => <label className={styles.field}><span>{label}</span><input type={type} value={state.draft[key]} required={key !== "utcOffsetMinutes"} maxLength={key === "place" ? 120 : 80} autoComplete="off" {...(type === "time" ? { step: 1 } : {})} onChange={e => act({ type: "day-edit", patch: { [key]: e.target.value } })} /></label>;
  const chooseInstant = (seconds: number) => act({ type: "day-instant", utc: new Date(Math.min(end - 1000, start + Math.max(0, seconds) * 1000)).toISOString() });
  return <section className={styles.dayScreen} aria-label={t("Daily panchanga", "Панчанга на день")}>
    <div className={styles.screenHeading}><h2>{t("Daily panchanga", "Панчанга на день")}</h2><DatePicker date={date} onChange={date => act({ type: "day-date", date })} locale={locale} /></div>
    <form onSubmit={e => { e.preventDefault(); act({ type: "day-calculate" }); }}>
      <details className={styles.details} open={![state.draft.place, state.draft.timezone, state.draft.latitude, state.draft.longitude].every(v => v.trim()) || undefined}><summary>{t("Daily location and settings", "Место и настройки дня")}</summary>
        <div className={styles.monthForm}><CitySearch label={t("Day location", "Место дня")} value={state.draft.place} locale={locale} disabled={busy}
          onChange={place => act({ type: "day-edit", patch: { place, latitude: "", longitude: "", timezone: "", utcOffsetMinutes: "" } })}
          onSelect={city => act({ type: "day-edit", patch: { place: city.name, latitude: String(city.latitude), longitude: String(city.longitude), timezone: city.timezone, utcOffsetMinutes: "" } })} />
          {field("timezone", t("Day IANA time zone", "Часовой пояс дня"))}{field("latitude", t("Day latitude", "Широта дня"))}{field("longitude", t("Day longitude", "Долгота дня"))}<label className={styles.field}><span>{t("Day nodes", "Узлы дня")}</span><select value={state.draft.nodes} onChange={e => act({ type: "day-edit", patch: { nodes: e.target.value as "true" | "mean" } })}><option value="true">{t("True", "Истинные")}</option><option value="mean">{t("Mean", "Средние")}</option></select></label>{field("utcOffsetMinutes", t("Confirmed UTC offset, minutes (optional)", "Подтверждённое смещение UTC, минуты (необязательно)"))}</div>
        <p className={styles.hint}>{t("Choose a city to fill its coordinates and time zone. You can also enter them manually.", "Выбери город, чтобы заполнить координаты и часовой пояс. Их также можно указать вручную.")}</p>
        <div className={styles.monthActions}><button type="button" disabled={!hasProfile || busy} onClick={() => act({ type: "day-use-profile" })}>{t("Location and nodes from profile", "Место и узлы из профиля")}</button><button type="button" disabled={!month.draft.place || busy} onClick={() => act({ type: "day-use-month" })}>{t("Location from monthly calendar", "Место из месячного календаря")}</button></div>
        <p className={styles.hint}>{t("Choose this location explicitly. Repeated local times require an offset; changing date, time or zone clears it.", "Место выбирается явно. Для повторяющегося местного времени нужно смещение UTC; смена даты, времени или пояса сбрасывает его.")}</p>
      </details>
      <div className={styles.monthActions}>{field("time", t("Day chart local time", "Местное время карты дня"), "time")}<button className={styles.primary} type="submit" disabled={busy}>{busy ? t("Calculating…", "Рассчитываем…") : t("Calculate day", "Рассчитать день")}</button><button type="button" disabled={busy || !state.draft.timezone} onClick={() => act({ type: "day-now" })}>{t("Now", "Сейчас")}</button></div>
    </form>
    <p className={styles.hint}>{result ? `${result.input.place} · ${result.input.timezone} · ${localLabel(at)}` : t("Set the location and calculate this day. Earlier results are hidden when inputs change.", "Укажи место и рассчитай день. При изменении данных прежний результат скрывается.")}</p>
    <div className={styles.timelineScroll} tabIndex={0} role="region" aria-label={t("Daily intervals", "Интервалы дня")}><div className={`${styles.dayTimeline} ${styles.dailyRibbon}`}>
      <div className={styles.dailyHours}>{Array.from({ length: Math.ceil((end - start) / 7200000) }, (_, i) => { const ms = start + i * 7200000; return <span key={i} style={{ left: `${(ms - start) / (end - start) * 100}%` }} title={localLabel(ms)}>{result ? DateTime.fromMillis(ms, {zone: result.input.timezone}).toFormat("HH:mm") : `${i * 2}:00`}</span>; })}</div>
      <div className={styles.yearRibbonRows}>{rows.map(row => <div className={styles.timelineRow} key={row.label}><strong>{row.label}</strong><button className={`${styles.timelineTrack} ${styles.dayTrack}`} type="button" disabled={!result} aria-label={`${row.label} · ${t("Choose a moment; arrows change by a minute", "Выбрать момент; стрелки меняют минуту")}`} onClick={e => { if (e.detail) { const box = e.currentTarget.getBoundingClientRect(); chooseInstant(Math.floor((e.clientX - box.left) / box.width * (end - start) / 1000)); } }} onKeyDown={e => { if (["ArrowLeft", "ArrowRight"].includes(e.key)) { e.preventDefault(); chooseInstant((at - start) / 1000 + (e.key === "ArrowLeft" ? -60 : 60)); } }}>
        {row.bands.map(b => { const geometry = intervalGeometry(b.start, b.end, start, end); return geometry && <span key={b.key} className={styles.timelineSegment} data-solar-half={b.half ?? undefined} style={{ left: `${geometry.left}%`, width: `${geometry.width}%`, background: b.color }} title={`${b.detail ?? b.label} · ${localLabel(b.start)} — ${localLabel(b.end)}`}><span>{b.label}</span>{row.bands.length < 10 && <small>{localLabel(b.start)} — {localLabel(b.end)}</small>}</span>; })}
        {!row.bands.some(b => intervalGeometry(b.start, b.end, start, end)) && <span className={styles.timelineMissing}>{result ? t("Not available for this day / convention", "Недоступно для этого дня / метода") : "—"}</span>}
      </button></div>)}
      {result && <div className={styles.yearCursor} data-day-cursor-utc={moment!.instant.utc} style={{ left: `calc(${100 * (at - start) / (end - start)}% + ${110 * (1 - (at - start) / (end - start))}px)` }} />}</div>
    </div></div>
    {result && <label className={styles.yearDaySlider}><span>{t("Selected time", "Выбранное время")}: {moment!.input.time}</span><input type="range" aria-label={t("Moment on the daily timeline", "Момент на дневной шкале")} min={0} max={Math.floor((end - start) / 1000) - 1} step={60} value={Math.floor((at - start) / 1000)} onChange={e => chooseInstant(Number(e.target.value))} /></label>}
    <p className={styles.hint}>{t("D = daylight, N = night. Each is divided separately into 15 muhurtas and 8 eighths. Vara begins at sunrise. The civil-day axis includes DST; missing polar sunrise periods remain unavailable.", "Д — день, Н — ночь. Каждый промежуток делится отдельно на 15 мухурт и 8 ямардх. Вара начинается с восхода. Шкала учитывает перевод часов; периоды от отсутствующего полярного восхода остаются недоступны.")}</p>
    {result?.lagna.status === "unavailable" && <p role="status" className={styles.hint}>{result.lagna.reason === "polar-circle" ? t("Continuous rising-sign intervals are not defined here by this method beyond the polar circle.", "Непрерывная лента восходящих знаков за полярным кругом этим методом не определяется.") : t("Rising-sign boundaries could not be resolved reliably for this day.", "Границы восходящих знаков для этого дня не удалось надёжно определить.")}</p>}
    {result && !compact && <PanchangaLimbDetails result={result} locale={locale} onChoose={utc => act({ type: "day-instant", utc })} />}
    {result && !compact && <SolarDivisionDetails periods={solar} at={at} start={start} end={end} zone={result.input.timezone} locale={locale} onChoose={utc => act({ type: "day-instant", utc })} />}
    {result && !compact && <><div className={styles.dayFacts}>{["rahu", "abhijit", "day", "night"].map(kind => <section key={kind}><h3>{({rahu:t("Rahu Kala","Раху Кала"),abhijit:t("Abhijit Muhurta","Абхиджит Мухурта"),day:t("Sunrise / sunset","Восход / закат"),night:t("Sunset / next sunrise","Закат / следующий восход")})[kind]}</h3>{solarBands(kind).filter(b=>intervalGeometry(b.start,b.end,start,end)).map(b=><p key={b.key}>{localLabel(b.start)}<br />{localLabel(b.end)}</p>)}{!solarBands(kind).some(b=>intervalGeometry(b.start,b.end,start,end)) && <p>—</p>}</section>)}</div>
      <div className={styles.transitResult} data-day-moment-utc={moment!.instant.utc}><section><h3>{t("Day chart · D1", "Карта дня · D1")}</h3><AstrologyChart chart={moment!.chart} varga="D1" southern={southern} locale={locale} /></section><div className={styles.tableScroll} tabIndex={0} role="region" aria-label={t("Day positions", "Положения дня")}><table><caption>{t("Day positions", "Положения дня")}</caption><thead><tr>{[t("Object","Объект"),t("Sign","Знак"),t("Degree","Градус"),t("Nakshatra / pada","Накшатра / пада")].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody><tr><th scope="row">Asc</th><td>{n(SIGNS[Math.floor(moment!.ascendant/30)])}</td><td>{degreeLabel(moment!.ascendant)}</td><td>{n(nakshatraAt(moment!.ascendant).name)} / {nakshatraAt(moment!.ascendant).pada}</td></tr>{moment!.planets.map(p=><tr key={p.name}><th scope="row">{PLANET_SHORT[p.name]}{p.speed<0?" ℞":""}</th><td>{n(SIGNS[p.sign])}</td><td>{degreeLabel(p.longitude)}</td><td>{n(p.nakshatra)} / {p.pada}</td></tr>)}</tbody></table></div></div>
    </>}
  </section>;
}
