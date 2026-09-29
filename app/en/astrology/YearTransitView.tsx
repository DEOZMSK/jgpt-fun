"use client";
import { SIGNS } from "../../../lib/astrology/contracts";
import { EVENT_PLANETS, yearTransitOutdated, type YearTransitWorkspace } from "../../../lib/astrology/year-transit-contract";
import { astrologyName, type AstrologyLocale } from "../../../lib/astrology/workspace-copy";
import type { WorkspaceAction } from "../../../lib/local-workspace/controller";
import { degreeLabel } from "./AstrologyChart";
import type { TransitWorkspace } from "../../../lib/astrology/transit-contract";
import { yearMomentUtc } from "../../../lib/astrology/year-transit-moment";
import { YearTransitMomentView } from "./YearTransitMomentView";
import { EventTime } from "./BirthPanchangaView";
import { YearTransitRibbon } from "./YearTransitRibbon";
import styles from "./workspace.module.css";

export function YearTransitView({ state, moment, locale, southern, busy, hasProfile, act }: { state: YearTransitWorkspace; moment: TransitWorkspace; locale: AstrologyLocale; southern: boolean; busy: boolean; hasProfile: boolean; act: (action: WorkspaceAction) => void }) {
  const t = (en: string, ru: string) => locale === "ru" ? ru : en, n = (s: string) => astrologyName(s, locale);
  const r = yearTransitOutdated(state) ? null : state.result, events = r?.events.filter(e => (state.planet === "all" || e.planet === state.planet) && (state.kind === "all" || e.kind === state.kind)) ?? [];
  return <section aria-label={t("Yearly transit events", "События транзитов на год")}>
    <h2>{t("Yearly transits", "Транзиты на год")}</h2>
    <details id="year-transit-settings" className={styles.details} open={!r || undefined}><summary>{t("Year and settings", "Год и настройки")}</summary><form onSubmit={e => { e.preventDefault(); act({ type: "year-transits-calculate" }); }}>
      <div className={styles.monthForm}>
        <label className={styles.field}><span>{t("Transit year", "Год транзитов")}</span><input value={state.draft.year} inputMode="numeric" pattern="[0-9]{4}" maxLength={4} required onChange={e => act({ type: "year-transits-edit", patch: { year: e.target.value } })} /></label>
        <label className={styles.field}><span>{t("Event IANA time zone", "Часовой пояс событий")}</span><input value={state.draft.timezone} autoComplete="off" maxLength={80} required onChange={e => act({ type: "year-transits-edit", patch: { timezone: e.target.value } })} /></label>
        <label className={styles.field}><span>{t("Event nodes", "Узлы событий")}</span><select value={state.draft.nodes} onChange={e => act({ type: "year-transits-edit", patch: { nodes: e.target.value as "mean" | "true" } })}><option value="true">{t("True", "Истинные")}</option><option value="mean">{t("Mean", "Средние")}</option></select></label>
      </div>
      <div className={styles.monthActions}><button type="submit" className={styles.primary} disabled={busy}>{t("Calculate year", "Рассчитать год")}</button><button type="button" className={styles.secondary} disabled={!hasProfile} onClick={() => act({ type: "year-transits-use-profile" })}>{t("Use profile zone and nodes", "Пояс и узлы из профиля")}</button></div>
    </form></details>
    <YearTransitRibbon result={r} locale={locale} selectedDate={moment.draft.date} selectedUtc={yearMomentUtc(state, moment)} onDate={date => act({ type: "year-moment-select", date })} />
    {r && <YearTransitMomentView year={state} moment={moment} locale={locale} southern={southern} busy={busy} hasProfile={hasProfile} act={act} />}
    {yearTransitOutdated(state) && <p role="status" className={styles.stale}>{t("The form differs from the saved timeline. Calculate again to apply it.", "Форма отличается от сохранённой ленты. Рассчитай заново, чтобы применить изменения.")}</p>}
    {r ? <>
      <p>{r.input.year} · {r.input.timezone} · {r.input.nodes === "true" ? t("true nodes", "истинные узлы") : t("mean nodes", "средние узлы")}</p>
      <div className={styles.monthActions}>
        <label className={styles.field}><span>{t("Event planet", "Планета событий")}</span><select value={state.planet} onChange={e => act({ type: "year-transits-filter", planet: e.target.value as YearTransitWorkspace["planet"], kind: state.kind })}><option value="all">{t("All objects", "Все объекты")}</option>{EVENT_PLANETS.map(p => <option value={p} key={p}>{n(p)}</option>)}</select></label>
        <label className={styles.field}><span>{t("Event type", "Тип события")}</span><select value={state.kind} onChange={e => act({ type: "year-transits-filter", planet: state.planet, kind: e.target.value as YearTransitWorkspace["kind"] })}><option value="all">{t("All events", "Все события")}</option><option value="ingress">{t("Sign ingresses", "Входы в знаки")}</option><option value="station">{t("Direction changes", "Развороты")}</option></select></label>
      </div>
      <p role="status">{t("Events", "Событий")}: {events.length} / {r.events.length}</p>
      <details className={styles.details}><summary>{t("Exact events", "Точные события")}</summary><div className={styles.tableScroll} tabIndex={0} role="region" aria-label={t("Transit event timeline", "Лента событий транзитов")}><table className={styles.eventTable}><caption className={styles.srOnly}>{t("Transit event timeline", "Лента событий транзитов")}</caption>
        <thead><tr>{[t("Local time", "Местное время"), t("Object", "Объект"), t("Event", "Событие"), t("Transit chart", "Транзитная карта")].map(x => <th key={x}>{x}</th>)}</tr></thead>
        <tbody>{events.map(e => <tr key={e.ref} data-event-ref={e.ref}><th scope="row"><EventTime value={e.at} /></th><td>{n(e.planet)}</td><td>{e.kind === "ingress" ? <>{n(SIGNS[e.fromSign])} → {n(SIGNS[e.toSign])}<br />{e.direction === "direct" ? t("Direct ingress", "Прямой вход") : t("Retrograde return", "Ретроградный возврат")}</> : <>{e.direction === "direct" ? t("Turns direct", "Переход к прямому движению") : t("Turns retrograde", "Переход к ретроградному движению")}<br />{n(SIGNS[e.fromSign])} {degreeLabel(e.longitude)}</>}</td>
          <td><button type="button" disabled={!e.at.local} title={t("Select this event, rounded up to the next second, at the location specified above.", "Выбрать событие с округлением вверх до секунды для места, указанного выше.")} onClick={() => act({ type: "year-moment-event", ref: e.ref })}>{t("Show this moment", "Показать момент")}</button></td></tr>)}</tbody>
      </table></div></details>
      {!events.length && <p>{t("No events match these filters in the saved year.", "В сохранённом году нет событий для выбранных фильтров.")}</p>}
      <p className={styles.hint}>{t("The selected event is rounded up to the next second. The timeline retains exact timestamps. Independent reference acceptance is pending.", "Выбранное событие округляется вверх до секунды. Лента сохраняет точные моменты. Независимая сверка ещё впереди.")}</p>
    </> : <p>{t("Choose a year and time zone, then calculate the timeline.", "Выбери год и часовой пояс, затем рассчитай ленту.")}</p>}
  </section>;
}
