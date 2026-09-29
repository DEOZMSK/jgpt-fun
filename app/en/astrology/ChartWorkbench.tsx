"use client";
import { useState } from "react";
import { SIGNS, type DashaPeriod, type Varga, type VargaChart } from "../../../lib/astrology/contracts";
import { calculationPeriods, dashaChildren, DASHA_LEVELS, findCalculationPeriod } from "../../../lib/astrology/dasha";
import { dashaOffsetLabel, formatDashaInstant } from "../../../lib/astrology/dasha-display";
import { astrologyName, type AstrologyLocale } from "../../../lib/astrology/workspace-copy";
import { isOutdated, periodKey, type LocalCalculation, type WorkspaceData } from "../../../lib/local-workspace/model";
import type { WorkspaceAction } from "../../../lib/local-workspace/controller";
import { ANALYSIS_TOOLS, FORECAST_TOOLS, VARGA_CATALOG, type ChartPanel } from "../../../lib/local-workspace/tool-catalog";
import { AstrologyChart, PLANET_SHORT, degreeLabel } from "./AstrologyChart";
import { ChartFactsTable } from "./ChartFactsTable";
import { DashaBasisDetails } from "./CalculationProfiles";
import { ToolMenu } from "./ToolMenu";
import { BirthPanchangaView } from "./BirthPanchangaView";
import { RashiOverlays } from "./RashiOverlays";
import { ArudhaView, KarakaView } from "./KarakaArudhaView";
import { AshtakavargaView } from "./AshtakavargaView";
import { MonthPanchangaView } from "./MonthPanchangaView";
import { YearTransitView } from "./YearTransitView";
import { SadeSatiView } from "./SadeSatiView";
import { ConditionLegend, PlanetConditions } from "./PlanetConditions";
import { PlanetChakras } from "./PlanetChakras";
import { SnapshotHistory } from "./SnapshotHistory";
import styles from "./workspace.module.css";
import { TermHint } from "./TermHint";

type Props = { busy: boolean; calculation: LocalCalculation | null; data: WorkspaceData; locale: AstrologyLocale; act: (action: WorkspaceAction) => void; onPrepareChart?: () => void };
function PeriodRow({ period, locale, expanded, act, offsetMinutes }: { period: DashaPeriod; locale: AstrologyLocale; expanded: string[]; act: Props["act"]; offsetMinutes: number }) {
  const key = periodKey(period), open = expanded.includes(key);
  const start = formatDashaInstant(period.start, offsetMinutes), end = formatDashaInstant(period.end, offsetMinutes);
  const label = `${astrologyName(DASHA_LEVELS[period.level], locale)}: ${astrologyName(period.lord, locale)}, ${start} — ${end} ${dashaOffsetLabel(offsetMinutes)}`;
  return <li className={styles.period}><button type="button" title={label} aria-label={label} {...(period.level < 3 ? { "aria-expanded": open } : { "aria-pressed": open })} onClick={() => act({ type: "toggle-period", key })}>
    <span>{period.level < 3 ? open ? "▾ " : "▸ " : "· "}{astrologyName(period.lord, locale)}</span><span className={styles.periodDates}><time dateTime={period.start}>{start}</time><br />— <time dateTime={period.end}>{end}</time></span>
  </button>{open && period.level < 3 && <ul>{dashaChildren(period).map(child => <PeriodRow key={periodKey(child)} period={child} locale={locale} expanded={expanded} act={act} offsetMinutes={offsetMinutes} />)}</ul>}</li>;
}

