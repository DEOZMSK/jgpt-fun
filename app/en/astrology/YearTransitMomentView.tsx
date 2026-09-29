"use client";
import { useState } from "react";
import { SIGNS } from "../../../lib/astrology/contracts";
import { nakshatraAt } from "../../../lib/astrology/jyotish";
import { yearDirectionIntervals, yearSignIntervals } from "../../../lib/astrology/timeline-layout";
import type { TransitDraft, TransitWorkspace } from "../../../lib/astrology/transit-contract";
import { yearMomentReady } from "../../../lib/astrology/year-transit-moment";
import type { YearTransitWorkspace } from "../../../lib/astrology/year-transit-contract";
import { EVENT_PLANETS } from "../../../lib/astrology/year-transit-contract";
import { astrologyName, type AstrologyLocale } from "../../../lib/astrology/workspace-copy";
import type { WorkspaceAction } from "../../../lib/local-workspace/controller";
import { AstrologyChart, degreeLabel, PLANET_SHORT } from "./AstrologyChart";
import { YEAR_PLANET_COLORS } from "./YearTransitRibbon";
import { CitySearch, type CityChoice } from "./CitySearch";
import styles from "./workspace.module.css";

export function YearTransitMomentView({ year, moment, locale, southern, hasProfile, busy, act }: {
  year: YearTransitWorkspace; moment: TransitWorkspace; locale: AstrologyLocale; southern: boolean; hasProfile: boolean; busy: boolean; act: (action: WorkspaceAction) => void;
}) {
  const t = (en: string, ru: string) => locale === "ru" ? ru : en, n = (name: string) => astrologyName(name, locale);
  const [chosenCity, setChosenCity] = useState<CityChoice | null>(null);
  const [locationOpen, setLocationOpen] = useState(!moment.draft.latitude || !moment.draft.longitude);
  const cityZone = chosenCity && chosenCity.name === moment.draft.place && String(chosenCity.latitude) === moment.draft.latitude && String(chosenCity.longitude) === moment.draft.longitude ? chosenCity.timezone : null;
  const r = yearMomentReady(year, moment) ? moment.result : null;
  const field = (key: Exclude<keyof TransitDraft, "nodes" | "timezone">, label: string, type = "text") => <label className={styles.field}><span>{label}</span><input type={type} value={moment.draft[key]} required={key !== "utcOffsetMinutes"} autoComplete="off" maxLength={key === "place" ? 120 : 80}
    {...(type === "date" ? { min: `${year.result?.input.year}-01-01`, max: `${year.result?.input.year}-12-31` } : {})} {...(type === "time" ? { step: 1 } : {})}
    onInput={e => { if (type === "date" || type === "time") act(key === "date" && e.currentTarget.value.length === 10 ? { type: "year-moment-select", date: e.currentTarget.value } : { type: "year-moment-edit", patch: { [key]: e.currentTarget.value } }); }}
    onChange={e => { if (type !== "date" && type !== "time") act({ type: "year-moment-edit", patch: { [key]: e.target.value } }); }} /></label>;
  const rows = r ? [{ name: "Lagna", sign: Math.floor(r.ascendant / 30), longitude: r.ascendant, speed: null, nakshatra: nakshatraAt(r.ascendant).name, pada: nakshatraAt(r.ascendant).pada }, ...r.planets] : [];
  const contains = (start: string, end: string) => !!r && Date.parse(start) <= Date.parse(r.instant.utc) && Date.parse(r.instant.utc) < Date.parse(end);
  const dateLabel = (value: { utc: string; local: { dateTime: string } | null }) => (value.local?.dateTime ?? value.utc).replace("T", " ").slice(0, 19);
  return <section aria-label={t("Selected transit moment", "Выбранный момент транзита")} className={styles.yearMoment}>
    <h2>{t("Positions on the selected date", "Положения на выбранную дату")}</h2>
    <form onSubmit={e => { e.preventDefault(); act({ type: "year-moment-calculate" }); }}>
      <div className={styles.monthForm}>{field("date", t("Selected transit date", "Выбранная дата транзита"), "date")}{field("time", t("Local time", "Местное время"), "time")}<p className={styles.hint}>{year.result?.input.timezone} · {t("Lahiri", "Лахири")}<br />{t("The chart uses the location below.", "Карта строится для места ниже.")}</p></div>
      <details className={styles.details} open={locationOpen} onToggle={event => setLocationOpen(event.currentTarget.open)}><summary>{t("Location and time clarification", "Место и уточнение времени")}</summary>
        <div className={styles.monthForm}><CitySearch label={t("Moment location", "Место расчёта")} value={moment.draft.place} locale={locale} disabled={busy}
          onChange={place => { setChosenCity(null); act({ type: "year-moment-edit", patch: { place, latitude: "", longitude: "", utcOffsetMinutes: "" } }); }}
          onSelect={city => { setChosenCity(city); act({ type: "year-moment-edit", patch: { place: city.name, latitude: String(city.latitude), longitude: String(city.longitude), utcOffsetMinutes: "" } }); }} />
          {field("latitude", t("Moment latitude", "Широта расчёта"))}{field("longitude", t("Moment longitude", "Долгота расчёта"))}{field("utcOffsetMinutes", t("Confirmed UTC offset, minutes (optional)", "Подтверждённое смещение UTC, минуты (необязательно)"))}</div>
        <p className={styles.hint}>{t("Choose a city to fill its coordinates, or enter them manually. This chart and the yearly timeline share a time zone:", "Выбери город для заполнения координат или укажи их вручную. У этой карты и годовой ленты общий часовой пояс:")} {year.result?.input.timezone}.</p>
        {cityZone && cityZone !== year.draft.timezone && <p className={styles.hint} role="status">{t("The selected city's time zone is", "Часовой пояс выбранного города")} {cityZone}. {t("To use it, apply it in the year settings and calculate the year again.", "Чтобы использовать его, примени его в настройках года и рассчитай год заново.")} <a href="#year-transit-settings" className={styles.secondary} onClick={e => { if (busy) { e.preventDefault(); return; } act({ type: "year-transits-edit", patch: { timezone: cityZone } }); }}>{t("Apply city zone in year settings", "Применить пояс города в настройках года")}</a></p>}
        <p className={styles.hint}>{t("Enter the location explicitly. For a repeated local clock, confirm its UTC offset. Changing the date or time clears that confirmation.", "Укажи место явно. При повторяющемся местном времени подтверди смещение UTC. Смена даты или времени сбрасывает это подтверждение.")}</p>
        <button className={styles.secondary} type="button" disabled={!hasProfile || busy} onClick={() => act({ type: "year-moment-use-profile" })}>{t("Copy location from the open profile", "Взять место из открытого профиля")}</button>
      </details>
      <div className={styles.monthActions}><button type="submit" className={styles.primary} disabled={busy}>{busy ? t("Calculating…", "Рассчитываем…") : t("Calculate selected moment", "Рассчитать выбранный момент")}</button><button type="button" className={styles.secondary} disabled={busy} onClick={() => act({ type: "year-moment-now" })}>{t("Current moment", "Текущий момент")}</button></div>
    </form>
    {r ? <div data-year-moment-utc={r.instant.utc}>
      <p>{r.instant.date} · {r.instant.time} · {r.instant.place} · {r.instant.timezone}<br /><time dateTime={r.instant.utc}>{r.instant.utc}</time></p>
      <div className={styles.yearMomentPreview}><section><h3>{t("Planetary motion", "Движение планет")}</h3><div className={styles.yearPlanetList}>{r.planets.filter(p => p.name !== "Moon").map(p => {
        const sign = yearSignIntervals(year.result!, p.name).find(i => contains(i.start.utc, i.end.utc));
        const direction = yearDirectionIntervals(year.result!, p.name).find(i => contains(i.start.utc, i.end.utc));
        return <div key={p.name}><abbr style={{ background: YEAR_PLANET_COLORS[EVENT_PLANETS.indexOf(p.name)] }} title={n(p.name)}>{PLANET_SHORT[p.name]}</abbr><div><p>{n(p.name)} · {n(SIGNS[p.sign])} <span title={`${p.longitude.toFixed(8)}°`}>{degreeLabel(p.longitude)}</span></p>{sign && <small>{dateLabel(sign.start)} — {dateLabel(sign.end)}</small>}<p>{p.speed < 0 ? t("Retrograde motion", "Ретроградное движение") : t("Direct motion", "Прямое движение")}</p>{direction && <small>{dateLabel(direction.start)} — {dateLabel(direction.end)}</small>}</div></div>;
      })}</div><p className={styles.hint}>{t("Interval boundaries are limited to this year. All times use the year’s time zone.", "Границы интервалов ограничены этим годом. Время указано в часовом поясе года.")}</p></section>
        <section><h3>{t("Planets in signs", "Планеты в знаках")}</h3><AstrologyChart chart={r.chart} varga="D1" southern={southern} locale={locale} />
          <div className={styles.tableScroll} role="region" tabIndex={0} aria-label={t("Selected moment positions", "Положения выбранного момента")}><table><caption>{t("Selected moment positions", "Положения выбранного момента")}</caption><thead><tr>{[t("Object", "Объект"), t("Sign", "Знак"), t("Degree", "Градус"), t("Nakshatra / pada", "Накшатра / пада")].map(x => <th key={x}>{x}</th>)}</tr></thead><tbody>{rows.map(p => <tr key={p.name}><th scope="row">{p.name === "Lagna" ? "Asc" : PLANET_SHORT[p.name as keyof typeof PLANET_SHORT]}{p.speed !== null && p.speed < 0 ? " ℞" : ""}</th><td>{n(SIGNS[p.sign])}</td><td>{degreeLabel(p.longitude)}</td><td>{n(p.nakshatra)} / {p.pada}</td></tr>)}</tbody></table></div>
        </section></div>
    </div> : <p className={styles.hint} role="status">{busy ? t("Updating the selected moment…", "Обновляем выбранный момент…") : t("Set the location and time, then calculate the moment. Choosing another day will update the positions and chart.", "Укажи место и время, затем рассчитай момент. При выборе другого дня положения и карта обновятся.")}</p>}
  </section>;
}
