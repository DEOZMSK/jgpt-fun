"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { WorkspaceAction, WorkspaceView } from "../../../lib/local-workspace/controller";
import type { AstrologyLocale } from "../../../lib/astrology/workspace-copy";
import { AstrologyChart } from "./AstrologyChart";
import { RashiOverlays } from "./RashiOverlays";
import { DailyPanchangaView } from "./DailyPanchangaView";
import { dayReady } from "../../../lib/astrology/day-panchanga-contract";
import { WorkspaceIcon } from "./WorkspaceIcon";
import { WorkbenchDialog } from "./WorkbenchDialog";
import { BirthdayReminders } from "./BirthdayReminders";
import { FolderBirthdayToggle } from "./BirthdayToggle";
import { catalogProfiles, showAllCharts } from "../../../lib/local-workspace/navigation";
import styles from "./workspace.module.css";

type Props = { view: WorkspaceView; locale: AstrologyLocale; act: (a: WorkspaceAction) => void; openProfile: (id: string) => void; newProfile: () => void };
export function ChartCatalog({ view, locale, act, openProfile, newProfile, createFolder }: Props & { createFolder: (name: string) => Promise<boolean> }) {
  const t = (en: string, ru: string) => locale === "ru" ? ru : en;
  const { data } = view, { ui } = data;
  const [folderDialog, setFolderDialog] = useState(false), [name, setName] = useState("");
  const filtered = catalogProfiles(data);
  const searching = Boolean(ui.search.trim());
  const folder = data.folders.find(f => f.id === ui.folderFilter);
  if (!view.loaded) return <section className={styles.catalog}><h1>{t("My charts", "Мои карты")}</h1><p className={styles.hint}>{t("Charts and folders will appear after the collection connects.", "Карты и папки появятся после подключения коллекции.")}</p></section>;
  return <section className={styles.catalog}><div className={styles.screenHeading}><h1>{folder?.name ?? t("My charts", "Мои карты")}</h1><div className={styles.catalogActions}><button type="button" className={styles.primary} onClick={newProfile}>{t("Add chart", "Добавить карту")}</button><button type="button" onClick={() => { setName(""); setFolderDialog(true); }}>{t("Add folder", "Добавить папку")}</button></div></div>
    <div className={styles.catalogFilters}>{(ui.folderFilter || searching) && <button type="button" onClick={() => showAllCharts(act)}>{t("Back to folders", "К папкам")}</button>}<input type="search" aria-label={t("Search all folders", "Поиск по всем папкам")} placeholder={t("Search all folders", "Поиск по всем папкам")} maxLength={120} value={ui.search} onChange={e => act({ type: "search", text: e.target.value })} />{ui.search && <button type="button" onClick={() => act({ type: "search", text: "" })}>{t("Clear search", "Очистить поиск")}</button>}</div>
    <p className={styles.hint} role="status">{searching ? t("Found", "Найдено") : folder ? t("Charts in this folder", "Карт в папке") : t("Charts without a folder", "Карт без папки")}: {filtered.length} · {t("Total charts", "Всего карт")}: {data.profiles.length} · {t("Folders", "Папок")}: {data.folders.length}</p>
    {folder && <FolderBirthdayToggle folder={folder} locale={locale} act={act} disabled={view.busy || view.saving || Boolean(view.storageError)} />}
    <div className={styles.catalogGrid}>{!searching && !ui.folderFilter && data.folders.map(f => <button type="button" className={styles.catalogItem} key={f.id} onClick={() => act({ type: "filter-folder", id: f.id })}><WorkspaceIcon name="folder" /><span><strong>{f.name}</strong><small>{t("Charts", "Карт")}: {data.profiles.filter(p => p.data.folderId === f.id).length}</small></span></button>)}
    {filtered.map(p => <button type="button" className={styles.catalogItem} key={p.id} onClick={() => openProfile(p.id)}><WorkspaceIcon name="calendar-days" /><span><strong>{p.data.name}</strong><small>{p.data.date} {p.data.time || t("Time unknown", "Время неизвестно")}</small><small>{p.data.place || "—"}</small>{searching && <small>{data.folders.find(f => f.id === p.data.folderId)?.name ?? t("Without folder", "Без папки")}</small>}</span></button>)}</div>
    {!filtered.length && (searching || ui.folderFilter || !data.folders.length) && <div className={styles.emptyState}><p>{!data.profiles.length ? t("No saved charts in this collection yet. Add a chart to begin.", "В этой коллекции пока нет сохранённых карт. Добавь карту, чтобы начать.") : searching ? t("No matches. Your saved charts are still in their folders.", "Совпадений нет. Сохранённые карты остаются в своих папках.") : t("This folder has no charts. Other saved charts are in the catalog.", "В этой папке нет карт. Остальные сохранённые карты есть в каталоге.")}</p>{data.profiles.length > 0 && <button type="button" onClick={() => showAllCharts(act)}>{t("Open catalog", "Открыть каталог")}</button>}</div>}
    {folder && <form className={styles.folderRename} onSubmit={e => { e.preventDefault(); act({ type: "rename-folder", id: folder.id, name }); }}><label>{t("Folder name", "Название папки")}<input value={name} placeholder={folder.name} maxLength={120} required onChange={e => setName(e.target.value)} /></label><button type="submit">{t("Rename", "Переименовать")}</button></form>}
    {folderDialog && <WorkbenchDialog title={t("Add a new folder", "Добавление новой папки")} closeLabel={t("Close", "Закрыть")} onClose={() => setFolderDialog(false)}><form onSubmit={e => { e.preventDefault(); void createFolder(name).then(ok => { if (ok) setFolderDialog(false); }); }}><p>{t("Choose a name. Folders currently have one level.", "Придумай название. Сейчас папки имеют один уровень.")}</p><label className={styles.field}><span>{t("Folder name", "Название папки")}</span><input value={name} maxLength={120} required onChange={e => setName(e.target.value)} /></label><div className={styles.catalogActions}><button type="button" onClick={() => setFolderDialog(false)}>{t("Close", "Закрыть")}</button><button type="submit" className={styles.primary} disabled={!name.trim() || data.folders.some(f => f.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase())}>{t("Add", "Добавить")}</button></div>{data.folders.some(f => f.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase()) && <p role="status">{t("Folder is available in the catalog.", "Папка есть в каталоге.")}</p>}{view.error && <p role="alert">{t("Could not create the folder. Check its name.", "Не удалось создать папку. Проверь название.")}</p>}{view.storageError && <p role="alert">{t("Folder is not saved to storage.", "Папка не сохранена в хранилище.")}</p>}</form></WorkbenchDialog>}
  </section>;
}
export function WorkspaceHome({ view, locale, act, openProfile, newProfile, date, recentProfiles = [] }: Props & { date: string; onDate: (d: string) => void; calendar: () => void; recentProfiles?: string[] }) {
  const pathname = usePathname();
  const basePath = `/${locale}/${pathname?.includes("/admin/orchestra/astrology") ? "admin/orchestra/astrology" : pathname?.includes("/demo/astrology") ? "demo/astrology" : "astrology"}`;
  const t = (en: string, ru: string) => locale === "ru" ? ru : en, { ui } = view.data;
  const calculation = view.results.astrology, natal = calculation?.kind === "astrology" ? calculation.result : null;
  const transit = dayReady(ui.dayPanchanga, date) ? ui.dayPanchanga.result!.moment : null;
  const matching = catalogProfiles(view.data, true);
  const recent = recentProfiles.flatMap(id => matching.find(p => p.id === id) ?? []);
  const people = (ui.search ? matching : [...recent, ...matching.filter(p => !recentProfiles.includes(p.id))]).slice(0, 8);
  const selected = view.data.profiles.find(p => p.id === ui.selectedProfileId) ?? recentProfiles.flatMap(id => view.data.profiles.find(p => p.id === id) ?? [])[0];
  if (!view.loaded) return <section className={styles.homeDashboard}><h1>{t("Workspace home", "Главная мастерской")}</h1><p className={styles.hint}>{t("Your collection will appear after it connects.", "Твоя коллекция появится после подключения.")}</p></section>;
  return <section className={styles.homeDashboard} aria-label={t("Workspace home", "Главная мастерской")}>
    <header className={styles.homeWelcome}><p>JYOTISHGPT · {t("Your workspace", "Твоя мастерская")}</p><h1>{selected ? t("Continue exploring", "Продолжим изучать карту") : t("Start with a birth chart", "Начни с карты рождения")}</h1><p>{t("Your charts, calculations and tools in one place. Use the buttons or the command bar below.", "Твои карты, расчёты и инструменты в одном месте. Используй кнопки или строку команд внизу.")}</p><div className={styles.compactActions}><button type="button" className={styles.primary} onClick={newProfile}>{t("Build a chart", "Построить карту")}</button>{selected && <button type="button" onClick={() => openProfile(selected.id)}>{t("Continue", "Продолжить")}: {selected.data.name}</button>}<Link href={`${basePath}/charts`} onClick={() => showAllCharts(act)}>{t("All charts and folders", "Все карты и папки")}</Link></div></header>
    <aside>
      <h2>{ui.search ? t("Search results", "Результаты поиска") : t("Recent and saved charts", "Недавние и сохранённые карты")}</h2>
      <div className={styles.quickSearch}>
        <input aria-label={t("Quick search", "Быстрый поиск")} placeholder={t("Quick search", "Быстрый поиск")} value={ui.search} maxLength={120} onChange={e => act({ type: "search", text: e.target.value })} />
        <button type="button" className={styles.primary} onClick={newProfile}>{t("New chart", "Новая карта")}</button>
      </div>
      {ui.search && <button type="button" onClick={() => act({ type: "search", text: "" })}>{t("Clear search", "Очистить поиск")}</button>}
      <p className={styles.hint} role="status">{t("Shown", "Показано")}: {people.length} / {matching.length} · {t("Total charts", "Всего карт")}: {view.data.profiles.length}</p>
      <ul className={styles.homePeople}>{people.map(p => <li key={p.id}><button type="button" onClick={() => openProfile(p.id)}><WorkspaceIcon name="calendar-days" /><span><strong>{p.data.name}</strong><small>{p.data.date} {p.data.time}</small><small>{p.data.place}</small></span></button></li>)}</ul>
      {!people.length && <p>{view.data.profiles.length ? t("No matching charts. Clear the search to see your saved records.", "Подходящих карт нет. Очисти поиск, чтобы увидеть сохранённые записи.") : t("No charts in this collection yet. Add your first chart.", "В этой коллекции пока нет карт. Добавь первую карту.")}</p>}
      <Link href={`${basePath}/charts`} onClick={() => showAllCharts(act)}>{t("Open chart catalog", "Открыть каталог карт")} ({view.data.profiles.length})</Link>
      <BirthdayReminders view={view} locale={locale} act={act} openProfile={openProfile} />
    </aside>
    <div><div className={styles.homeChartPair}>
      <section><div className={styles.screenHeading}><h2>{t("Chart for the moment", "Карта на момент")}</h2><button type="button" disabled={!ui.dayPanchanga.draft.timezone || view.busy} onClick={() => act({ type: "day-now" })}>{t("Now", "Сейчас")}</button></div>
        <p className={styles.hint}>{transit ? `${transit.instant.utc} · ${transit.input.place}` : t("Set the daily location below and calculate the moment.", "Укажи место дня ниже и рассчитай момент.")}</p>
        {transit ? <AstrologyChart chart={transit.chart} varga="D1" locale={locale} southern={ui.southern} /> : <div className={styles.emptyChart}>{t("Current positions have not been calculated", "Текущие положения не рассчитаны")}</div>}
      </section>
      <section><h2>{t("Your open birth chart", "Твоя открытая карта рождения")}</h2><RashiOverlays natal={natal} mode={ui.chartOverlay} transit={ui.transit} locale={locale} southern={ui.southern} act={act} />
        {!natal && <Link href={`${basePath}${ui.selectedProfileId ? "" : "/charts"}`}>{ui.selectedProfileId ? t("Open chart and calculate", "Открыть карту и рассчитать") : t("Choose a birth chart", "Выбрать карту рождения")}</Link>}
      </section>
    </div><DailyPanchangaView state={ui.dayPanchanga} month={ui.monthPanchanga} date={date} locale={locale} act={act} busy={view.busy} southern={ui.southern} hasProfile={!!ui.selectedProfileId} compact /></div>
  </section>;
}
export function LocalProfileScreen({ view, locale, openCharts }: { view: WorkspaceView; locale: AstrologyLocale; openCharts: () => void }) {
  const t = (en: string, ru: string) => locale === "ru" ? ru : en;
  const selected = view.data.profiles.find(p => p.id === view.data.ui.selectedProfileId);
  return <section className={styles.accountScreen}><h1>{t("My profile", "Мой профиль")}</h1><h2>{t("Local workspace", "Локальная мастерская")}</h2><p className={styles.hint}>{t("Account connection and private settings are a separate upcoming stage.", "Подключение аккаунта и приватные настройки — отдельный следующий этап.")}</p><div className={styles.catalogActions}><button disabled>{t("Change password · later", "Изменить пароль · позже")}</button><button disabled>{t("Delete account · later", "Удалить аккаунт · позже")}</button></div><div className={styles.accountColumns}><section><h2>{t("My birth chart", "Моя карта рождения")}</h2><p><strong>{selected?.data.name ?? t("Not selected", "Не выбрана")}</strong></p><p>{selected?.data.date} {selected?.data.time}</p><p>{selected?.data.place}</p><button type="button" onClick={openCharts}>{t("Choose a chart", "Выбрать карту")}</button></section><section><h2>{t("Current location", "Сейчас я живу в")}</h2><p>{t("Not set. A separate location will be connected to the daily tools later; birth coordinates are not used as your home address.", "Не указано. Отдельное место подключим к ежедневным инструментам позже; координаты рождения не считаются адресом проживания.")}</p><button disabled>{t("Choose city · later", "Выбрать город · позже")}</button></section></div></section>;
}
