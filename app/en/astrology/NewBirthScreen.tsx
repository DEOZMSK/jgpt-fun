"use client";
import { useEffect, useState } from "react";
import type { WorkspaceController, WorkspaceView } from "../../../lib/local-workspace/controller";
import { hasUnsavedProfile } from "../../../lib/local-workspace/model";
import { discardBirthDraft } from "../../../lib/local-workspace/birth-flow";
import type { AstrologyLocale } from "../../../lib/astrology/workspace-copy";
import { BirthEditor } from "./BirthEditor";
import styles from "./workspace.module.css";

export function NewBirthScreen({ controller, view, locale, done, cancel, resume }: { controller: WorkspaceController; view: WorkspaceView; locale: AstrologyLocale; done: () => void; cancel: () => void; resume: () => void }) {
  const t = (en: string, ru: string) => locale === "ru" ? ru : en;
  const [state, setState] = useState<"opening" | "draft" | "ready">("opening");
  useEffect(() => {
    if (!view.loaded) return;
    let active = true;
    void (async () => {
      const current = controller.getSnapshot();
      if (current.data.ui.selectedProfileId && hasUnsavedProfile(current.data)) { if (active) setState("draft"); return; }
      if (current.data.ui.selectedProfileId) await controller.dispatch({ type: "new-profile" });
      if (active) setState(controller.getSnapshot().error ? "draft" : "ready");
    })();
    return () => { active = false; };
  }, [controller, view.loaded]);
  const discard = async () => {
    if (!await discardBirthDraft(controller)) return;
    await controller.dispatch({ type: "new-profile" });
    if (!controller.getSnapshot().error) setState("ready");
  };
  return <section><h1 className={styles.editorTitle}>{t("New chart", "Новая карта")}</h1>
    {!view.loaded || state === "opening" ? <p role="status">{t("Opening the form…", "Открываем форму…")}</p> : state === "draft" ? <div className={styles.calculationStatus}><div><strong>{t("You have unfinished work", "Есть незавершённая работа")}</strong><p>{t("Return to the open chart and save or cancel its pending changes before creating a new one.", "Вернись к открытой карте и сохрани или отмени незавершённые изменения перед созданием новой.")}</p></div><button type="button" onClick={resume}>{t("Return to current work", "Вернуться к работе")}</button>{view.error !== "save_note_first" && view.error !== "save_result_first" && <button type="button" onClick={() => void discard()}>{t("Discard edits and start new", "Отменить изменения и создать новую")}</button>}</div> : <BirthEditor controller={controller} view={view} locale={locale} done={done} cancel={cancel} />}
  </section>;
}
