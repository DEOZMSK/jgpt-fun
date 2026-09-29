"use client";
import { SIGNS, type AstrologyCalculation } from "../../../lib/astrology/contracts";
import { sadeSatiIntervals } from "../../../lib/astrology/sade-sati";
import { sadeSatiOutdated, type SadeSatiWorkspace } from "../../../lib/astrology/saturn-transit-contract";
import { astrologyName, type AstrologyLocale } from "../../../lib/astrology/workspace-copy";
import type { WorkspaceAction } from "../../../lib/local-workspace/controller";
import { EventTime } from "./BirthPanchangaView";
import { degreeLabel } from "./AstrologyChart";
import styles from "./workspace.module.css";

export function SadeSatiView({ state, natal, locale, act }: { state: SadeSatiWorkspace; natal: AstrologyCalculation | null; locale: AstrologyLocale; act: (action: WorkspaceAction) => void }) {
  const t = (en: string, ru: string) => locale === "ru" ? ru : en;
  const moon = natal?.planets.find(p => p.name === "Moon");
  const r = state.result, intervals = r && moon ? sadeSatiIntervals(r, moon.longitude) : [];
  const phaseName = (phase: 12 | 1 | 2) => phase === 12 ? t("Before the Moon sign · 12th", "Перед знаком Луны · 12-й") : phase === 1 ? t("In the Moon sign · 1st", "В знаке Луны · 1-й") : t("After the Moon sign · 2nd", "После знака Луны · 2-й");
  return <section aria-label={t("Sade Sati calculation", "Расчёт Саде Сати")}>
    <h2>{t("Sade Sati", "Саде Сати")}</h2>
    <form onSubmit={event => { event.preventDefault(); act({ type: "sade-sati-calculate" }); }}>
      <div className={styles.monthForm}>
        <label className={styles.field}><span>{t("First year", "Первый год")}</span><input required inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={state.draft.fromYear} onChange={e => act({ type: "sade-sati-edit", patch: { fromYear: e.target.value } })} /></label>
        <label className={styles.field}><span>{t("Last year, inclusive", "Последний год включительно")}</span><input required inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={state.draft.toYear} onChange={e => act({ type: "sade-sati-edit", patch: { toYear: e.target.value } })} /></label>
        <label className={styles.field}><span>{t("Sade Sati IANA time zone", "Часовой пояс Саде Сати")}</span><input required maxLength={80} autoComplete="off" value={state.draft.timezone} onChange={e => act({ type: "sade-sati-edit", patch: { timezone: e.target.value } })} /></label>
      </div>
      <div className={styles.monthActions}><button type="submit" className={styles.primary}>{t("Calculate Saturn intervals", "Рассчитать интервалы Сатурна")}</button><button type="button" className={styles.secondary} disabled={!natal} onClick={() => act({ type: "sade-sati-use-chart" })}>{t("Range and zone from chart", "Диапазон и пояс из карты")}</button></div>
    </form>
    <p className={styles.hint}>{t("1900–2100. The chart shortcut starts with the birth year and ends 120 years later, capped at 2100; edit either year as needed. The calculation covers whole civil years in the chosen zone.", "1900–2100. Кнопка берёт год рождения и год через 120 лет, в пределах 2100; диапазон можно изменить. Рассчитываются полные календарные годы в выбранном поясе.")}</p>
    <p>{moon ? <>{t("Natal Moon", "Натальная Луна")}: {astrologyName(SIGNS[moon.sign], locale)} {degreeLabel(moon.longitude)} · {t("Lahiri, from the open chart", "Лахири, из открытой карты")}</> : t("Open a natal chart to identify its Sade Sati phases. Saturn's timeline can be calculated separately.", "Открой натальную карту, чтобы определить её фазы Саде Сати. Ленту Сатурна можно рассчитать отдельно.")}</p>
    {sadeSatiOutdated(state) && <p role="status" className={styles.stale}>{t("The form differs from the saved range. Calculate again to apply it.", "Форма отличается от сохранённого диапазона. Рассчитай заново, чтобы применить изменения.")}</p>}
    {r && <>
      <p>{t("Calculated range", "Рассчитанный диапазон")}: {r.input.fromYear}–{r.input.toYear} · {r.input.timezone}</p>
      {moon && <>
        <p role="status">{t("Phase intervals", "Интервалов фаз")}: {intervals.length}</p>
        {intervals.length ? <div className={styles.tableScroll} role="region" tabIndex={0} aria-label={t("Sade Sati intervals", "Интервалы Саде Сати")}><table className={styles.eventTable}>
          <caption className={styles.srOnly}>{t("Sade Sati intervals", "Интервалы Саде Сати")}</caption>
          <thead><tr>{[t("Phase", "Фаза"), t("Start", "Начало"), t("End, excluded", "Конец, не включён")].map(label => <th key={label}>{label}</th>)}</tr></thead>
          <tbody>{intervals.map((interval, index) => <tr key={interval.ref} data-sade-ref={interval.ref} data-episode={interval.episode}>
            <th scope="row">{(index === 0 || intervals[index - 1].episode !== interval.episode) && <><span className={styles.hint}>{t("Continuous stretch", "Непрерывный отрезок")} {interval.episode}</span><br /></>}{phaseName(interval.phase)}<br />{astrologyName(SIGNS[interval.saturnSign], locale)}
              {interval.entryDirection === "retrograde" && <><br /><span className={styles.hint}>{t("Retrograde return", "Ретроградный возврат")}</span></>}</th>
            <td><EventTime value={interval.start} />{interval.clippedStart && <p className={styles.hint}>{t("Already in this phase at the range start; its entry is outside the calculated range.", "Фаза уже идёт на границе диапазона; её начало здесь не определено.")}</p>}</td>
            <td><EventTime value={interval.end} />{interval.clippedEnd && <p className={styles.hint}>{t("Still in this phase at the range end; its exit is outside the calculated range.", "Фаза продолжается за границей диапазона; её конец здесь не определён.")}</p>}</td>
          </tr>)}</tbody>
        </table></div> : <p>{t("Saturn does not occupy the 12th, 1st or 2nd sign from this Moon within the calculated range.", "В рассчитанном диапазоне Сатурн не проходит по 12-му, 1-му или 2-му знаку от этой Луны.")}</p>}
      </>}
    </>}
    <p className={styles.hint}>{t("Sign-based Lahiri method: Saturn in the 12th, 1st and 2nd signs from the natal Moon. Retrograde exits create gaps; returns are shown separately. No fixed 7.5-year duration is imposed. These are calculated positions and intervals; interpretations and independent JHora acceptance are separate.", "Метод по знакам Лахири: Сатурн в 12-м, 1-м и 2-м знаках от натальной Луны. Ретроградные выходы создают перерывы, возвраты показаны отдельно. Фиксированная длительность 7,5 лет не подставляется. Здесь положения и интервалы; трактовки и независимая сверка с JHora — отдельно.")}</p>
  </section>;
}
