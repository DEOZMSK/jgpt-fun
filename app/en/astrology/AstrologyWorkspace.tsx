"use client";
import { DailyPanchangaView } from "./DailyPanchangaView";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type MouseEvent } from "react";
import type { AstrologyLocale } from "../../../lib/astrology/workspace-copy";
import { WorkspaceController, type WorkspaceAction } from "../../../lib/local-workspace/controller";
import { IndexedWorkspaceStorage } from "../../../lib/local-workspace/storage";
import { hasUnsavedNote, hasUnsavedProfile } from "../../../lib/local-workspace/model";
import { hasMeaningfulBirthDraft, showAllCharts } from "../../../lib/local-workspace/navigation";
import { workspaceError } from "../../../lib/local-workspace/copy";
import { ChartWorkbench } from "./ChartWorkbench";
import { useOpenedChart } from "./useOpenedChart";
import { BirthdayToggle } from "./BirthdayToggle";
import { WorkbenchDialog } from "./WorkbenchDialog";
import { ToolMenu } from "./ToolMenu";
import { CalculationProfiles } from "./CalculationProfiles";
import { ProfileNotes } from "./ProfileNotes";
import { BirthEditor } from "./BirthEditor";
import { NewBirthScreen } from "./NewBirthScreen";
import { birthCalculationIssue, discardBirthDraft } from "../../../lib/local-workspace/birth-flow";
import { refreshAstrology } from "../../../lib/local-workspace/refresh-calculation";
import { ChartCatalog, WorkspaceHome } from "./WorkspaceScreens";
import { YearTransitView } from "./YearTransitView";
import { MonthPanchangaView } from "./MonthPanchangaView";
import { WorkspaceIcon } from "./WorkspaceIcon";
import { birthDisplay } from "../../../lib/local-workspace/birth-display";
import styles from "./workspace.module.css";

