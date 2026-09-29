"use client";
import { SIGNS, VARGAS, type AstrologyCalculation, type Varga, type VargaChart } from "../../../lib/astrology/contracts";
import { ashtakavarga, AV_PLANETS, AV_STAGES, emptyAvSelection, type AvSelection } from "../../../lib/astrology/ashtakavarga";
import { reducedAshtakavarga } from "../../../lib/astrology/ashtakavarga-reductions";
import { astrologyName, type AstrologyLocale } from "../../../lib/astrology/workspace-copy";
import type { WorkspaceAction } from "../../../lib/local-workspace/controller";
import { NORTH_CELLS, NORTH_SIGN_LABELS, SOUTH_CELLS } from "./AstrologyChart";
import styles from "./workspace.module.css";

function PointChart({ points, lagna, southern, locale, label }: { points: number[]; lagna: number; southern: boolean; locale: AstrologyLocale; label: string }) {
  const name = (sign: number) => astrologyName(SIGNS[sign], locale);
  return <svg viewBox="-1 -1 402 402" className={styles.chart} role="img" aria-label={`${label}: ${points.map((point, sign) => `${name(sign)} ${point}`).join(", ")}`}>
    <title>{label}</title>
    {southern ? SOUTH_CELLS.map(([col, row], sign) => <g key={sign}>
      <rect className={styles.chartLine} x={col * 100} y={row * 100} width="100" height="100" />
      <text className={styles.chartSign} x={col * 100 + 50} y={row * 100 + 21} textAnchor="middle">{name(sign).slice(0, 3)}</text>
      <text className={styles.chartBody} x={col * 100 + 50} y={row * 100 + 55} textAnchor="middle">{points[sign]}</text>
    </g>) : NORTH_CELLS.map((cell, house) => {
      const sign = (lagna + house) % 12;
      return <g key={sign}><polygon className={styles.chartLine} points={cell.points} />
        <text className={styles.chartSign} x={NORTH_SIGN_LABELS[house][0]} y={NORTH_SIGN_LABELS[house][1]} textAnchor="middle">{sign + 1}</text>
        <text className={styles.chartBody} x={cell.x} y={cell.y + 17} textAnchor="middle">{points[sign]}</text></g>;
    })}
  </svg>;
}

