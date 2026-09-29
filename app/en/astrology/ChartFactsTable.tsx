import { memo } from "react";
import type { ChartFact } from "../../../lib/astrology/contracts";
import { SIGNS, type VargaChart } from "../../../lib/astrology/contracts";
import { charaKarakas } from "../../../lib/astrology/karakas-arudhas";
import { planetaryCombustion, signDignity } from "../../../lib/astrology/planet-condition";
import { dignityLabel } from "./PlanetConditions";
import { astrologyName, type AstrologyLocale } from "../../../lib/astrology/workspace-copy";
import { degreeLabel, PLANET_SHORT } from "./AstrologyChart";
import styles from "./workspace.module.css";
import { TermHint, karakaHint } from "./TermHint";

function ChartFactsTableView({ facts, locale, natal, compact = false, natalChart }: { facts: readonly ChartFact[]; locale: AstrologyLocale; natal: boolean; compact?: boolean; natalChart?: VargaChart }) {
  const t = (en: string, ru: string) => locale === "ru" ? ru : en;
  const n = (name: string) => name === "Lagna" ? t("Lagna", "Лагна") : astrologyName(name, locale);
  const roles = natalChart ? Object.fromEntries(charaKarakas(natalChart).rows.flatMap(row => row.planets.map(p => [p.name, row.role]))) : {};
  const physical = natal ? facts.flatMap(f => f.name !== "Lagna" && f.coordinateKind === "natal-sidereal" ? [{ name: f.name, longitude: f.longitude, speed: f.speed ?? NaN }] : []) : [];
  const marker = (f: ChartFact) => {
    if (f.name === "Lagna") return null;
    const d = signDignity(f.name, f.sign), c = planetaryCombustion(f.name, physical).status === "combust";
    return <span className={styles.conditionMark} title={`${dignityLabel(d, locale)}${c ? t(" · Combustion from D1", " · Сожжение по D1") : ""}`}>{d.exalted ? "↑" : d.debilitated ? "↓" : ""}{d.own ? t("Own", "Св") : ""}{c ? "*" : ""}</span>;
  };
  if (compact) return <div className={styles.compactTable} tabIndex={0} role="region" aria-label={t("Natal positions table", "Таблица натальных положений")}><table><caption className={styles.srOnly}>D1 · Lahiri</caption>
    <thead className={styles.srOnly}><tr><th>{t("Object", "Объект")}</th><th>{t("Karaka", "Карака")}</th><th>{t("Sign", "Знак")}</th><th>{t("Degree", "Градус")}</th><th>{t("Nakshatra", "Накшатра")}</th><th>{t("Pada", "Пада")}</th></tr></thead><tbody>{facts.map(f => <tr key={f.ref}><th scope="row"><TermHint text={f.name === "Lagna" ? t("Asc is the ascendant: the sign rising at the recorded birth time and place.", "Asc — асцендент: восходящий знак на указанное время и место рождения.") : n(f.name)}>{f.name === "Lagna" ? "Asc" : PLANET_SHORT[f.name]}</TermHint>{f.retrograde && <abbr title={t("Retrograde", "Ретроградное")}> ℞</abbr>}</th><td title={t("Eight natal chara karakas", "Восемь натальных чара-карак")}>{roles[f.name] ? <TermHint text={karakaHint(roles[f.name], locale)}>{roles[f.name]}</TermHint> : "—"}</td><td>{n(SIGNS[f.sign])}</td><td>{degreeLabel(f.longitude).replaceAll(" ", "")}{marker(f)}</td><td>{f.nakshatra ? <TermHint text={t("A nakshatra is one of 27 equal sectors of the sidereal zodiac; pada is its quarter.", "Накшатра — один из 27 равных участков сидерического зодиака; пада — её четверть.")}>{n(f.nakshatra)}</TermHint> : "—"}</td><td>{f.pada ?? "—"}</td></tr>)}</tbody>
  </table></div>;
  return <div className={styles.tableScroll} tabIndex={0} role="region" aria-label={t("Chart facts table", "Таблица фактов карты")}><table>
    <caption>{natal ? t("Natal sidereal positions · D1", "Натальные сидерические положения · D1") : t("Divisional positions · symbolic transformation", "Положения дробной карты · символическое преобразование")}</caption>
    <thead><tr><th>{t("Object", "Объект")}</th><th>{t("Sign", "Знак")}</th><th>{t("Degree in sign", "Градус в знаке")}</th><th>{t("Longitude", "Долгота")}</th><th>{t("House", "Дом")}</th>
      {natal && <><th>{t("Speed °/day", "Скорость °/сут")}</th><th>{t("Motion", "Движение")}</th><th>{t("Nakshatra / pada", "Накшатра / пада")}</th></>}<th>{t("Basis", "Основание")}</th></tr></thead>
    <tbody>{facts.map(f => <tr key={f.ref} data-fact-ref={f.ref}><th scope="row">{n(f.name)}</th><td>{n(SIGNS[f.sign])}</td><td>{degreeLabel(f.longitude)}{marker(f)}</td><td>{f.longitude.toFixed(8)}°</td><td>{f.house}</td>
      {natal && <><td>{f.speed?.toFixed(8) ?? "—"}</td><td>{f.retrograde === null ? "—" : f.retrograde ? t("Retrograde", "Ретроградное") : t("Direct", "Прямое")}</td><td>{f.nakshatra ? n(f.nakshatra) : "—"} / {f.pada ?? "—"}</td></>}
      <td><details><summary>{t("Reference", "Ссылка")}</summary><code>{f.ref}</code>{f.basisRef && <p>{f.basisRef}</p>}<p>{f.method}</p></details></td></tr>)}</tbody>
  </table></div>;
}
export const ChartFactsTable = memo(ChartFactsTableView);
