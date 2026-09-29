"use client";

import { DateTime } from "luxon";
import type { DayPanchangaResult } from "../../../lib/astrology/day-panchanga-contract";
import { karanaDetails, nakshatraDetails, panchangaIntervalAt, PANCHANGA_DETAIL_SOURCES, tithiDetails, yogaDetails, yogaRestriction } from "../../../lib/astrology/panchanga-details";
import { PANCHANGA_PARTS, type PanchangaPart } from "../../../lib/astrology/panchanga-contract";
import { astrologyName, type AstrologyLocale } from "../../../lib/astrology/workspace-copy";
import styles from "./workspace.module.css";

const NATURE_LABELS = {
  quick: ["Quick · Kshipra", "Быстрая · Кшипра"], fierce: ["Fierce · Ugra", "Суровая · Угра"], mixed: ["Mixed · Mishra", "Смешанная · Мишра"],
  fixed: ["Fixed · Dhruva", "Постоянная · Дхрува"], gentle: ["Gentle · Mridu", "Мягкая · Мриду"], sharp: ["Sharp · Tikshna", "Острая · Тикшна"], movable: ["Movable · Chara", "Подвижная · Чара"],
} as const;

export function PanchangaLimbDetails({ result, locale, onChoose }: {
  result: DayPanchangaResult; locale: AstrologyLocale; onChoose: (utc: string) => void;
}) {
  const t = (en: string, ru: string) => locale === "ru" ? ru : en, n = (name: string) => astrologyName(name, locale);
  const at = Date.parse(result.moment.instant.utc), civilStart = Date.parse(result.start.utc), civilEnd = Date.parse(result.end.utc);
  const label = (ms: number) => DateTime.fromMillis(ms, { zone: result.input.timezone }).setLocale(locale).toFormat("dd LLL HH:mm:ss ZZ");
  const partName = (part: PanchangaPart) => ({ tithi: t("Tithi", "Титхи"), nakshatra: t("Moon nakshatra", "Накшатра Луны"), yoga: t("Nitya yoga", "Нитья-йога"), karana: t("Karana", "Карана") })[part];
  const jump = (ms: number, title: string) => {
    const choice = Math.ceil(ms / 1000) * 1000;
    return choice >= civilStart && choice < civilEnd ? <button className={styles.solarTimeButton} type="button" onClick={() => onChoose(new Date(choice).toISOString())}>{title}</button> : null;
  };
  return <section className={styles.limbDetails} aria-label={t("Panchanga at the selected moment", "Панчанга выбранного момента")} data-limb-moment-utc={result.moment.instant.utc}>
    <h3>{t("Panchanga at the selected moment", "Панчанга выбранного момента")}</h3>
    <div className={styles.limbGrid}>{PANCHANGA_PARTS.map(part => {
      const interval = panchangaIntervalAt(result.intervals[part], part, at);
      if (!interval) return <section key={part} data-limb={part}><h4>{partName(part)}</h4><p>{t("No interval is available for this moment.", "Для этого момента нет подтверждённого интервала.")}</p></section>;
      const start = Date.parse(interval.start.utc), end = Date.parse(interval.end.utc);
      const ti = part === "tithi" ? tithiDetails(interval.index) : null, na = part === "nakshatra" ? nakshatraDetails(interval.index) : null;
      const yo = part === "yoga" ? yogaDetails(interval.index) : null, ka = part === "karana" ? karanaDetails(interval.index) : null;
      const definition = (ti ?? na ?? yo ?? ka)!, restriction = yo ? yogaRestriction(interval.index, start, end) : null;
      const restricted = restriction !== null && at >= restriction.start && at < restriction.end;
      return <section key={part} data-limb={part} data-limb-index={interval.index}>
        <h4>{partName(part)}</h4>
        <p className={styles.limbName}>{ti ? `${n(ti.paksha)} · ${ti.pakshaNumber}. ` : `${definition.number}. `}{n(definition.name)}</p>
        <dl>
          <div><dt>{t("Start", "Начало")}</dt><dd><time dateTime={interval.start.utc}>{label(start)}</time></dd></div>
          <div><dt>{t("End", "Конец")}</dt><dd><time dateTime={interval.end.utc}>{label(end)}</time></dd></div>
          {(ti || na) && <div><dt>{na ? t("Vimshottari lord", "Управитель Вимшоттари") : t("Planetary lord", "Планета-управитель")}</dt><dd>{n((ti ?? na)!.lord)}</dd></div>}
          <div><dt>{t("Presiding deity", "Покровитель")}</dt><dd>{n(definition.deity)}</dd></div>
          {ti && <div><dt>{t("Tithi group", "Группа титхи")}</dt><dd>{n(ti.group)}</dd></div>}
          {na && <div><dt>{t("Nature", "Тип")}</dt><dd>{NATURE_LABELS[na.nature][locale === "ru" ? 1 : 0]}</dd></div>}
          {ka && <><div><dt>{t("Cycle", "Цикл")}</dt><dd>{ka.fixed ? t("Fixed karana", "Неподвижная карана") : t("Repeating karana", "Повторяющаяся карана")}</dd></div><div><dt>{t("Half of tithi", "Половина титхи")}</dt><dd>{ka.half} / 2 · {n(tithiDetails(ka.tithiIndex)!.name)}</dd></div></>}
        </dl>
        {ka && <p className={styles.limbRating} data-limb-quality={ka.quality}>{ka.quality === "restricted" ? t("Vishti: restricted for auspicious rites", "Вишти: ограничение для благоприятных начинаний") : ka.quality === "favorable" ? t("Base nature: favorable", "Базовое свойство: благоприятная") : t("Suitability depends on the activity", "Подходит в зависимости от занятия")}</p>}
        {yo && <div className={styles.limbRating} data-yoga-restriction={restricted ? "active" : restriction ? "ended" : "none"}>
          <p>{restricted ? t("Traditional restriction is active", "Традиционное ограничение действует") : restriction ? t("The initial restriction has ended", "Начальное ограничение завершилось") : t("No restriction listed for this yoga in the selected rule", "Для этой йоги в выбранном правиле ограничение не указано")}</p>
          {restriction && <><p>{restriction.rule === "whole" ? t("Whole yoga", "Вся йога") : restriction.rule === "first-half" ? t("First half of the actual yoga interval", "Первая половина реального интервала йоги") : t(`First ${restriction.nadikas} nadikas · 24 minutes each`, `Первые ${restriction.nadikas} надики · по 24 минуты`)}<br /><time>{label(restriction.start)}</time><br /><time>{label(restriction.end)}</time></p>{restricted && jump(restriction.end, t("To the restriction end", "К концу ограничения"))}</>}
        </div>}
        <div className={styles.limbNext}>{jump(end, `${t("Next", "Далее")}: ${partName(part)}`)}</div>
      </section>;
    })}</div>
    <p className={styles.hint}>{t("The cards follow the selected time. Full interval bounds may lie on another date. These traditional properties do not by themselves rate the whole day or a personal event.", "Карточки следуют выбранному времени. Полные границы периода могут приходиться на другую дату. Эти традиционные свойства сами по себе не определяют качество всего дня или личного события.")}</p>
    <details className={styles.details}><summary>{t("Traditions used in these cards", "Традиции в этих карточках")}</summary><ul>
      <li><a href={PANCHANGA_DETAIL_SOURCES.tithi} target="_blank" rel="noreferrer">{t("Brihat Samhita 99", "Брихат-самхита, глава 99")}</a>{t(": tithi and karana deities; five tithi groups; karana suitability. Other deity lists exist.", ": покровители титхи и каран, пять групп титхи, свойства каран. В других традициях списки покровителей отличаются.")}</li>
      <li><a href={PANCHANGA_DETAIL_SOURCES.lords} target="_blank" rel="noreferrer">P. V. R. Narasimha Rao · Tables 2–3</a>{t(": nakshatra and tithi planetary lords. Full Moon is Saturn; New Moon is Rahu.", ": планеты-управители накшатр и титхи. Пурнима — Сатурн, амавасья — Раху.")}</li>
      <li><a href={PANCHANGA_DETAIL_SOURCES.narada} target="_blank" rel="noreferrer">{t("Narada Purana 56.168–170, 211–215", "Нарада-пурана 56.168–170, 211–215")}</a>{t(": nakshatra/yoga deities and yoga restriction windows. A nadika here is 24 elapsed minutes; Parigha uses half the actual interval.", ": покровители накшатр и йог, ограниченные участки йог. Надика здесь — 24 минуты; для Паригхи берётся половина реального интервала.")}</li>
      <li><a href={PANCHANGA_DETAIL_SOURCES.nature} target="_blank" rel="noreferrer">Drik Panchang</a>{t(": seven nakshatra types, using the 27 equal sectors without a separate Abhijit.", ": семь типов накшатр, для 27 равных секторов без отдельного Абхиджита.")}</li>
    </ul></details>
  </section>;
}