export function AstrologyWorkspace({ locale }: { locale: AstrologyLocale }) {
  const [initialError, setInitialError] = useState(false);
  const [session, setSession] = useState<{ controller: WorkspaceController; storage: IndexedWorkspaceStorage } | null>(null);
  useEffect(() => {
    const storage = new IndexedWorkspaceStorage("jgpt-fun-workspace-v1");
    let instance: WorkspaceController | null = null;
    let active = true;
    void (async () => {
      instance = new WorkspaceController(storage);
      await instance.initialize(); if (active) setSession({ controller: instance, storage }); else instance.dispose();
    })().catch(() => { if (active) setInitialError(true); });
    return () => { active = false; if (instance) { const current = instance; void current.settle().then(() => current.dispose()); } else storage.close(); };
  }, []);
  return session ? <Workspace controller={session.controller} storage={session.storage} initialLocale={locale} /> : <main className={styles.workspace}><p className={styles.loading} role={initialError ? "alert" : "status"}>{initialError ? workspaceError("storage_unavailable", locale) : locale === "ru" ? "Открываем мастерскую…" : "Opening workspace…"}</p>{initialError && <button type="button" onClick={() => window.location.reload()}>{locale === "ru" ? "Повторить" : "Retry"}</button>}</main>;
}
function Workspace({ controller, storage, initialLocale }: { controller: WorkspaceController; storage: IndexedWorkspaceStorage; initialLocale: AstrologyLocale }) {
  const view = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const pathname = usePathname();
  const router = useRouter();
  const requestedProfile = useSearchParams().get("chart");
  const section = pathname?.split("/astrology/")[1] || "chart";
  const initialCatalogReset = useRef(section === "charts");
  const locale = pathname?.startsWith("/ru/") ? "ru" : pathname?.startsWith("/en/") ? "en" : initialLocale;
  const t = (en: string, ru: string) => locale === "ru" ? ru : en;
  const { data } = view; const { ui } = data;
  const [moveFolder, setMoveFolder] = useState<string | null>(null);
  const [editPending, setEditPending] = useState(false);
  const [drawer, setDrawer] = useState<"edit" | "move" | "settings" | "notes" | "remove" | "calendar" | null>(null);
  const act = (action: WorkspaceAction) => { void controller.dispatch(action); };
  const selected = data.profiles.find(p => p.id === ui.selectedProfileId);
  const birth = birthDisplay(ui.draft, locale);
  useOpenedChart(controller, view, section === "chart" && (!requestedProfile || requestedProfile === selected?.id));
  const dirtyProfile = hasUnsavedProfile(data) && !!(ui.draft.name || ui.draft.date);
  const alertRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if ((view.error || view.storageError) && !drawer) {
      alertRef.current?.focus({ preventScroll: true });
      alertRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [view.error, view.storageError, drawer]);
  const date = ui.calendarDate || new Date().toISOString().slice(0, 10);
  const setDate = (date: string) => act({type:"select-calendar-date",date});
  useEffect(() => {
    if (!view.loaded || !initialCatalogReset.current) return;
    initialCatalogReset.current = false;
    showAllCharts(action => { void controller.dispatch(action); });
  }, [controller, view.loaded]);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      const retainedTabWork = hasMeaningfulBirthDraft(view.data) || hasUnsavedNote(view.data);
      if (view.saving || view.storageError || retainedTabWork || Object.values(view.results).some(result => result && !view.data.calculations.some(c => c.id === result.id))) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", guard); return () => window.removeEventListener("beforeunload", guard);
  }, [view.saving, view.storageError, view.results, view.data, storage]);
  const close = () => { if (view.busy || editPending) return; if (drawer === "remove") void controller.dispatch({ type: "cancel-profile-deletion" }); setDrawer(null); };
  const openCatalog = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (view.busy || view.saving || editPending) { event.preventDefault(); return; }
    initialCatalogReset.current = !view.loaded;
    if (view.loaded) showAllCharts(act);
    close();
  };
  const astro = view.results.astrology;
  const chart = astro?.kind === "astrology" ? astro.result : null;
  const closeLabel = t("Close", "Закрыть");
  const workspacePath = "astrology";
  const basePath = `/${locale}/${workspacePath}`;
  const breadcrumbFolder = view.data.folders.find(folder => folder.id === (section === "chart" ? selected?.data.folderId : section === "charts" ? view.data.ui.folderFilter : null));
  const openParentFolder = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (view.busy || view.saving || editPending) { event.preventDefault(); return; }
    if (breadcrumbFolder) { act({ type: "search", text: "" }); act({ type: "filter-folder", id: breadcrumbFolder.id }); }
    close();
  };
  const chartHref = (id: string | null = controller.getSnapshot().data.ui.selectedProfileId) => id ? `${basePath}?chart=${encodeURIComponent(id)}` : basePath;
  useEffect(() => {
    if (!view.loaded || section !== "chart") return;
    const currentId = controller.getSnapshot().data.ui.selectedProfileId;
    if (requestedProfile && requestedProfile !== currentId) void controller.dispatch({ type: "open-profile", id: requestedProfile });
    else if (!requestedProfile && currentId) window.history.replaceState(null, "", `${basePath}?chart=${encodeURIComponent(currentId)}`);
  }, [controller, requestedProfile, section, basePath, view.loaded]);
  const languageSuffix = section === "chart" ? requestedProfile ? `?chart=${encodeURIComponent(requestedProfile)}` : "" : `/${section}`;
  const screenTitle: Record<string, string> = {
    new: t("New chart", "Новая карта"),
    panchanga: t("Daily panchanga", "Панчанга на день"), transits: t("Year transits", "Транзиты на год"),
    calendar: t("Monthly panchanga", "Панчанга на месяц"), settings: t("Settings", "Настройки")
  };
  const openProfile = async (id: string) => {
    await controller.dispatch({ type: "open-profile", id });
    if (!controller.getSnapshot().error) { close(); router.push(chartHref(id)); }
  };
  const newProfile = async () => {
    await controller.dispatch({ type: "new-profile" });
    if (!controller.getSnapshot().error) { setDrawer(null); router.push(`${basePath}/new`); }
  };
  const prepareChart = () => {
    if (!selected) { void newProfile(); return; }
    if (dirtyProfile || birthCalculationIssue(selected.data)) { setDrawer("edit"); return; }
    void refreshAstrology(controller);
  };
  return <main className={styles.workspace} lang={locale}>
    {process.env.NEXT_PUBLIC_LOCAL_WORKSPACE_ID && <p className={styles.hint} aria-label={t("Local version", "Локальная версия")}>{process.env.NEXT_PUBLIC_LOCAL_WORKSPACE_ID}</p>}
    <div className={styles.referenceShell}>
    <header className={styles.referenceHeader}>
      <Link className={styles.referenceBrand} href={`${basePath}/home`}>JGPT<br /><strong>FUN</strong></Link>
      <nav className={styles.referenceTopNav} aria-label={t("Main navigation", "Главное меню")}>
        <Link href={`${basePath}/home`} aria-current={section === "home" ? "page" : undefined} onClick={close}>{t("Home", "Главная")}</Link>
        <Link href={`${basePath}/charts`} aria-current={section === "charts" ? "page" : undefined} onClick={openCatalog}>{t("My charts", "Мои карты")}</Link>
        <Link href={`${basePath}/panchanga`} aria-current={section === "panchanga" ? "page" : undefined} onClick={close}>{t("Panchanga", "Панчанга")}</Link>
        <ToolMenu label={t("Calendars and transits", "Календари и транзиты")}><button type="button" onClick={() => { close(); router.push(`${basePath}/transits`); }}>{t("Yearly transits", "Транзиты на год")}</button><button type="button" onClick={() => { close(); router.push(`${basePath}/calendar`); }}>{t("Monthly panchanga", "Панчанга на месяц")}</button></ToolMenu>
        <Link href={`${basePath}/settings`}>{t("Settings", "Настройки")}</Link>
        <nav className={styles.referenceLanguages} aria-label={t("Language", "Язык")}>{(["ru", "en"] as const).map(language => <Link key={language} href={`/${language}/${workspacePath}${languageSuffix}`} lang={language} aria-current={locale === language ? "page" : undefined} onClick={event => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); if (locale !== language) window.history.pushState(null, "", `/${language}/${workspacePath}${languageSuffix}`);
        }}>{language.toUpperCase()}</Link>)}</nav>
      </nav>
      <nav className={styles.breadcrumbs} aria-label={t("Breadcrumbs", "Навигационная цепочка")}><Link href={`${basePath}/home`} aria-current={section === "home" ? "page" : undefined} onClick={close}>{t("Home", "Главная")}</Link><span>›</span><Link href={`${basePath}/charts`} aria-current={section === "charts" && !breadcrumbFolder ? "page" : undefined} onClick={openCatalog}>{t("My charts", "Мои карты")}</Link>{breadcrumbFolder && <><span>›</span><Link href={`${basePath}/charts`} aria-current={section === "charts" ? "page" : undefined} onClick={openParentFolder}>{breadcrumbFolder.name}</Link></>}{(section === "chart" || screenTitle[section]) && <><span>›</span><strong aria-current="page">{section === "chart" ? selected?.data.name ?? t("New chart", "Новая карта") : screenTitle[section]}</strong></>}</nav>
    </header>
    <div ref={alertRef} tabIndex={-1} className={styles.alerts}>{view.error && view.error !== view.storageError && <p role="alert" className={styles.error}>{workspaceError(view.error, locale)}{view.error === "save_note_first" && <button type="button" onClick={() => setDrawer("notes")}>{t("Return to note", "Вернуться к заметке")}</button>}</p>}{view.storageError && <div role="alert" className={styles.error}><p>{workspaceError(view.storageError, locale)}</p>{<button type="button" disabled={view.busy || view.saving} onClick={() => act({ type: "retry-storage" })}>{!view.loaded ? view.busy ? t("Connecting…", "Подключаем…") : t("Reconnect collection", "Подключить коллекцию") : t("Retry storage", "Повторить сохранение")}</button>}</div>}</div>

    {dirtyProfile && section !== "new" && !drawer && <div className={styles.draftNotice}><span>{t("Unfinished birth edits", "Есть несохранённые данные рождения")}</span><button type="button" onClick={() => setDrawer("edit")}>{t("Continue birth draft", "Продолжить черновик карты")}</button><button type="button" onClick={() => void discardBirthDraft(controller)}>{t("Discard changes", "Отменить изменения")}</button></div>}
    {section === "home" && <WorkspaceHome view={view} locale={locale} act={act} openProfile={openProfile} newProfile={newProfile} date={date} onDate={setDate} calendar={() => setDrawer("calendar")} />}
    {section === "charts" && <ChartCatalog createFolder={async name => { await controller.dispatch({type:"create-folder",name}); await controller.settle(); return !controller.getSnapshot().error && !controller.getSnapshot().storageError; }} view={view} locale={locale} act={act} openProfile={openProfile} newProfile={newProfile} />}
    {section === "new" && <NewBirthScreen controller={controller} view={view} locale={locale} done={() => router.push(chartHref())} cancel={() => router.push(`${basePath}/charts`)} resume={() => { router.push(chartHref()); setDrawer(view.error === "save_note_first" ? "notes" : view.error === "save_result_first" ? null : "edit"); }} />}
    {section === "panchanga" && <DailyPanchangaView state={ui.dayPanchanga} month={ui.monthPanchanga} date={date} locale={locale} act={act} busy={view.busy} southern={ui.southern} hasProfile={!!selected} />}
    {section === "transits" && <YearTransitView state={ui.yearTransits} moment={ui.yearTransitMoment} southern={ui.southern} busy={view.busy} locale={locale} hasProfile={!!selected} act={act} />}
    {section === "calendar" && <MonthPanchangaView busy={view.busy} state={ui.monthPanchanga} locale={locale} hasProfile={!!selected} act={act} />}
    {section === "settings" && <section className={styles.accountScreen}><h1>{t("Workspace settings", "Настройки мастерской")}</h1><div className={styles.compactActions}><button type="button" aria-pressed={!ui.southern} onClick={() => act({type:"chart-style",southern:false})}>{t("Northern chart", "Северная карта")}</button><button type="button" aria-pressed={ui.southern} onClick={() => act({type:"chart-style",southern:true})}>{t("Southern chart", "Южная карта")}</button></div><CalculationProfiles result={chart} locale={locale} /></section>}

    {section === "chart" && requestedProfile && requestedProfile !== ui.selectedProfileId ? <section className={styles.emptyDesk}><h1>{t("Open chart", "Открытие карты")}</h1><p>{t("This chart has not opened. Resolve the message above or choose a record from your catalog.", "Карта ещё не открылась. Исправь причину в сообщении выше или выбери запись из каталога.")}</p><button type="button" disabled={view.busy} onClick={() => void openProfile(requestedProfile)}>{t("Try opening again", "Открыть ещё раз")}</button><Link href={`${basePath}/charts`}>{t("My charts", "Мои карты")}</Link></section> : section === "chart" && <><div className={styles.referenceProfile}>
      <h1>{selected?.data.name ?? t("New chart", "Новая карта")}</h1>
      <div className={styles.birthLine}>{selected ? <><div><WorkspaceIcon name="calendar-days" /><span className={styles.birthInstant}>{birth.date} · {birth.time}</span></div><div><WorkspaceIcon name="map-pin" /><span>{ui.draft.place} · <span className={styles.birthInstant}>{birth.offset}</span></span></div></> : <button type="button" onClick={() => setDrawer("edit")}>{t("Enter birth details", "Ввести данные рождения")}</button>}{dirtyProfile && <button type="button" className={styles.draftBadge} onClick={() => setDrawer("edit")}>{t("Unsaved draft", "Несохранённый черновик")}</button>}</div>
      <div className={styles.referenceActions}><BirthdayToggle profile={selected} folders={data.folders} locale={locale} act={act} disabled={view.busy || view.saving || Boolean(view.storageError)} />
        <button type="button" onClick={() => setDrawer("edit")}>{t("Edit", "Изменить")}</button>
        <button type="button" disabled={!selected} onClick={() => { setMoveFolder(selected?.data.folderId ?? null); setDrawer("move"); }}>{t("Move", "Переместить")}</button>
        <button type="button" className={styles.removeButton} disabled={!selected || view.busy || view.saving} onClick={() => { void controller.dispatch({ type: "request-profile-deletion" }).then(token => { if (token) setDrawer("remove"); }); }}>{t("Delete", "Удалить")}</button>
        <button type="button" aria-label={t("Chart settings", "Настройки карты")} onClick={() => setDrawer("settings")}><WorkspaceIcon name="settings" /></button>
        <button type="button" className={styles.notesButton} disabled={!selected || view.busy} onClick={() => { if (selected && !selected.notes?.length && ui.noteDraft.profileId !== selected.id) void controller.dispatch({ type: "begin-note" }); setDrawer("notes"); }}>{t("Notes", "Заметки")} ({selected?.notes?.length ?? 0})</button>
      </div>
    </div>
    {view.busy && <p role="status">{t("Calculating…", "Вычисляем…")}</p>}
    <fieldset className={styles.deskFieldset} disabled={!view.loaded || view.busy}><legend className={styles.srOnly}>{t("Chart", "Карта")}</legend>
      <ChartWorkbench busy={view.busy} calculation={astro} data={data} locale={locale} act={act} onPrepareChart={prepareChart} />
    </fieldset></>}
    </div>
    {drawer && <WorkbenchDialog busy={view.busy || editPending} busyLabel={t("An operation is running. Please wait.", "Операция выполняется. Дождись завершения.")} title={drawer === "calendar" ? t("Calendar location and month", "Место и месяц календаря") : drawer === "edit" ? t("Edit birth details", "Изменить данные рождения") : drawer === "move" ? t("Move chart", "Переместить карту") : drawer === "settings" ? t("Chart settings", "Настройки карты") : drawer === "notes" ? t("Notes", "Заметки") : t("Delete chart", "Удалить карту")} closeLabel={closeLabel} onClose={close}>
      {view.error && <p role="alert" className={styles.error}>{workspaceError(view.error!, locale)}</p>}
      {view.storageError && <p role="alert" className={styles.error}>{workspaceError(view.storageError, locale)}</p>}
      {drawer === "edit" && <BirthEditor onPendingChange={setEditPending} controller={controller} view={view} locale={locale} done={() => { setDrawer(null); router.push(chartHref()); }} cancel={() => setDrawer(null)} />}
      {drawer === "calendar" && <MonthPanchangaView busy={view.busy} state={ui.monthPanchanga} locale={locale} hasProfile={!!selected} act={act} />}
      {drawer === "move" && <form method="post" onSubmit={e => { e.preventDefault(); if (selected) void controller.dispatch({ type: "move-profile", id: selected.id, folderId: moveFolder }).then(() => { if (!controller.getSnapshot().error) close(); }); }}><label className={styles.field}><span>{t("Profile folder", "Папка профиля")}</span><select aria-label={t("Profile folder", "Папка профиля")} value={moveFolder ?? ""} onChange={e => setMoveFolder(e.target.value || null)}><option value="">{t("Without a folder", "Без папки")}</option>{data.folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label><button type="submit" className={styles.primary}>{t("Move", "Переместить")}</button></form>}
      {drawer === "notes" && <ProfileNotes controller={controller} view={view} locale={locale} />}
      {drawer === "remove" && view.deletion && <fieldset className={styles.deskFieldset} disabled={view.busy}>
        <legend className={styles.srOnly}>{t("Confirm profile deletion", "Подтверждение удаления профиля")}</legend>
        <p><strong>{view.deletion.name}</strong> · {view.deletion.date}</p>
        <p>{t("This will delete this person, their saved calculations", "Будут удалены этот человек, его сохранённые расчёты")} ({view.deletion.calculations}) {t("and notes", "и заметки")} ({view.deletion.notes}).</p>
        <p>{t("Current workspace selections and calendar/transit drafts will be cleared. Other people, their saved calculations and folders remain.", "Текущий выбор в кабинете и черновики календарей/транзитов очистятся. Другие люди, их сохранённые расчёты и папки останутся.")}</p>
        <p>{t("Deletion cannot be undone in the workspace. It does not change a cloud account.", "В кабинете отменить удаление будет нельзя. Облачный аккаунт не изменяется.")}</p>
        <div className={styles.compactActions}><button type="button" className={styles.primary} onClick={() => { const token = view.deletion!.token; void controller.dispatch({ type: "delete-profile", token }).then(id => { if (id) { setDrawer(null); router.push(`${basePath}/charts`); } }); }}>{view.busy ? t("Deleting…", "Удаляем…") : t("Delete person and their data", "Удалить человека и его данные")}</button>
          <button type="button" className={styles.secondary} onClick={close}>{t("Cancel", "Отмена")}</button></div>
      </fieldset>}
      {drawer === "settings" && <><div className={styles.compactActions} role="group" aria-label={t("Chart style", "Вид карты")}><button type="button" aria-pressed={!ui.southern} onClick={() => act({ type: "chart-style", southern: false })}>{t("Northern", "Северная")}</button><button type="button" aria-pressed={ui.southern} onClick={() => act({ type: "chart-style", southern: true })}>{t("Southern", "Южная")}</button></div>
        <button type="button" className={styles.primary} disabled={view.busy || view.saving || !!view.storageError || !selected} onClick={() => { close(); prepareChart(); }}>{astro ? t("Update calculation", "Обновить расчёт") : t("Calculate chart", "Рассчитать карту")}</button>
        <p className={styles.hint}>{t("A new result is added to Saved calculations. Earlier results are preserved.", "Новый результат добавится в «Сохранённые расчёты». Предыдущие результаты останутся доступны.")}</p>
        <CalculationProfiles result={chart} locale={locale} /></>}
    </WorkbenchDialog>}
    <footer className={styles.workspaceFooter}><span>JGPT-FUN · AGPL-3.0-or-later</span><a href={process.env.NEXT_PUBLIC_SOURCE_URL || "https://github.com/DEOZMSK/jgpt-fun"} target="_blank" rel="noopener noreferrer">{t("Source code of this version", "Исходники этой версии")}</a><Link href={`/${locale}/about`}>{t("About and data", "О лаборатории и данных")}</Link></footer>
  </main>;
}