export function ChartWorkbench({ busy, calculation, data, locale, act, onPrepareChart }: Props) {
  const [dashaTimeMode, setDashaTimeMode] = useState<"birth" | "utc">("birth");
  const t = (en: string, ru: string) => locale === "ru" ? ru : en;
  const n = (name: string) => astrologyName(name, locale);
  const result = calculation?.kind === "astrology" ? calculation.result : null;
  const current = result && "dashas" in result ? result : null;
  const panel = ["aspects", "transits"].includes(data.ui.workbench.panel) ? "panchanga" : data.ui.workbench.panel;
  const system = current ? data.ui.dashaSystem : "vimshottari";
  const select = (value: ChartPanel) => act({ type: "select-panel", panel: value });
  const pending = (title: string) => <section className={styles.pendingTool}><h3>{title}</h3><p>{t("Calculation not connected yet.", "Расчёт пока не подключён.")}</p></section>;
  const empty = <div className={styles.emptyChart}>{t("Select or calculate a chart", "Выбери или рассчитай карту")}</div>;
  const draw = (chart: VargaChart | undefined, varga: Varga, referenceSign?: number) => chart ? <AstrologyChart chart={chart} varga={varga} southern={data.ui.southern} locale={locale} referenceSign={referenceSign} physical={result?.planets} /> : empty;
  const chartTile = (title: string, chart: VargaChart | undefined, varga: Varga = "D1", referenceSign?: number) => <section key={title} className={styles.chartTile}><h3>{title}</h3>{draw(chart, varga, referenceSign)}</section>;
  const chooseSystem = (value: "vimshottari" | "yogini") => {
    if (!result) { if (onPrepareChart) onPrepareChart(); else select("periods"); return; }
    act({ type: "select-dasha-system", system: value });
  };
  const needsNatal = !["month-panchanga", "year-transits", "navamsha-dasha", "chara-dasha", "lunar-forecast"].includes(panel);
  const known = ["vargas", "panchanga", "periods", "ashtakavarga", "month-panchanga", "transits", "year-transits", "sade-sati", "karakas", "arudhas", "readings"];
  const names: Partial<Record<ChartPanel, string>> = Object.fromEntries([...ANALYSIS_TOOLS, ...FORECAST_TOOLS].map(item => [item.panel, item[locale]]));
  Object.assign(names, { transits: t("Transits", "Транзиты"), aspects: t("Planetary aspects", "Аспекты планет"), "navamsha-dasha": t("Navamsha Dasha", "Навамша Даша"), "chara-dasha": t("Chara Dasha", "Чара Даша") });
  return <section className={styles.chartDesk} aria-label={t("Chart workbench", "Рабочая область карты")}>
    {calculation && isOutdated(calculation, data) && <p role="status" className={styles.stale}>{t("Outdated result: calculate again after changing birth details or settings.", "Устаревший результат: после изменения данных или настроек выполни новый расчёт.")}</p>}
    {result && !current && <p className={styles.hint}>{t("Version 1 snapshot. Yogini requires a new calculation.", "Снимок версии 1. Для Йогини нужен новый расчёт.")}</p>}
    {result && <div className={styles.referenceCharts} data-workspace-target="rashi" tabIndex={-1}>
      <RashiOverlays natal={result} mode={data.ui.chartOverlay} transit={data.ui.transit} locale={locale} southern={data.ui.southern} act={act} />
      <section aria-label={t("Natal positions", "Натальные положения")}>
        {current ? <ChartFactsTable facts={current.facts.natal} locale={locale} natal compact natalChart={result?.charts.D1} /> : result ? <div className={styles.compactTable}><table><caption className={styles.srOnly}>{t("Natal positions", "Натальные положения")}</caption><tbody>
          <tr><th>Asc</th><td>{n(SIGNS[Math.floor(result.ascendant / 30)])}</td><td>{degreeLabel(result.ascendant)}</td><td>—</td></tr>
          {result.planets.map(p => <tr key={p.name}><th><abbr title={n(p.name)}>{PLANET_SHORT[p.name]}</abbr></th><td>{n(SIGNS[p.sign])}</td><td>{degreeLabel(p.longitude).replaceAll(" ", "")}</td><td>{n(p.nakshatra)} {p.pada}</td></tr>)}
        </tbody></table></div> : <div className={styles.emptyPositions}><h3>{t("Natal positions", "Положения планет")}</h3><p>{t("Positions appear after opening a chart.", "Положения появятся после открытия карты.")}</p></div>}
      </section>
      <section aria-label="D9"><h3><TermHint text={t("D9 (Navamsha) is a divisional chart calculated from nine parts of each zodiac sign.", "D9 (Навамша) — дробная карта, рассчитанная по девяти частям каждого знака зодиака.")}>{t("Navamsha", "Навамша")} · D9</TermHint></h3>{draw(result?.charts.D9, "D9")}</section>
    </div>}
    {result && <ConditionLegend locale={locale} />}
    <SnapshotHistory data={data} calculation={calculation} locale={locale} busy={busy} act={act} />
    <nav className={styles.referenceTools} aria-label={t("Chart tools", "Инструменты карты")}>
      <ToolMenu label={t("Analysis", "Анализ")} active={ANALYSIS_TOOLS.some(x => x.panel === panel)}>{ANALYSIS_TOOLS.map(x => <button type="button" key={x.panel} onClick={() => select(x.panel)}>{x[locale]}</button>)}</ToolMenu>
      <button type="button" aria-pressed={panel === "vargas"} onClick={() => select("vargas")}>{t("Divisional charts", "Дробные карты")}</button>
      <button type="button" aria-pressed={panel === "ashtakavarga"} onClick={() => select("ashtakavarga")}>{t("Ashtakavarga", "Аштакаварга")}</button>
      <button type="button" aria-pressed={panel === "periods" && system === "vimshottari"} onClick={() => chooseSystem("vimshottari")}>{t("Vimshottari Dasha", "Вимшоттари Даша")}</button>
      <button type="button" aria-pressed={panel === "periods" && system === "yogini"} onClick={() => chooseSystem("yogini")}>{t("Yogini Dasha", "Йогини Даша")}</button>
      <button type="button" aria-pressed={panel === "navamsha-dasha"} onClick={() => select("navamsha-dasha")}>{t("Navamsha Dasha · later", "Навамша Даша · позже")}</button>
      <button type="button" aria-pressed={panel === "chara-dasha"} onClick={() => select("chara-dasha")}>{t("Chara Dasha · later", "Чара Даша · позже")}</button>
    </nav>
    <div className={styles.referenceContent} data-workspace-target={panel === "periods" ? "periods" : panel === "vargas" ? "varga" : undefined} tabIndex={-1}>
      {!result && needsNatal ? <section className={styles.pendingTool} role="status">
        <h2>{t("Calculate a birth chart to open the tools", "Рассчитай карту рождения, чтобы открыть инструменты")}</h2>
        <p>{data.ui.selectedProfileId ? t("This record contains birth details only. One calculation fills Rashi, all 20 charts, planetary positions and the available periods.", "В этой записи пока только данные рождения. Один расчёт заполнит Раши, все 20 карт, положения планет и доступные периоды.") : t("Choose a saved person in My charts or enter birth details. The tools will use that person's calculation.", "Выбери сохранённого человека в «Моих картах» или введи данные рождения. Инструменты используют расчёт выбранного человека.")}</p>
        {onPrepareChart ? <button type="button" className={styles.primary} disabled={busy} onClick={onPrepareChart}>{data.ui.selectedProfileId ? t("Calculate chart", "Рассчитать карту") : t("Enter birth details", "Ввести данные рождения")}</button> : <p>{t("Use the calculation button above, or open Edit to complete the birth details.", "Нажми кнопку расчёта выше или открой «Изменить», чтобы заполнить данные рождения.")}</p>}
      </section> : <>
      {panel === "readings" && <PlanetConditions result={result} varga={data.ui.varga} locale={locale} onSelect={varga => act({ type: "select-varga", varga })} />}
      {panel === "karakas" && <KarakaView result={result} locale={locale} />}
      {panel === "arudhas" && <ArudhaView result={result} selection={data.ui.arudhas} locale={locale} act={act} />}
      {panel === "year-transits" && <YearTransitView state={data.ui.yearTransits} moment={data.ui.yearTransitMoment} southern={data.ui.southern} busy={busy} locale={locale} hasProfile={!!data.ui.selectedProfileId} act={act} />}
      {panel === "month-panchanga" && <MonthPanchangaView state={data.ui.monthPanchanga} locale={locale} hasProfile={!!data.ui.selectedProfileId} act={act} busy={busy} />}
      {panel === "vargas" && <><h2>{t("Divisional charts", "Дробные карты")}</h2>
        {result?.charts[data.ui.varga] && <section className={styles.selectedVarga} aria-label={t("Selected varga", "Выбранная варга")}><h3><TermHint text={t("A varga is a chart derived from divisions of the signs; the method belongs to the selected saved calculation.", "Варга — карта, построенная из делений знаков; метод берётся из выбранного сохранённого расчёта.")}>{data.ui.varga}</TermHint></h3>{draw(result.charts[data.ui.varga], data.ui.varga)}</section>}
        {result && <p className={styles.hint}>{t("Named research methods; matching your reference settings is pending. Older snapshots keep their original charts.", "Явно выбранные исследовательские методы; совпадение с твоими эталонными настройками ещё проверяется. Старые снимки сохраняют свой набор карт.")}</p>}
        {current?.facts.vargas[data.ui.varga] && <details><summary>{data.ui.varga} · {t("Positions and method", "Положения и метод")}</summary><p><code>{result?.charts[data.ui.varga]?.method}</code></p><ChartFactsTable facts={current.facts.vargas[data.ui.varga]!} locale={locale} natal={false} /></details>}
        <div className={styles.chartGallery}>{VARGA_CATALOG.map(([num, en, ru]) => {
          const varga = `D${num}` as Varga, chart = result?.charts[varga];
          return <section key={num} className={styles.chartTile}><h3><button type="button" disabled={!chart} aria-pressed={data.ui.varga === varga} onClick={() => act({ type: "select-varga", varga })}>{t(en, ru)} (D{num})</button></h3>
            {chart ? draw(chart, varga) : <div className={styles.pendingChart}>{result ? t("New calculation required", "Нужен новый расчёт") : t("Calculate a chart first", "Сначала рассчитай карту")}</div>}
          </section>;
        })}</div>
      </>}
      {panel === "ashtakavarga" && <AshtakavargaView result={result} selection={data.ui.ashtakavarga} southern={data.ui.southern} locale={locale} act={act} />}
      {panel === "panchanga" && <><div className={styles.overviewCharts}>
        {chartTile(t("Moon chart (Mo)", "Лунная (Mo)"), result?.charts.D1, "D1", result?.planets.find(p => p.name === "Moon")?.sign)}
        {chartTile(t("Navamsha (D9)", "Навамша (D9)"), result?.charts.D9, "D9")}
        {chartTile(t("Dashamsha (D10)", "Дашамша (D10)"), result?.charts.D10, "D10")}
        <PlanetChakras result={result} locale={locale} />
      </div><details className={styles.details}><summary>{t("Birth panchanga", "Панчанга рождения")}</summary>{result ? <BirthPanchangaView result={result} locale={locale} /> : empty}</details></>}
      {panel === "periods" && (() => {
        const periods = result ? calculationPeriods(result, system) : [];
        const maha = periods.find(p => periodKey(p) === data.ui.workbench.maha[system]) ?? periods[0];
        const selected = result ? findCalculationPeriod(result, data.ui.expandedPeriods.filter(k => k.startsWith(`${system}:`)).at(-1) ?? "") : null;
        const focus = selected && maha && selected.start >= maha.start && selected.end <= maha.end ? selected : maha;
        const balance = current?.dashas[system].birthBalance;
        const anchor = result?.planets.find(p => p.name === maha?.lord);
        const birthOffset = result?.birth.utcOffsetMinutes ?? 0;
        const displayOffset = dashaTimeMode === "birth" ? birthOffset : 0;
        const displayZone = dashaOffsetLabel(displayOffset);
        const displayTime = (utc: string) => formatDashaInstant(utc, displayOffset);
        return <><h2><TermHint text={t("Dasha is a sequence of periods calculated using the selected system; expanding a period shows its subdivisions.", "Даша — последовательность периодов по выбранной системе; раскрытие периода показывает его подпериоды.")}>{system === "yogini" ? t("Yogini Dasha", "Йогини Даша") : t("Vimshottari Dasha", "Вимшоттари Даша")}</TermHint></h2>
          {result && <><div role="group" aria-label={t("Dasha date display", "Отображение дат даш")} className={styles.referenceTools}>
            <button type="button" aria-pressed={dashaTimeMode === "birth"} onClick={() => setDashaTimeMode("birth")}>{t("Birth offset", "Смещение при рождении")} · {dashaOffsetLabel(birthOffset)}</button>
            <button type="button" aria-pressed={dashaTimeMode === "utc"} onClick={() => setDashaTimeMode("utc")}>UTC</button>
          </div><p className={styles.hint}>{dashaTimeMode === "birth" ? t("All dates use the fixed offset saved at birth, without seasonal clock changes.", "Все даты показаны со смещением, записанным при рождении, без сезонного перевода часов.") : t("All dates are shown in UTC.", "Все даты показаны в UTC.")}</p></>}
          {!result ? empty : <div className={styles.referencePeriods}>
            <ul className={styles.mahaList} aria-label={t("Mahadashas", "Махадаши")}>{periods.map(p => <li key={periodKey(p)}><button type="button" aria-pressed={p === maha} title={`${displayTime(p.start)} — ${displayTime(p.end)} ${displayZone}`} onClick={() => act({ type: "select-maha", key: periodKey(p) })}>{n(p.lord)} <span>{t("from", "с")} <time dateTime={p.start}>{displayTime(p.start)}</time></span></button></li>)}</ul>
            <div>{focus && <div className={styles.periodFocus}><strong>{n(DASHA_LEVELS[focus.level])} · {n(focus.lord)}</strong><small><time dateTime={focus.start}>{displayTime(focus.start)}</time> — <time dateTime={focus.end}>{displayTime(focus.end)}</time> {displayZone}</small></div>}{maha && <ul className={styles.periods}>{dashaChildren(maha).map(p => <PeriodRow key={periodKey(p)} period={p} locale={locale} expanded={data.ui.expandedPeriods} act={act} offsetMinutes={displayOffset} />)}</ul>}</div>
            {chartTile(`${t("Rashi", "Раши")} · ${maha ? n(maha.lord) : ""}`, result.charts.D1, "D1", anchor?.sign)}
          </div>}
          <p className={styles.hint}>{t("Four levels", "Четыре уровня")} · {displayZone} · {t("year length", "год")}: {current?.dashas[system].yearDays ?? result?.settings.yearDays} {t("days", "суток")}{balance && ` · ${t("Balance at birth", "Остаток при рождении")}: ${n(balance.lord)} ${balance.remainingYears.toFixed(6)} ${t("years", "лет")}`}</p>
          {result && <DashaBasisDetails result={result} system={system} locale={locale} />}
        </>;
      })()}
      {panel === "sade-sati" && <SadeSatiView state={data.ui.sadeSati} natal={result} locale={locale} act={act} />}
      {!known.includes(panel) && pending(names[panel] ?? panel)}
      </>}
    </div>
  </section>;
}
