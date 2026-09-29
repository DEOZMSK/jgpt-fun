"use client";
import { DateTime } from "luxon";
import { NAKSHATRAS } from "../../../lib/astrology/contracts";
import { karanaName, YOGAS } from "../../../lib/astrology/jyotish";
import { isMonthOutdated, type MonthDraft, type MonthWorkspace } from "../../../lib/astrology/month-panchanga-contract";
import { PANCHANGA_PARTS, VARA_LORDS, type PanchangaPart } from "../../../lib/astrology/panchanga-contract";
import { astrologyName, type AstrologyLocale } from "../../../lib/astrology/workspace-copy";
import type { WorkspaceAction } from "../../../lib/local-workspace/controller";
import { EventTime } from "./BirthPanchangaView";
import { CitySearch } from "./CitySearch";
import styles from "./workspace.module.css";

export function MonthPanchangaView({ state, locale, hasProfile, act, busy = false }: {
  state: MonthWorkspace; locale: AstrologyLocale; hasProfile: boolean; act: (action: WorkspaceAction) => void; busy?: boolean;
}) {
  const t = (en: string, ru: string) => locale === "ru" ? ru : en, n = (name: string) => astrologyName(name, locale);
  const field = (key: keyof MonthDraft, label: string, type = "text") => <label className={styles.field}><span>{label}</span>
    <input type={type} value={state.draft[key]} maxLength={key === "place" ? 120 : 80} autoComplete="off" required
      {...(type === "month" ? { min: "1900-01", max: "2100-12" } : {})}
      onInput={e => { if (type === "month") act({ type: "month-edit", patch: { [key]: e.currentTarget.value } }); }}
      onChange={e => { if (type !== "month") act({ type: "month-edit", patch: { [key]: e.target.value } }); }} /></label>;
  const labels = { tithi: t("Tithi", "Титхи"), nakshatra: t("Nakshatra", "Накшатра"), yoga: t("Yoga", "Йога"), karana: t("Karana", "Карана") };
  const value = (part: PanchangaPart, index: number) => part === "tithi" ? `${n(index < 15 ? "Shukla" : "Krishna")} ${index % 15 + 1}`
    : n(part === "nakshatra" ? NAKSHATRAS[index] : part === "yoga" ? YOGAS[index] : karanaName(index));
  const result = state.result;
  return <section aria-label={t("Monthly panchanga", "Панчанга на месяц")}>
    <h2>{t("Monthly panchanga", "Панчанга на месяц")}</h2>
    <form onSubmit={e => { e.preventDefault(); if (!busy) act({ type: "month-calculate" }); }}>
      <fieldset className={styles.deskFieldset} disabled={busy}><legend className={styles.srOnly}>{t("Month and location", "Месяц и место")}</legend>
      <div className={styles.monthForm}>{field("month", t("Month", "Месяц"), "month")}<CitySearch value={state.draft.place} locale={locale} disabled={busy} label={t("Location", "Место календаря")} onChange={place => act({ type: "month-edit", patch: { place, latitude: "", longitude: "", timezone: "" } })} onSelect={city => act({ type: "month-edit", patch: { place: city.label.slice(0, 120), latitude: String(city.latitude), longitude: String(city.longitude), timezone: city.timezone } })} />
        {field("timezone", t("IANA time zone", "Часовой пояс календаря"))}{field("latitude", t("Latitude", "Широта календаря"))}{field("longitude", t("Longitude", "Долгота календаря"))}</div>
      <div className={styles.monthActions}><button type="submit" className={styles.primary}>{busy ? t("Calculating month…", "Рассчитываем месяц…") : t("Calculate month", "Рассчитать месяц")}</button>
        <button type="button" className={styles.secondary} disabled={!hasProfile} onClick={() => act({ type: "month-use-profile" })}>{t("Use profile location", "Место из профиля")}</button></div>
      </fieldset>
    </form>
    {busy && <p role="status" className={styles.hint}>{t("Calculating the monthly calendar. The result will appear here when it is ready.", "Рассчитываем месячный календарь. Результат появится здесь после завершения.")}</p>}
    {isMonthOutdated(state) && <p role="status" className={styles.stale}>{t("The form differs from the saved calendar. Calculate again to apply it.", "Форма отличается от сохранённого календаря. Рассчитай заново, чтобы применить изменения.")}</p>}
    {result ? <>
      <p>{result.input.month} · {result.input.place} · {result.input.timezone}</p>
      <p className={styles.hint}>{t("Elements are shown at sunrise. Expand Changes for every transition during that civil date. Days without sunrise have no sunrise-based values.", "Элементы показаны на восходе. В «Сменах» — все переходы за календарную дату. Для дней без восхода значения на восходе не назначаются.")}</p>
      <div className={styles.monthTableWrap}><table className={styles.monthTable}><caption className={styles.srOnly}>{t("Panchanga calendar", "Календарь панчанги")}</caption>
        <thead><tr>{[t("Date", "Дата"), t("Sunrise / sunset", "Восход / закат"), labels.tithi, labels.nakshatra, labels.yoga, labels.karana, t("Changes", "Смены")].map(x => <th key={x}>{x}</th>)}</tr></thead>
        <tbody>{result.days.map(day => {
          const changes = day.start && day.end ? PANCHANGA_PARTS.flatMap(part => result.intervals[part].filter(i => i.start.utc >= day.start!.utc && i.start.utc < day.end!.utc).map(i => ({ part, ...i }))).sort((a, b) => a.start.utc.localeCompare(b.start.utc)) : [];
          const civil = DateTime.fromISO(day.date, { zone: "UTC" }).setLocale("en");
          return <tr key={day.date}><th scope="row">{day.date}<small>{n(civil.weekdayLong!)}</small><small>{t("Vara", "Вара")}: {day.anchors.length ? n(VARA_LORDS[civil.weekday - 1]) : "—"}</small></th>{!day.start ? <td colSpan={6}>{t("This civil date was skipped in the selected time zone.", "Эта календарная дата была пропущена в выбранном часовом поясе.")}</td> : <>
            <td><div>{t("Rise", "Восход")}: {day.sunrises.length ? day.sunrises.map(e => <div key={e.jd}><EventTime value={e} compact /></div>) : "—"}</div>
              <div>{t("Set", "Закат")}: {day.sunsets.length ? day.sunsets.map(e => <div key={e.jd}><EventTime value={e} compact /></div>) : "—"}</div></td>
            <td>{day.anchors.map(a => <div key={a.at.jd}>{n(a.elements.paksha)} {(a.elements.tithi - 1) % 15 + 1}</div>)}{!day.anchors.length && "—"}</td>
            <td>{day.anchors.map(a => <div key={a.at.jd}>{n(a.elements.nakshatra)} / {a.elements.pada}</div>)}{!day.anchors.length && "—"}</td>
            <td>{day.anchors.map(a => <div key={a.at.jd}>{n(a.elements.yoga)}</div>)}{!day.anchors.length && "—"}</td>
            <td>{day.anchors.map(a => <div key={a.at.jd}>{n(a.elements.karana)}</div>)}{!day.anchors.length && "—"}</td>
            <td><details><summary>{t("Changes", "Смены")} ({changes.length})</summary><ul className={styles.monthChanges}>{changes.map(i => <li key={i.ref}><strong>{labels[i.part]}: {value(i.part, i.index)}</strong><EventTime value={i.start} compact /></li>)}</ul></details></td>
          </>}</tr>;
        })}</tbody>
      </table></div>
      <p className={styles.hint}>{t("Lahiri; Swiss Hindu sunrise (solar center, no refraction). Saved local offsets are retained. Independent JHora comparison is pending.", "Лахири; восход Swiss Hindu по центру Солнца, без рефракции. Местные смещения сохранены в результате. Независимая сверка с JHora ещё предстоит.")}</p>
    </> : <p>{t("Choose a month and location, then calculate. No birth time is required.", "Выбери месяц и место, затем рассчитай календарь. Время рождения не требуется.")}</p>}
  </section>;
}
