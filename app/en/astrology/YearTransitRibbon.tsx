"use client";
import { DateTime } from "luxon";
import { SIGNS } from "../../../lib/astrology/contracts";
import { EVENT_PLANETS, type YearTransitResult } from "../../../lib/astrology/year-transit-contract";
import { intervalGeometry, yearSignIntervals, yearDirectionIntervals, yearMonthGeometry, yearDateAtFraction } from "../../../lib/astrology/timeline-layout";
import { astrologyName, type AstrologyLocale } from "../../../lib/astrology/workspace-copy";
import { PLANET_SHORT } from "./AstrologyChart";
import styles from "./workspace.module.css";

export const YEAR_PLANET_COLORS = ["#ffe08a", "#d6e5f0", "#f6aaaa", "#a9dca8", "#cab5e4", "#f4b0d5", "#a4c8e0", "#c0bbb7", "#d3d3d3"];
export function YearTransitRibbon({ result, locale, selectedDate, selectedUtc, onDate }: { result: YearTransitResult | null; locale: AstrologyLocale; selectedDate: string; selectedUtc: string | null; onDate: (date: string) => void }) {
  const t = (en: string, ru: string) => locale === "ru" ? ru : en;
  const start = result ? Date.parse(result.start.utc) : 0, end = result ? Date.parse(result.end.utc) : 1;
  const months = result ? yearMonthGeometry(result) : Array.from({length:12},(_,i)=>({month:i+1,left:i*100/12,width:100/12}));
  const cursor = selectedUtc ? 100 * (Date.parse(selectedUtc) - start) / (end - start) : null;
  const first = DateTime.fromISO(`${result?.input.year ?? 2000}-01-01`, {zone:"UTC"});
  const date = DateTime.fromISO(selectedDate, {zone:"UTC"});
  const days = first.daysInYear!;
  return <>
    <div className={styles.timelineScroll} tabIndex={0} role="region" aria-label={t("Yearly planetary timeline", "Годовая лента планет")}><div className={styles.yearRibbon}>
      <div className={styles.monthLabels}>{months.map(m => <span key={m.month} style={{position:"absolute",left:`${m.left}%`,width:`${m.width}%`}}>{new Intl.DateTimeFormat(locale,{month:"short",timeZone:"UTC"}).format(new Date(Date.UTC(2000,m.month-1,1)))}</span>)}</div>
      <div className={styles.yearRibbonRows}>
        {EVENT_PLANETS.filter(planet => planet !== "Moon").map(planet => <div className={styles.timelineRow} key={planet}><strong style={{background:YEAR_PLANET_COLORS[EVENT_PLANETS.indexOf(planet)]}}><abbr title={astrologyName(planet,locale)}>{PLANET_SHORT[planet]}</abbr></strong>
          <button type="button" disabled={!result} className={`${styles.timelineTrack} ${styles.yearTrack}`} aria-label={`${astrologyName(planet,locale)} · ${t("Select a day on the timeline; arrow keys change the day", "Выбрать день на ленте; стрелки меняют день")}`} onKeyDown={e => {
            if (!result || !["ArrowLeft", "ArrowRight"].includes(e.key)) return;
            e.preventDefault(); const next=date.plus({days:e.key==="ArrowLeft"?-1:1}); if(next.year===result.input.year) onDate(next.toISODate()!);
          }} onClick={e => {
            if (!result || e.detail === 0) return;
            const box=e.currentTarget.getBoundingClientRect(), next=yearDateAtFraction(result,(e.clientX-box.left)/box.width);if(next) onDate(next);
          }}>
            {months.map(m=><span key={m.month} className={styles.yearMonthLine} style={{left:`${m.left}%`}} />)}
            {result ? yearSignIntervals(result,planet).map(i=>{const g=intervalGeometry(Date.parse(i.start.utc),Date.parse(i.end.utc),start,end);return g&&<span key={i.ref} className={styles.timelineSegment} style={{left:`${g.left}%`,width:`${g.width}%`,background:YEAR_PLANET_COLORS[EVENT_PLANETS.indexOf(planet)]}} title={`${astrologyName(SIGNS[i.sign],locale)} · ${i.start.local?.dateTime??i.start.utc} — ${i.end.local?.dateTime??i.end.utc}`}><span>{astrologyName(SIGNS[i.sign],locale)}</span><small>{(i.start.local?.dateTime??i.start.utc).slice(5,10)} — {(i.end.local?.dateTime??i.end.utc).slice(5,10)}</small></span>}) : <span className={styles.timelineMissing}>{t("Calculate the year to fill this row", "Рассчитай год для заполнения")}</span>}
            {result && yearDirectionIntervals(result,planet).filter(i=>i.direction==="retrograde").map(i=>{const g=intervalGeometry(Date.parse(i.start.utc),Date.parse(i.end.utc),start,end);return g&&<span className={styles.directionBand} data-motion="retrograde" data-planet={planet} key={i.ref} style={{left:`${g.left}%`,width:`${g.width}%`}} title={`${t("Retrograde", "Ретроградное движение")} · ${i.start.local?.dateTime??i.start.utc} — ${i.end.local?.dateTime??i.end.utc}`}>℞</span>})}
          </button>
        </div>)}
        {cursor!==null && cursor>=0 && cursor<100 && <div className={styles.yearCursor} data-selected-utc={selectedUtc} style={{left:`calc(${cursor}% + ${54*(1-cursor/100)}px)`}}><span>{selectedDate.slice(5)}</span></div>}
      </div>
    </div></div>
    {result && <label className={styles.yearDaySlider}><span>{t("Selected day", "Выбранный день")}: {selectedDate}</span><input type="range" aria-label={t("Day of the transit year", "День транзитного года")} min={1} max={days} value={date.year===result.input.year?date.ordinal:1} onChange={e=>onDate(first.plus({days:Number(e.target.value)-1}).toISODate()!)} /></label>}
    <p className={styles.hint}>{t("Gray bars mark retrograde motion. Select a date with the timeline, slider or calendar. Intervals are clipped to the displayed year.", "Серые полосы — ретроградное движение. Дату можно выбрать на ленте, ползунком или в календаре. Интервалы ограничены показанным годом.")}</p>
  </>;
}
