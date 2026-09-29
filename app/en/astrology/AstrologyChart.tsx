"use client";
import { memo } from "react";
import { SIGNS, type PlanetName, type PlanetPosition, type Varga, type VargaChart } from "../../../lib/astrology/contracts";
import { planetaryCombustion, signDignity } from "../../../lib/astrology/planet-condition";
import { astrologyName, type AstrologyLocale } from "../../../lib/astrology/workspace-copy";
import type { ChartOverlay } from "../../../lib/astrology/chart-overlay";
import { chartTextRows, type ChartTextToken } from "../../../lib/astrology/chart-text-layout";
import styles from "./workspace.module.css";
export const PLANET_SHORT: Record<PlanetName, string> = { Sun: "Su", Moon: "Mo", Mars: "Ma", Mercury: "Me", Jupiter: "Jp", Venus: "Ve", Saturn: "Sa", Rahu: "Ra", Ketu: "Ke" };

export function degreeLabel(longitude: number) {
  const seconds = Math.floor((longitude % 30) * 3600 + 1e-7);
  return `${Math.floor(seconds / 3600)}° ${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}′ ${String(seconds % 60).padStart(2, "0")}″`;
}

// House order is anticlockwise from the upper central diamond. Zodiac signs
// rotate with the ascendant; this is a vector chart of the actual calculation.
import { NORTH_CELLS, SOUTH_CELLS, NORTH_SIGN_LABELS } from "../../../lib/astrology/chart-geometry";
export { NORTH_CELLS, SOUTH_CELLS, NORTH_SIGN_LABELS } from "../../../lib/astrology/chart-geometry";
function AstrologyChartView({ chart, varga, southern, locale, referenceSign, overlay, physical }: { chart: VargaChart; varga: Varga; southern: boolean; locale: AstrologyLocale; referenceSign?: number; overlay?: ChartOverlay | null; physical?: readonly PlanetPosition[] }) {
  const ascendantSign = Math.floor(chart.ascendant / 30);
  function bodyLines(sign: number, points: string, reserved?: readonly number[]) {
    const tokens: ChartTextToken[] = [
      ...(ascendantSign === sign ? [{ label: "Asc", layer: "natal" as const }] : []),
      ...chart.planets.filter(p => p.sign === sign).map(p => {
        const d = signDignity(p.name, p.sign), c = physical ? planetaryCombustion(p.name, physical).status === "combust" : false;
        const ru = locale === "ru";
        return { label: `${PLANET_SHORT[p.name]}${d.exalted ? "↑" : d.debilitated ? "↓" : ""}${c ? "*" : ""}`, compactLabel: PLANET_SHORT[p.name], layer: "natal" as const, planet: p.name, own: d.own,
          title: [astrologyName(p.name, locale), d.exalted && (ru ? "Экзальтация" : "Exaltation"), d.debilitated && (ru ? "Падение" : "Debilitation"), d.own && (ru ? "Свой знак" : "Own sign"), c && (ru ? "Сожжение по D1" : "Combustion from D1")].filter(Boolean).join(" · ") };
      }),
      ...(overlay?.markers.filter(p => p.sign === sign).map(p => ({ label: PLANET_SHORT[p.name], layer: overlay.mode, ref: p.ref })) ?? [])
    ];
    return chartTextRows(points, tokens, reserved).map((row, index) => <text className={styles.chartBody} key={index} x={row.x} y={row.y} style={{ fontSize: row.fontSize }} textAnchor="middle" data-chart-layer={row.tokens[0].layer} data-chart-sign={sign}>
      {row.tokens.map((token, i) => <tspan key={i} data-fact-ref={token.ref} data-chart-planet={token.planet} style={token.own ? { textDecoration: "underline" } : undefined}>{token.title && <title>{token.title}</title>}{i ? " " : ""}{token.label}</tspan>)}
    </text>);
  }
  return <svg viewBox="-1 -1 402 402" className={styles.chart} role="img" aria-label={locale === "ru" ? `${varga}, ${southern ? "южный" : "северный"} стиль, асцендент ${astrologyName(SIGNS[ascendantSign], locale)}. Положения доступны в таблице.` : `${varga} ${southern ? "South" : "North"} Indian chart, ascendant ${SIGNS[ascendantSign]}. Full positions are in the table.`}>
    <title>{varga} — {southern ? "fixed signs" : "fixed houses"}</title>
    <desc>{locale === "ru" ? "Стрелка вверх — экзальтация, вниз — падение, подчёркивание — свой знак. Звёздочка — сожжение по D1. В тесных ячейках отметки доступны в подсказках и таблице." : "Up arrow: exaltation; down arrow: debilitation; underline: own sign; asterisk: D1 combustion. In dense cells, indicators remain in tooltips and the table."}</desc>
    {overlay && <desc>{overlay.mode === "transits" ? (locale === "ru" ? "Зелёные — транзитные планеты." : "Green: transit planets.") : (locale === "ru" ? "Серые — аспекты планет." : "Grey: planetary aspects.")} {overlay.markers.map(p => `${astrologyName(p.name, locale)}: ${astrologyName(SIGNS[p.sign], locale)}`).join("; ")}</desc>}
    {southern ? <>
      {SOUTH_CELLS.map(([column, row], sign) => <g key={sign}>
        <rect className={styles.chartLine} x={column * 100} y={row * 100} width="100" height="100" />
        <text className={styles.chartSign} x={column * 100 + 50} y={row * 100 + 21} textAnchor="middle">{astrologyName(SIGNS[sign], locale).slice(0, 3)}</text>
        {bodyLines(sign, `${column * 100},${row * 100 + 26} ${(column + 1) * 100},${row * 100 + 26} ${(column + 1) * 100},${(row + 1) * 100} ${column * 100},${(row + 1) * 100}`)}
      </g>)}
      <text className={styles.chartCenter} x="200" y="193" textAnchor="middle">{varga}</text>
      <text className={styles.chartSign} x="200" y="217" textAnchor="middle">{locale === "ru" ? "Лахири · сидерический" : "Lahiri · sidereal"}</text>
    </> : NORTH_CELLS.map((cell, house) => {
      const sign = ((referenceSign ?? ascendantSign) + house) % 12;
      return <g key={house}>
        <polygon className={styles.chartLine} points={cell.points} />
        <text className={styles.chartSign} x={NORTH_SIGN_LABELS[house][0]} y={NORTH_SIGN_LABELS[house][1]} textAnchor="middle">{sign + 1}</text>
        {bodyLines(sign, cell.points, NORTH_SIGN_LABELS[house])}
      </g>;
    })}
  </svg>;
}
export const AstrologyChart = memo(AstrologyChartView);
