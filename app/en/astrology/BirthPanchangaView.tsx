import type { AstrologyCalculation } from "../../../lib/astrology/contracts";
import { PANCHANGA_PARTS, type PanchangaInstant } from "../../../lib/astrology/panchanga-contract";
import { astrologyName, type AstrologyLocale } from "../../../lib/astrology/workspace-copy";
import styles from "./workspace.module.css";

export function EventTime({ value, compact = false }: { value: PanchangaInstant; compact?: boolean }) {
  const local = value.local;
  const offsetSeconds = local ? Math.round(Math.abs(local.utcOffsetMinutes) * 60) : 0;
  const pad = (n: number) => String(n).padStart(2, "0");
  const offset = local ? `${local.utcOffsetMinutes < 0 ? "−" : "+"}${pad(Math.floor(offsetSeconds / 3600))}:${pad(Math.floor(offsetSeconds % 3600 / 60))}${offsetSeconds % 60 ? `:${pad(offsetSeconds % 60)}` : ""}` : "";
  return <time dateTime={value.utc} title={`${value.utc} · JD ${value.scale} ${value.jd}`}>
    {(local?.dateTime ?? value.utc).slice(compact ? 11 : 0, 19).replace("T", " ")}<small> UTC{offset}</small>
  </time>;
}

export function BirthPanchangaView({ result, locale }: { result: AstrologyCalculation; locale: AstrologyLocale }) {
  const t = (en: string, ru: string) => locale === "ru" ? ru : en;
  const n = (name: string) => astrologyName(name, locale), p = result.panchanga;
  const details = "panchangaDetails" in result ? result.panchangaDetails : null;
  const labels = { tithi: t("Tithi", "Титхи"), nakshatra: t("Nakshatra / pada", "Накшатра / пада"), yoga: t("Yoga", "Йога"), karana: t("Karana", "Карана") };
  const values = { tithi: `${n(p.paksha)} ${(p.tithi - 1) % 15 + 1}`, nakshatra: `${n(p.nakshatra)} / ${p.pada}`, yoga: n(p.yoga), karana: n(p.karana) };
  const dayEvents = details?.solarEvents.filter(e => e.at.jd >= details.civilDay.start.jd && e.at.jd < details.civilDay.end.jd) ?? [];
  return <section aria-label={t("Birth panchanga details", "Подробная панчанга рождения")}>
    <p className={styles.hint}>{t("At the birth instant", "На момент рождения")} · {result.birth.date} {result.birth.time} · {result.birth.timezone}</p>
    <div className={styles.panchangaTableWrap}><table className={styles.panchangaTable}>
      <caption>{t("Elements and their intervals", "Элементы и их интервалы")}</caption>
      <thead><tr><th>{t("Element", "Элемент")}</th><th>{t("Value", "Значение")}</th>{details && <><th>{t("Starts", "Начало")}</th><th>{t("Ends", "Окончание")}</th></>}</tr></thead>
      <tbody>{PANCHANGA_PARTS.map(part => <tr key={part}><th scope="row">{labels[part]}</th><td>{values[part]}</td>{details && <><td><EventTime value={details.intervals[part].start} /></td><td><EventTime value={details.intervals[part].end} /></td></>}</tr>)}</tbody>
    </table></div>
    <p className={styles.hint}>{t("Civil weekday", "Календарный день недели")}: {n(p.civilWeekday)}.</p>
    {!details ? <p>{t("This saved version has no sunrise or element intervals. Calculate a new chart to add them; this snapshot remains unchanged.", "В этой версии снимка нет восхода и интервалов элементов. Выполни новый расчёт, чтобы добавить их; прежний снимок останется неизменным.")}</p> : <>
      <dl className={styles.facts}>
        {(["sunrise", "sunset"] as const).map(kind => <div key={kind}><dt>{kind === "sunrise" ? t("Sunrise on the civil date", "Восход в календарную дату") : t("Sunset on the civil date", "Закат в календарную дату")}</dt>
          <dd>{dayEvents.some(e => e.kind === kind) ? dayEvents.filter(e => e.kind === kind).map(e => <div key={e.ref}><EventTime value={e.at} /></div>) : t("No event on this date", "В эту дату события нет")}</dd></div>)}
        <div><dt>{t("Vara at birth", "Вара при рождении")}</dt><dd>{details.vara.status === "available" ? <>
          <strong>{n(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][details.vara.weekday - 1])} · {n(details.vara.lord)}</strong>
          <div><EventTime value={details.vara.start} /> — <EventTime value={details.vara.end} /></div>
        </> : t("Unavailable: no daily sunrise pair around birth. A polar-day rule has not been selected.", "Не определена: вокруг рождения нет пары ежедневных восходов. Правило для полярного дня не выбрано.")}</dd></div>
      </dl>
      <p className={styles.hint}>{t("Lahiri · sunrise at the solar center, without refraction. Times use the saved local offset. Independent comparison with JHora is pending.", "Лахири · восход по центру Солнца, без рефракции. Время показано с сохранённым местным смещением. Независимая сверка с JHora ещё предстоит.")}</p>
    </>}
  </section>;
}
