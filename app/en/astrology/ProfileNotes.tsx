"use client";
import { useState } from "react";
import type { AstrologyLocale } from "../../../lib/astrology/workspace-copy";
import { hasUnsavedNote, NOTE_LIMIT, type ProfileNote } from "../../../lib/local-workspace/model";
import type { WorkspaceController, WorkspaceView } from "../../../lib/local-workspace/controller";
import styles from "./workspace.module.css";

export function ProfileNotes({ controller, view, locale }: { controller: WorkspaceController; view: WorkspaceView; locale: AstrologyLocale }) {
  const t = (en: string, ru: string) => locale === "ru" ? ru : en;
  const profile = view.data.profiles.find(p => p.id === view.data.ui.selectedProfileId);
  const draft = view.data.ui.noteDraft, dirty = hasUnsavedNote(view.data);
  const [confirm, setConfirm] = useState<ProfileNote | null>(null);
  if (!profile) return <p>{t("Select a person first.", "Сначала выбери человека.")}</p>;
  const notes = profile.notes ?? [];
  return <fieldset className={styles.deskFieldset} disabled={view.busy}>
    <legend className={styles.srOnly}>{t("Profile notes", "Заметки человека")}</legend>
    <p><strong>{profile.data.name}</strong> · {t("Saved notes belong to this chart.", "Заметки сохраняются вместе с картой.")}</p>
    <button type="button" className={styles.secondary} disabled={dirty} onClick={() => { setConfirm(null); void controller.dispatch({ type: "begin-note" }); }}>{t("New note", "Новая заметка")}</button>
    {draft.profileId === profile.id && <form className={styles.noteEditor} method="post" onSubmit={event => { event.preventDefault(); void controller.dispatch({ type: "save-note" }); }}>
      <label className={styles.field}><span>{draft.noteId ? t("Edit note", "Редактировать заметку") : t("Note text", "Текст заметки")}</span>
        <textarea value={draft.text} maxLength={NOTE_LIMIT} rows={8} onChange={event => { void controller.dispatch({ type: "edit-note-draft", text: event.target.value }); }} />
      </label>
      <div className={styles.compactActions}><button className={styles.primary} disabled={!dirty || !draft.text.trim()}>{t("Save note", "Сохранить заметку")}</button>
        <button type="button" className={styles.secondary} onClick={() => { void controller.dispatch({ type: "discard-note-draft" }); }}>{dirty ? t("Discard changes", "Отменить изменения") : t("Close editor", "Закрыть редактор")}</button>
        <span role="status" className={styles.hint}>{dirty ? t("Draft differs from the saved note.", "Черновик отличается от сохранённой заметки.") : draft.noteId ? t("Note saved.", "Заметка сохранена.") : ""}</span>
      </div>
    </form>}
    {dirty && <p className={styles.hint}>{t("Closing this window keeps the draft. Save it or discard the changes before switching people.", "Закрытие окна сохраняет черновик. Сохрани его или отмени изменения перед сменой человека.")}</p>}
    {!notes.length && <p>{t("No saved notes yet.", "Сохранённых заметок пока нет.")}</p>}
    <ul className={styles.noteList}>{[...notes].reverse().map(note => <li key={note.id}>
      <p className={styles.noteText}>{note.text}</p>
      <p className={styles.hint}><time dateTime={note.updatedAt}>{note.updatedAt.slice(0, 16).replace("T", " ")} UTC</time></p>
      <div className={styles.compactActions}><button type="button" disabled={dirty} onClick={() => { setConfirm(null); void controller.dispatch({ type: "begin-note", id: note.id }); }}>{t("Edit note", "Редактировать заметку")}</button>
        <button type="button" disabled={dirty} onClick={() => setConfirm(note)}>{t("Delete note", "Удалить заметку")}</button></div>
      {confirm?.id === note.id && <div className={styles.noteConfirmation} role="group" aria-label={t("Confirm note deletion", "Подтверждение удаления заметки")}>
        <p>{t("Delete this saved note? This cannot be undone here.", "Удалить эту сохранённую заметку? Вернуть её здесь будет нельзя.")}</p>
        <button type="button" className={styles.primary} onClick={() => { void controller.dispatch({ type: "delete-note", id: confirm.id, revision: confirm.revision }).then(id => { if (id) setConfirm(null); }); }}>{t("Confirm deletion", "Подтвердить удаление")}</button>
        <button type="button" onClick={() => setConfirm(null)}>{t("Cancel", "Отмена")}</button>
      </div>}
    </li>)}</ul>
  </fieldset>;
}