export function AshtakavargaView({ result, selection = emptyAvSelection(), southern, locale, act }: { result: AstrologyCalculation | null; selection?: AvSelection; southern: boolean; locale: AstrologyLocale; act: (action: WorkspaceAction) => void }) {
  const t = (en: string, ru: string) => locale === "ru" ? ru : en, n = (value: string) => astrologyName(value, locale);
  const available = result ? VARGAS.flatMap(varga => { const chart = result.charts[varga]; return chart ? [{ varga, chart, facts: ashtakavarga(chart, varga) }] : []; }) : [];
  const active = available.find(row => row.varga === selection.varga), facts = active?.facts;
  const stage = selection.stage ?? "original";
  const stageName = (value: AvSelection["stage"]) => value === "original" ? t("Original points", "Исходные баллы") : value === "trikona" ? t("After Trikona", "После триконы") : t("After Ekadhipatya", "После экадхипатьи");
  const targetName = (target: AvSelection["target"]) => target === "SAV" ? t("Sarvashtakavarga", "Сарваштакаварга") : n(target);
  const selectedBav = facts?.bav.find(row => row.planet === selection.target);
  const rows = selectedBav ? selectedBav.prastara : facts?.bav.map(row => ({ name: row.planet, points: row.points })) ?? [];
  const total = selectedBav ?? facts?.sav;
  const select = (target: AvSelection["target"], varga: Varga = selection.varga) => act({ type: "select-ashtakavarga", selection: { ...selection, stage, target, varga } });
  return <section aria-label={t("Calculated ashtakavarga", "Расчёт Аштакаварги")}><h2>{t("Ashtakavarga", "Аштакаварга")}</h2>
    <div className={styles.monthForm}>
      <label className={styles.field}><span>{t("Ashtakavarga chart", "Карта Аштакаварги")}</span><select value={selection.varga} disabled={!result} onChange={e => select(selection.target, e.target.value as Varga)}>{VARGAS.map(varga => <option key={varga} value={varga} disabled={!result?.charts[varga]}>{varga}</option>)}</select></label>
      <label className={styles.field}><span>{t("Point table", "Таблица баллов")}</span><select value={selection.target} disabled={!result} onChange={e => select(e.target.value as AvSelection["target"])}>{(["SAV", ...AV_PLANETS] as const).map(target => <option key={target} value={target}>{target === "SAV" && stage !== "original" ? t("All seven planets", "Все семь планет") : targetName(target)}</option>)}</select></label>
      <label className={styles.field}><span>{t("Reduction stage", "Этап сокращения")}</span><select value={stage} disabled={!result} onChange={e => act({ type: "select-ashtakavarga", selection: { ...selection, stage: e.target.value as AvSelection["stage"] } })}>{AV_STAGES.map(value => <option key={value} value={value}>{stageName(value)}</option>)}</select></label>
    </div>
    {!facts || !total ? <p>{result ? t("Choose a chart available in this saved result.", "Выбери карту, которая есть в сохранённом результате.") : t("Open or calculate a chart first.", "Сначала открой или рассчитай карту.")}</p> : stage !== "original" ? <AvReductionView chart={active!.chart} selection={{ ...selection, stage }} southern={southern} locale={locale} select={select} /> : <>
      <p className={styles.hint}>{t("Original points before reductions. Seven planets plus Lagna contribute; Rahu and Ketu do not participate. SAV sums the seven planetary BAVs.", "Исходные баллы до сокращений. Вклад дают семь планет и Лагна; Раху и Кету не участвуют. SAV складывается из семи планетных BAV.")}</p>
      <div className={styles.aspectScroll} tabIndex={0} role="region" aria-label={t("Ashtakavarga point table", "Баллы Аштакаварги")}><table className={`${styles.aspectTable} ${styles.avTable}`}>
        <caption>{selection.varga} · {targetName(selection.target)} · {selectedBav ? t("Contributions", "Вклады") : "SAV"}</caption>
        <thead><tr><th scope="col">{selectedBav ? t("Reference", "Источник") : t("Planet", "Планета")}</th>{SIGNS.map(sign => <th key={sign} scope="col"><abbr title={n(sign)}>{n(sign).slice(0, 3)}</abbr></th>)}<th scope="col">Σ</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.name} data-av-row={row.name}><th scope="row">{n(row.name)}</th>{row.points.map((point, sign) => <td key={sign}>{point}</td>)}<td>{row.points.reduce((a, b) => a + b, 0)}</td></tr>)}</tbody>
        <tfoot><tr data-av-total={selection.target}><th scope="row">{t("Total", "Сумма")}</th>{total.points.map((point, sign) => <td key={sign}>{point}</td>)}<td>{total.total}</td></tr></tfoot>
      </table></div>
      <div className={styles.chartGallery}>{[{ target: "SAV" as const, points: facts.sav.points }, ...facts.bav.map(row => ({ target: row.planet, points: row.points }))].map(row => <section key={row.target} className={styles.chartTile}>
        <h3><button type="button" aria-pressed={selection.target === row.target} onClick={() => select(row.target)}>{targetName(row.target)} · {selection.varga}</button></h3>
        <PointChart points={row.points} lagna={Math.floor(active!.chart.ascendant / 30)} southern={southern} locale={locale} label={`${selection.varga} ${targetName(row.target)}`} />
      </section>)}</div>
      <h3>{t("Sarvashtakavarga in other saved charts", "Сарваштакаварга в других сохранённых картах")}</h3>
      <div className={styles.chartGallery}>{available.filter(row => row.varga !== selection.varga).map(row => <section key={row.varga} className={styles.chartTile}><h3><button type="button" onClick={() => select("SAV", row.varga)}>SAV · {row.varga}</button></h3>
        <PointChart points={row.facts.sav.points} lagna={Math.floor(row.chart.ascendant / 30)} southern={southern} locale={locale} label={`SAV ${row.varga}`} />
      </section>)}</div>
      <p className={styles.hint}>{t("Divisional AV uses symbolic positions by the named Rao method. Choose a reduction stage to inspect the separate reduced BAVs and pindas. These original totals stay unchanged.", "Аштакаварга варг использует символические положения по выбранному методу Рао. Выбери этап сокращения для просмотра сокращённых BAV и пинд. Исходные суммы остаются неизменными.")}</p>
    </>}
  </section>;
}

