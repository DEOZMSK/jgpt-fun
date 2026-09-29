"use client";

import { DateTime } from "luxon";
import { solarPeriodAt, solarPeriodSelection, type DaySolarPeriod } from "../../../lib/astrology/day-solar-periods";
import { muhurtaDefinition, MUHURTA_NAMES_SOURCE, type MuhurtaQuality } from "../../../lib/astrology/muhurta-definitions";
import { astrologyName, type AstrologyLocale } from "../../../lib/astrology/workspace-copy";
import styles from "./workspace.module.css";

export function muhurtaQualityLabel(quality: MuhurtaQuality, locale: AstrologyLocale) {
  const labels = { favorable: ["Favorable", "Благоприятная"], unfavorable: ["Unfavorable", "Неблагоприятная"], restricted: ["Wednesday restriction", "Ограничение среды"] };
  return labels[quality][locale === "ru" ? 1 : 0];
}

export function SolarDivisionDetails({ periods, at, start, end, zone, locale, onChoose }: {
  periods: readonly DaySolarPeriod[]; at: number; start: number; end: number; zone: string; locale: AstrologyLocale; onChoose: (utc: string) => void;
}) {
  const t = (en: string, ru: string) => locale === "ru" ? ru : en;
  const label = (time: number) => DateTime.fromMillis(time, { zone }).setLocale(locale).toFormat("dd LLL HH:mm:ss ZZ");
  const half = (p: DaySolarPeriod) => p.half === "night" ? t("Night", "Ночь") : t("Day", "День");
  const selected = solarPeriodAt(periods, "muhurta", at), eighth = solarPeriodAt(periods, "yamardha", at);
  const definition = selected ? muhurtaDefinition(selected) : null;
  const visible = periods.filter(p => p.kind === "muhurta" && p.start < end && p.end > start);
  return <section className={styles.solarDetails} aria-label={t("Solar divisions at the selected moment", "Солнечные периоды выбранного момента")}>
    <div className={styles.solarSelection}>
      <section data-selected-muhurta={selected ? `${selected.half}/${selected.index + 1}` : "unavailable"}>
        <h3>{t("Selected muhurta", "Выбранная мухурта")}</h3>
        {selected && definition ? <>
          <p className={styles.solarPeriodName}>{half(selected)} · {selected.index + 1}. {astrologyName(definition.name, locale)}</p>
          <p><time>{label(selected.start)}</time><br /><time>{label(selected.end)}</time></p>
          <span className={styles.solarQuality} data-quality={definition.quality}>{muhurtaQualityLabel(definition.quality, locale)}</span>
          {definition.restriction && <p>{t("This daytime division coincides with Abhijit, which this convention does not use on Wednesday.", "Это дневное деление совпадает с Абхиджитом, который в выбранном методе не используется по средам.")}</p>}
        </> : <p>{t("The necessary sunrise and sunset pair is unavailable.", "Нет необходимой пары восхода и заката.")}</p>}
      </section>
      <section data-selected-yamardha={eighth ? `${eighth.half}/${eighth.index + 1}` : "unavailable"}>
        <h3>{t("Selected eighth", "Выбранная ямардха")}</h3>
        {eighth ? <><p className={styles.solarPeriodName}>{half(eighth)} · {eighth.index + 1} / 8</p><p><time>{label(eighth.start)}</time><br /><time>{label(eighth.end)}</time></p><p>{t("One eighth of this actual daylight or night interval.", "Одна восьмая реального светового дня или ночи.")}</p></> : <p>{t("The necessary sunrise and sunset pair is unavailable.", "Нет необходимой пары восхода и заката.")}</p>}
      </section>
    </div>
    <p className={styles.hint}>{t("Names and base traditional ratings follow Do Ghati. Other panchanga conditions are needed for a complete electional assessment.", "Названия и базовые традиционные оценки — по методу До-гхати. Для полного подбора времени учитываются и другие показатели панчанги.")} <a href={MUHURTA_NAMES_SOURCE} target="_blank" rel="noreferrer">{t("Method source", "Источник метода")}</a></p>
    {visible.length > 0 && <details className={styles.details}><summary>{t("All day and night muhurtas", "Все мухурты дня и ночи")}</summary>
      <div className={styles.tableScroll} role="region" tabIndex={0} aria-label={t("Day and night muhurta table", "Таблица дневных и ночных мухурт")}><table><thead><tr>{[t("Division", "Период"), t("Name", "Название"), t("Traditional rating", "Традиционная оценка"), t("Start", "Начало"), t("End", "Конец")].map(name => <th key={name}>{name}</th>)}</tr></thead><tbody>
        {visible.map(period => { const d = muhurtaDefinition(period)!, choice = solarPeriodSelection(period, start, end), active = period === selected;
          return <tr key={`${period.start}/${period.half}/${period.index}`} aria-current={active ? "time" : undefined}>
            <th scope="row"><button className={styles.solarTimeButton} type="button" disabled={choice === null} onClick={() => choice !== null && onChoose(new Date(choice).toISOString())} aria-label={`${t("Select", "Выбрать")}: ${half(period)} ${period.index + 1}, ${astrologyName(d.name, locale)}, ${label(choice ?? period.start)}`}>{half(period)} {period.index + 1}</button></th>
            <td>{astrologyName(d.name, locale)}</td><td><span className={styles.solarQuality} data-quality={d.quality}>{muhurtaQualityLabel(d.quality, locale)}</span></td><td>{label(period.start)}</td><td>{label(period.end)}</td>
          </tr>;
        })}
      </tbody></table></div>
    </details>}
  </section>;
}
