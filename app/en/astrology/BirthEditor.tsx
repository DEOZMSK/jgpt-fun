"use client";
import { useEffect, useRef, useState } from "react";
import { hasUnsavedProfile, type BirthDraft } from "../../../lib/local-workspace/model";
import { birthCalculationIssue, discardBirthDraft, saveBirthChart, type BirthIssue } from "../../../lib/local-workspace/birth-flow";
import { workspaceError } from "../../../lib/local-workspace/copy";
import type { WorkspaceController, WorkspaceView } from "../../../lib/local-workspace/controller";
import type { AstrologyLocale } from "../../../lib/astrology/workspace-copy";
import { CitySearch } from "./CitySearch";
import styles from "./workspace.module.css";

export function BirthEditor({ controller, view, locale, done, cancel, onPendingChange }: { controller: WorkspaceController; view: WorkspaceView; locale: AstrologyLocale; done: () => void; cancel: () => void; onPendingChange?: (pending: boolean) => void }) {
  const t = (en: string, ru: string) => locale === "ru" ? ru : en, draft = view.data.ui.draft;
  const form = useRef<HTMLFormElement>(null);
  const [issue, setIssue] = useState<BirthIssue | null>(null);
  const [manual, setManual] = useState(false);
  const [committing, setCommitting] = useState(false);
  const mounted = useRef(false), pending = useRef(false), pendingCallback = useRef(onPendingChange);
  useEffect(() => { pendingCallback.current = onPendingChange; }, [onPendingChange]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (pending.current) { pending.current = false; pendingCallback.current?.(false); }
    };
  }, []);
  const setPending = (value: boolean) => {
    if (!mounted.current) return;
    pending.current = value; setCommitting(value); pendingCallback.current?.(value);
  };
  const historical = Boolean(draft.date && draft.date < "1900-01-01");
  const busy = view.busy || committing;
  useEffect(() => {
    if (issue) form.current?.querySelector<HTMLElement>(`[name="${issue.field}"]`)?.focus();
  }, [issue, manual]);
  const patch = (value: Partial<BirthDraft>) => { setIssue(null); void controller.dispatch({ type: "edit-draft", patch: value }); };
  const field = (key: keyof BirthDraft, label: string, type = "text", extra: Record<string, string | number | boolean> = {}) => <label className={styles.field}><span>{label}</span><input autoComplete="off" type={type} name={key} value={draft[key] ?? ""} maxLength={120} aria-invalid={issue?.field === key || undefined} onInput={e => { if (type === "date" || type === "time") patch({ [key]: e.currentTarget.value }); }} onChange={e => { if (type !== "date" && type !== "time") patch({ [key]: e.target.value }); }} {...extra} /></label>;
  const save = async (calculate: boolean) => {
    if (busy || pending.current) return;
    if (!form.current?.reportValidity()) return;
    const problem = calculate ? birthCalculationIssue(controller.getSnapshot().data.ui.draft) : null;
    if (problem) {
      setIssue(problem);
      if (["timezone", "latitude", "longitude", "utcOffsetMinutes"].includes(problem.field)) setManual(true);
      return;
    }
    setIssue(null);
    setPending(true);
    let saved = false;
    try { saved = await saveBirthChart(controller, calculate); }
    finally { setPending(false); }
    if (saved && mounted.current) done();
  };
  const discard = async () => {
    if (busy || pending.current) return;
    setPending(true);
    let discarded = false;
    try { discarded = await discardBirthDraft(controller); }
    finally { setPending(false); }
    if (discarded && mounted.current) cancel();
  };
  const placeReady = !!(draft.place && draft.latitude.trim() && draft.longitude.trim() && draft.timezone);
  return <fieldset className={`${styles.deskFieldset} ${styles.birthEditor}`} disabled={busy}>
    <legend className={styles.srOnly}>{t("Birth profile", "Профиль рождения")}</legend>
    <form ref={form} onSubmit={e => { e.preventDefault(); void save(true); }}>
      {field("name", t("Name", "Имя"), "text", { required: true })}
      <div className={styles.birthRow}>
        {field("date", t("Birth date", "Дата рождения"), "date", { required: true, min: "0001-01-01", max: "2100-12-31" })}
        {field("time", t("Birth time", "Время рождения"), "time", { step: 1 })}
        <label className={styles.field}><span>{t("Time accuracy", "Точность времени")}</span><select name="accuracy" aria-label={t("Time accuracy", "Точность времени")} aria-invalid={issue?.field === "accuracy" || undefined} value={draft.accuracy} onChange={e => patch({ accuracy: e.target.value as BirthDraft["accuracy"] })}><option value="unknown">{t("Choose / unknown", "Выбери / неизвестно")}</option><option value="approximate">{t("Approximate", "Приблизительное")}</option><option value="exact">{t("Exact", "Точное")}</option></select></label>
        <label className={styles.field}><span>{t("Folder", "Папка")}</span><select aria-label={t("Folder", "Папка")} value={draft.folderId ?? ""} onChange={e => patch({ folderId: e.target.value || null })}><option value="">{t("Without folder", "Без папки")}</option>{view.data.folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
      </div>
      {draft.accuracy !== "exact" && <p className={styles.hint}>{t("Select Exact if you know the birth time. Otherwise save the birth record without a calculation; time uncertainty analysis is not available yet.", "Если время рождения известно точно, выбери «Точное». Иначе можно сохранить запись без расчёта: анализ погрешности времени пока не подключён.")}</p>}
      <CitySearch value={draft.place} locale={locale} disabled={busy} onChange={place => patch(manual ? { place } : { place, latitude: "", longitude: "", timezone: "", utcOffsetMinutes: "" })} onSelect={city => patch({ place: city.label.slice(0,120), latitude: String(city.latitude), longitude: String(city.longitude), timezone: city.timezone, utcOffsetMinutes: "" })} />
      <div className={styles.locationMode}><strong>{placeReady ? t("Location is ready", "Место определено") : t("Select a city from the list", "Выбери город из списка")}</strong><button type="button" aria-expanded={manual} onClick={() => setManual(!manual)}>{manual ? t("Hide manual settings", "Скрыть ручные настройки") : t("Enter coordinates manually", "Указать координаты вручную")}</button></div>
      {placeReady && !manual && <p className={styles.hint}>{draft.latitude}°, {draft.longitude}° · {draft.timezone}. {t("The offset is calculated for the birth date, including historical clock changes.", "Смещение определяется на дату рождения с учётом исторических переводов часов.")}</p>}
      {manual && <div className={styles.birthRow}>{field("longitude", t("Longitude", "Долгота"), "number", { min: -180, max: 180, step: "any" })}{field("latitude", t("Latitude", "Широта"), "number", { min: -89, max: 89, step: "any" })}{field("timezone", t("IANA time zone", "Часовой пояс IANA"), "text", { placeholder: "Asia/Bishkek", maxLength: 80 })}{field("utcOffsetMinutes", t("Confirmed UTC offset (minutes)", "Подтверждённое смещение UTC (минуты)"), "number", { min: -840, max: 840 })}</div>}
      <details className={styles.details}><summary>{t("Calculation settings", "Настройки расчёта")}</summary><div className={styles.birthRow}><label className={styles.field}><span>{t("Lunar nodes", "Лунные узлы")}</span><select aria-label={t("Lunar nodes", "Лунные узлы")} value={draft.nodes} onChange={e => patch({ nodes: e.target.value as BirthDraft["nodes"] })}><option value="true">{t("True", "Истинные")}</option><option value="mean">{t("Mean", "Средние")}</option></select></label></div><p className={styles.hint}>{t("Use a confirmed UTC offset only when resolving a repeated local time. Coordinates can always be edited manually.", "Подтверждённое смещение UTC нужно для выбора повторившегося местного времени. Координаты можно исправить вручную.")}</p></details>
      <p className={styles.hint}>{t("City data: ", "Справочник городов: ")}<a href="https://www.geonames.org/" target="_blank" rel="noopener noreferrer">GeoNames</a> (CC BY). {t("Search uses the laboratory catalog.", "Поиск выполняется в каталоге лаборатории.")}</p>
      {historical && <p className={styles.hint}>{t("This historical record can be saved. Calculations support 1900–2100.", "Историческую запись можно сохранить. Расчёты поддерживают 1900–2100 годы.")}</p>}
      {(issue || view.error) && <p role="alert" className={styles.error}>{workspaceError(issue?.code ?? view.error!, locale)}</p>}
      {view.storageError && <p role="alert" className={styles.error}>{workspaceError(view.storageError, locale)}</p>}
      <div className={styles.editorFooter}><span className={styles.hint}>{hasUnsavedProfile(view.data) ? t("Birth details are not saved yet", "Данные рождения ещё не сохранены") : t("Profile saved", "Профиль сохранён")}</span><button type="button" onClick={() => void discard()}>{t("Cancel", "Отменить")}</button><button type="button" onClick={() => void save(false)}>{t("Save without calculation", "Сохранить без расчёта")}</button><button className={styles.primary} type="submit" disabled={historical}>{busy ? t("Saving and calculating…", "Сохраняем и рассчитываем…") : t("Save and calculate", "Сохранить и рассчитать")}</button></div>
    </form>
  </fieldset>;
}