function AvReductionView({ chart, selection, southern, locale, select }: { chart: VargaChart; selection: AvSelection; southern: boolean; locale: AstrologyLocale; select: (target: AvSelection["target"]) => void }) {
  const t = (en: string, ru: string) => locale === "ru" ? ru : en, n = (value: string) => astrologyName(value, locale);
  const facts = reducedAshtakavarga(chart, selection.varga), stage = selection.stage === "trikona" ? "trikona" : "ekadhipatya";
  const stageName = (value: AvSelection["stage"]) => value === "original" ? t("Original points", "Исходные баллы") : value === "trikona" ? t("After Trikona", "После триконы") : t("After Ekadhipatya", "После экадхипатьи");
  const selected = facts.bav.find(row => row.planet === selection.target);
  const rows = selected ? AV_STAGES.map(value => ({ key: value, label: stageName(value), ...selected[value] })) : facts.bav.map(row => ({ key: row.planet, label: n(row.planet), ...row[stage] }));
  const pindas = selected ? [selected] : facts.bav;
  return <>
    <p className={styles.hint}>{t("Rao Trikona, then seven-planet Ekadhipatya. Rahu, Ketu and Lagna do not count as occupants. Reduced BAVs are shown individually; they do not replace the original SAV.", "Трикона по Рао, затем экадхипатья по семи планетам. Раху, Кету и Лагна не учитываются при проверке занятости знаков. Сокращённые BAV показаны отдельно и не заменяют исходную SAV.")}</p>
    <div className={styles.aspectScroll} tabIndex={0} role="region" aria-label={t("Reduced ashtakavarga points", "Сокращённые баллы Аштакаварги")}><table className={`${styles.aspectTable} ${styles.avTable}`}>
      <caption>{selection.varga} · {selected ? n(selected.planet) : stageName(stage)}</caption>
      <thead><tr><th scope="col">{selected ? t("Stage", "Этап") : t("Planet", "Планета")}</th>{SIGNS.map(sign => <th key={sign} scope="col"><abbr title={n(sign)}>{n(sign).slice(0, 3)}</abbr></th>)}<th scope="col">Σ</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.key} data-av-reduction={row.key}><th scope="row">{row.label}</th>{row.points.map((points, sign) => <td key={sign}>{points}</td>)}<td>{row.total}</td></tr>)}</tbody>
    </table></div>
    <div className={styles.aspectScroll} tabIndex={0} role="region" aria-label={t("Shodhya pindas", "Шодхья-пинды")}><table className={styles.aspectTable}>
      <caption>{t("Pindas after both reductions", "Пинды после обоих сокращений")}</caption>
      <thead><tr><th scope="col">{t("Planet", "Планета")}</th><th scope="col">{t("Rashi pinda", "Раши-пинда")}</th><th scope="col">{t("Graha pinda", "Граха-пинда")}</th><th scope="col">{t("Shodhya pinda", "Шодхья-пинда")}</th></tr></thead>
      <tbody>{pindas.map(row => <tr key={row.planet} data-av-pinda={row.planet}><th scope="row">{n(row.planet)}</th><td>{row.pinda.rashi}</td><td>{row.pinda.graha}</td><td>{row.pinda.shodhya}</td></tr>)}</tbody>
    </table></div>
    <div className={styles.chartGallery}>{facts.bav.map(row => <section key={row.planet} className={styles.chartTile}><h3><button type="button" aria-pressed={selection.target === row.planet} onClick={() => select(row.planet)}>{n(row.planet)} · {selection.varga}</button></h3>
      <PointChart points={row[stage].points} lagna={Math.floor(chart.ascendant / 30)} southern={southern} locale={locale} label={`${selection.varga} ${n(row.planet)} · ${stageName(stage)}`} />
    </section>)}</div>
    <p className={styles.hint}>{t("The selected convention retains the third value when two trinal signs have zero. An occupied/empty pair with equal points clears the empty sign. Pindas are weighted counts, not predictions or an accuracy score.", "В выбранном варианте два нуля в триконе не обнуляют третий знак. При равных баллах занятого и пустого знаков обнуляется пустой. Пинды — взвешенные суммы, без прогнозов и оценки точности.")}</p>
  </>;
}
