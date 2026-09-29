"use client";
import { useState } from "react";
import type { AstrologyCalculation } from "../../../lib/astrology/contracts";
import { chartOverlay, type ChartOverlayMode } from "../../../lib/astrology/chart-overlay";
import type { TransitWorkspace } from "../../../lib/astrology/transit-contract";
import type { AstrologyLocale } from "../../../lib/astrology/workspace-copy";
import type { WorkspaceAction } from "../../../lib/local-workspace/controller";
import { AstrologyChart } from "./AstrologyChart";
import styles from "./workspace.module.css";
import { TermHint } from "./TermHint";

function TransitMoment({ utc, locale, act }: { utc: string; locale: AstrologyLocale; act: (action: WorkspaceAction) => void }) {
  const [value, setValue] = useState(utc.slice(0, 19));
  const t = (en: string, ru: string) => locale === "ru" ? ru : en;
  return <form className={styles.transitMoment} onSubmit={e => {
    e.preventDefault();
    const entered = new FormData(e.currentTarget).get("transitMoment");
    if (typeof entered !== "string" || !entered) return;
    act({ type: "overlay-transit-at", utc: `${entered.length === 16 ? `${entered}:00` : entered}Z` });
  }}>
    <label><span>{t("Transit moment · UTC", "Момент транзита · UTC")}</span><input name="transitMoment" aria-label={t("Transit moment UTC", "Момент транзита UTC")} type="datetime-local" step="1" min="1900-01-01T00:00:00" max="2100-12-31T23:59:59" required value={value} onInput={e => setValue(e.currentTarget.value)} onChange={e => setValue(e.target.value)} /></label>
    <button type="submit">{t("Apply", "Применить")}</button>
    <button type="button" onClick={() => act({ type: "overlay-transit-at", utc: "now" })}>{t("Now", "Сейчас")}</button>
  </form>;
}

export function RashiOverlays({ natal, mode, transit, locale, southern, act }: { natal: AstrologyCalculation | null; mode: ChartOverlayMode; transit: TransitWorkspace; locale: AstrologyLocale; southern: boolean; act: (action: WorkspaceAction) => void }) {
  const t = (en: string, ru: string) => locale === "ru" ? ru : en;
  const overlay = natal ? chartOverlay(natal, mode, transit) : null;
  return <section aria-label="D1">
    <h3><TermHint text={t("Rashi (D1) shows natal sidereal positions; transit layers use the applied moment shown below.", "Раши (D1) показывает натальные сидерические положения; слой транзитов использует применённый момент, указанный ниже.")}>Rashi · D1</TermHint></h3>
    {natal ? <AstrologyChart chart={natal.charts.D1} varga="D1" southern={southern} locale={locale} overlay={overlay} physical={natal.planets} /> : <div className={styles.emptyChart}>{t("Select or calculate a chart", "Выбери или рассчитай карту")}</div>}
    <div className={styles.chartSwitches}>
      {(["aspects", "transits"] as const).map(layer => <button key={layer} type="button" role="switch" aria-checked={mode === layer} disabled={!natal} className={styles.chartSwitch} data-mode={layer}
        title={layer === "aspects" ? t("Full graha drishti of seven planets on D1", "Полные граха-дришти семи планет на D1") : t("Transit planets on the natal Rashi chart", "Транзитные планеты на натальной Раши")}
        onClick={() => act({ type: "set-chart-overlay", mode: mode === layer ? "none" : layer })}>
        <span className={styles.switchTrack} aria-hidden="true"><span /></span><span>{layer === "aspects" ? t("Planetary aspects", "Аспекты планет") : t("Transits", "Транзиты")}</span>
      </button>)}
    </div>
    {mode === "transits" && (overlay && transit.result ? <TransitMoment key={transit.result.instant.utc} utc={transit.result.instant.utc} locale={locale} act={act} />
      : <div className={styles.transitMoment}><span role="status">{t("Transit positions are not ready.", "Транзитные положения пока не готовы.")}</span><button type="button" onClick={() => act({ type: "overlay-transit-at", utc: "now" })}>{t("Calculate now", "Рассчитать сейчас")}</button></div>)}
  </section>;
}
