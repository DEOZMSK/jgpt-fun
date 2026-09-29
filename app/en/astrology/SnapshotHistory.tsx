"use client";

import { VARGAS } from "../../../lib/astrology/contracts";
import type { AstrologyLocale } from "../../../lib/astrology/workspace-copy";
import type { WorkspaceAction } from "../../../lib/local-workspace/controller";
import type { LocalCalculation, WorkspaceData } from "../../../lib/local-workspace/model";
import { selectedAstrologySnapshots } from "../../../lib/local-workspace/navigation";
import styles from "./workspace.module.css";

export function SnapshotHistory({ data, calculation, locale, busy, act }: {
  data: WorkspaceData; calculation: LocalCalculation | null; locale: AstrologyLocale; busy: boolean; act: (action: WorkspaceAction) => void;
}) {
  const snapshots = selectedAstrologySnapshots(data);
  if (!snapshots.length) return null;
  const ru = locale === "ru";
  const unsaved = Boolean(calculation && !data.calculations.some(saved => saved.id === calculation.id));
  return <details className={styles.details}>
    <summary>{ru ? "Сохранённые расчёты" : "Saved calculations"} ({snapshots.length})</summary>
    <p className={styles.hint}>{ru ? "Можно открыть предыдущий расчёт этой карты. Данные рождения и остальные результаты сохранятся." : "Open an earlier calculation of this chart. Birth details and other results are preserved."}</p>
    {unsaved && <div><p role="status">{ru ? "Сначала сохрани текущий результат, затем открой другой снимок." : "Save the current result before opening another snapshot."}</p><button type="button" className={styles.primary} disabled={busy} onClick={() => act({ type: "save-calculation" })}>{ru ? "Сохранить текущий результат" : "Save current result"}</button></div>}
    <ul className={styles.noteList}>{snapshots.map(snapshot => <li key={snapshot.id}>
      <button type="button" disabled={busy || unsaved} aria-pressed={calculation?.id === snapshot.id} onClick={() => act({ type: "open-calculation", id: snapshot.id })}>
        <time dateTime={snapshot.createdAt}>{snapshot.createdAt.slice(0, 19).replace("T", " ")} UTC</time>
        {" · "}{snapshot.kind === "astrology" ? VARGAS.filter(varga => snapshot.result.charts[varga]).length : 0} {ru ? "карт" : "charts"}
        {calculation?.id === snapshot.id && (ru ? " · открыт" : " · open")}
      </button>
      <small className={styles.hint}>{snapshot.methodVersion}</small>
    </li>)}</ul>
  </details>;
}
