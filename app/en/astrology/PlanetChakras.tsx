import type { AstrologyCalculation } from "../../../lib/astrology/contracts";
import { SIGNS } from "../../../lib/astrology/contracts";
import { planetChakras, PLANET_CHAKRA_METHOD, PLANET_CHAKRA_SOURCE } from "../../../lib/astrology/planet-chakras";
import { signDignity } from "../../../lib/astrology/planet-condition";
import { astrologyName, type AstrologyLocale } from "../../../lib/astrology/workspace-copy";
import { PLANET_SHORT } from "./AstrologyChart";
import styles from "./workspace.module.css";

export function PlanetChakras({ result, locale }: { result: AstrologyCalculation | null; locale: AstrologyLocale }) {
  const t = (en: string, ru: string) => locale === "ru" ? ru : en;
  const name = (value: string) => astrologyName(value, locale);
  return <section aria-label={t("Planets and chakras", "Планеты на чакрах")}>
    <h3>{t("Planets and chakras", "Планеты на чакрах")}</h3>
    {!result ? <p className={styles.hint}>{t("Open or calculate a chart first.", "Сначала открой или рассчитай карту.")}</p> : <>
      <table className={styles.chakraTable} data-chakra-method={PLANET_CHAKRA_METHOD}>
        <caption className={styles.srOnly}>{t("D1 planets grouped by sign pairs", "Планеты D1 по парам знаков")}</caption>
        <thead><tr><th scope="col">{t("Signs", "Знаки")}</th><th scope="col">{t("Chakra", "Чакра")}</th><th scope="col">{t("Planets", "Планеты")}</th></tr></thead>
        <tbody>{planetChakras(result.planets).map(row => <tr key={row.chakra} data-chakra={row.chakra}>
          <td><abbr title={row.signs.map(sign => name(SIGNS[sign])).join(", ")}>{row.signs.map(sign => sign + 1).join(", ")}</abbr></td>
          <th scope="row">{row.chakra}</th><td>{row.planets.length ? row.planets.map(p => <abbr key={p.name} data-chakra-planet={p.name} title={`${name(p.name)} · ${name(SIGNS[p.sign])}${p.speed < 0 ? t(" · retrograde", " · ретроградно") : ""}`} style={signDignity(p.name, p.sign).own ? { textDecoration: "underline" } : undefined}>{p.speed < 0 ? `(${PLANET_SHORT[p.name]})` : PLANET_SHORT[p.name]}</abbr>) : "—"}</td>
        </tr>)}</tbody>
      </table>
      <details className={styles.chakraMethod}><summary>{t("Sign correspondences · D1", "Соответствия знаков · D1")}</summary>
        <p>{t("The six sign pairs follow the Astro.Expert table. Each natal planet appears once, including the nodes. Numbers refer to signs, not houses. Parentheses mark retrograde motion; an underline marks an own sign.", "Шесть пар знаков — как в таблице Astro.Expert. Каждая натальная планета, включая узлы, показана один раз. Числа обозначают знаки, а не дома. Скобки — ретроградность, подчёркивание — свой знак.")}</p>
        <a href={PLANET_CHAKRA_SOURCE} target="_blank" rel="noopener noreferrer">{t("Reference: Astro.Expert", "Образец: Astro.Expert")}</a>
      </details>
    </>}
  </section>;
}
