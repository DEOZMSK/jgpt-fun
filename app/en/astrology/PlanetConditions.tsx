import type { AstrologyCalculation, Varga } from "../../../lib/astrology/contracts";
import { SIGNS, VARGAS } from "../../../lib/astrology/contracts";
import { chartConditions, COMBUSTION_SOURCES, DIGNITY_SOURCE, MARS_MOOLATRIKONA_SOURCE, MOOLATRIKONA_METHOD, type SignDignity } from "../../../lib/astrology/planet-condition";
import { astrologyName, type AstrologyLocale } from "../../../lib/astrology/workspace-copy";
import { degreeLabel } from "./AstrologyChart";
import styles from "./workspace.module.css";

export function dignityLabel(d: SignDignity, locale: AstrologyLocale) {
  const ru = locale === "ru";
  return [d.exalted && (ru ? "Экзальтация" : "Exaltation"), d.debilitated && (ru ? "Падение" : "Debilitation"), d.own && (ru ? "Свой знак" : "Own sign")].filter(Boolean).join(" · ") || (d.supported ? "—" : ru ? "Правило не выбрано" : "Rule not selected");
}
export function ConditionLegend({ locale }: { locale: AstrologyLocale }) {
  return <p className={styles.conditionLegend}>{locale === "ru" ? "↑ экзальтация · ↓ падение · подчёркивание — свой знак · * сожжение по D1" : "↑ exaltation · ↓ debilitation · underline — own sign · * combustion from D1"}</p>;
}
export function PlanetConditions({ result, varga, locale, onSelect }: { result: AstrologyCalculation | null; varga: Varga; locale: AstrologyLocale; onSelect: (varga: Varga) => void }) {
  const t = (en: string, ru: string) => locale === "ru" ? ru : en;
  const selected = result?.charts[varga] ? varga : "D1", chart = result?.charts[selected];
  return <section className={styles.planetConditions} aria-label={t("Position readings", "Прочтение положений")}>
    <div className={styles.conditionHeading}><div><h2>{t("Position readings", "Прочтение положений")}</h2><p>{t("Sign dignity, moolatrikona and proximity to the Sun", "Достоинство в знаке, мулатрикона и близость к Солнцу")}</p></div>
      {result && <label>{t("Chart for dignities", "Карта для достоинств")}<select aria-label={t("Chart for dignities", "Карта для достоинств")} value={selected} onChange={e => onSelect(e.target.value as Varga)}>{VARGAS.filter(v => result.charts[v]).map(v => <option key={v} value={v}>{v}</option>)}</select></label>}</div>
    {!chart || !result ? <p>{t("Open or calculate a chart first.", "Сначала открой или рассчитай карту.")}</p> : <>
      <div className={styles.tableScroll} tabIndex={0}><table data-condition-varga={selected} data-moolatrikona-method={MOOLATRIKONA_METHOD}><caption>{selected} · {t("Sign rules for seven planets; moolatrikona and combustion always from D1", "Правила знаков для семи планет; мулатрикона и сожжение всегда по D1")}</caption>
        <thead><tr><th>{t("Planet", "Планета")}</th><th>{t("Position", "Положение")}</th><th>{t("Dignity", "Достоинство")}</th><th>{t("Combustion · D1", "Сожжение · D1")}</th><th>{t("Sun separation / orb", "От Солнца / порог")}</th><th>{t("Moolatrikona · D1", "Мулатрикона · D1")}</th></tr></thead>
        <tbody>{chartConditions(chart, result.planets).map(row => <tr key={row.name} data-condition-planet={row.name} data-combustion={row.combustion.status} data-moolatrikona={row.moolatrikona.status}>
          <th scope="row">{astrologyName(row.name, locale)}</th><td data-label={t("Position", "Положение")}>{astrologyName(SIGNS[row.sign], locale)}<small>{degreeLabel(row.longitude)}</small></td>
          <td data-label={t("Dignity", "Достоинство")}>{dignityLabel(row.dignity, locale)}</td><td data-label={t("Combustion · D1", "Сожжение · D1")}>{({ combust: t("Combust", "Сожжена"), clear: t("Outside orb", "Вне порога"), unavailable: t("Data unavailable", "Нет данных"), "not-applicable": t("Not applicable", "Не применяется") })[row.combustion.status]}</td>
          <td data-label={t("Sun separation / orb", "От Солнца / порог")}>{row.combustion.separation === null ? "—" : `${row.combustion.separation.toFixed(4)}° / < ${row.combustion.threshold}°`}</td>
          <td data-label={t("Moolatrikona · D1", "Мулатрикона · D1")}>{({ "in-range": t("In range", "В диапазоне"), "outside-range": t("Outside range", "Вне диапазона"), unavailable: t("Data unavailable", "Нет данных"), unselected: t("Rule not selected", "Правило не выбрано") })[row.moolatrikona.status]}
            {row.moolatrikona.range && <small>{astrologyName(SIGNS[row.moolatrikona.range.sign], locale)} · {row.moolatrikona.range.start}° ≤ d &lt; {row.moolatrikona.range.end}°</small>}
            {selected !== "D1" && row.moolatrikona.longitude !== null && <small>D1: {astrologyName(SIGNS[Math.floor(row.moolatrikona.longitude / 30)], locale)} {degreeLabel(row.moolatrikona.longitude)}</small>}
          </td>
        </tr>)}</tbody></table></div>
      <ConditionLegend locale={locale} />
      <details className={styles.details}><summary>{t("How these indicators are calculated", "Как считаются показатели")}</summary>
        <p>{t("Exaltation, debilitation and ownership refer to the entire sign, including divisional signs. Mercury in Virgo has two sign flags. Node dignities remain unselected.", "Экзальтация, падение и владение относятся ко всему знаку, в том числе в варгах. У Меркурия в Деве две отметки. Достоинства узлов пока не выбраны.")}</p>
        <p>{t("Moolatrikona follows Rao's seven-planet intervals, using unrounded natal D1 longitude. The lower bound is included and the upper bound excluded. The displayed sign range remains separate from the selected varga's dignity; d is the degree within that sign. Mars uses Aries from table 6, corroborated by Hora Sara 2.8; the Leo wording in Rao's paragraph conflicts with his table.", "Мулатрикона определяется по интервалам Рао для семи планет и неокруглённой натальной долготе D1. Нижняя граница включена, верхняя исключена; d — градус внутри указанного знака. Диапазон D1 показан отдельно от достоинства в выбранной варге. Для Марса принят Овен из таблицы 6, подтверждённый в «Хора Сара» 2.8: упоминание Льва в абзаце Рао противоречит его таблице.")}</p>
        <p>{t("Combustion uses the shorter D1 longitude arc to the Sun, strictly below the stated orb. Mercury: 14° direct / 12° retrograde; Venus: 10° / 8°; Moon: 12°; Mars: 17°; Jupiter: 11°; Saturn: 15°. This is an angular convention, not local sky visibility or a complete strength assessment.", "Сожжение — меньшая дуга долгот D1 до Солнца, строго меньше порога. Меркурий: 14° прямо / 12° ретроградно; Венера: 10° / 8°; Луна: 12°; Марс: 17°; Юпитер: 11°; Сатурн: 15°. Это угловое правило, а не расчёт видимости на небе или полной силы планеты.")}</p>
        <p><a href={DIGNITY_SOURCE} target="_blank" rel="noopener noreferrer">{t("Dignities: P. V. R. Narasimha Rao, table 6 and notes", "Достоинства: П. В. Р. Нарасимха Рао, таблица 6 и пояснения")}</a> · <a href={MARS_MOOLATRIKONA_SOURCE} target="_blank" rel="noopener noreferrer">{t("Mars: Hora Sara 2.8", "Марс: Хора Сара 2.8")}</a></p>
        <p>{t("Orbs described by Drik Panchang:", "Пороги, описанные Drik Panchang:")} {Object.entries(COMBUSTION_SOURCES).map(([name, href]) => <a key={name} href={href} target="_blank" rel="noreferrer">{astrologyName(name, locale)} </a>)}</p>
      </details>
    </>}
  </section>;
}
