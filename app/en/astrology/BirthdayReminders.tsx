"use client";
import { useMemo, useSyncExternalStore } from "react";
import type { AstrologyLocale } from "../../../lib/astrology/workspace-copy";
import type { WorkspaceAction, WorkspaceView } from "../../../lib/local-workspace/controller";
import { birthdayReminderEnabled, localBirthdayDate, upcomingBirthdays } from "../../../lib/local-workspace/birthdays";
import { WorkspaceIcon } from "./WorkspaceIcon";
import styles from "./birthdays.module.css";

const clockListeners = new Set<() => void>();
let clockTimer: ReturnType<typeof setInterval> | undefined;
const refreshClock = () => clockListeners.forEach(listener => listener());
function subscribeClock(listener: () => void) {
  clockListeners.add(listener);
  if (clockListeners.size === 1) {
    clockTimer = setInterval(refreshClock, 60_000);
    window.addEventListener("focus", refreshClock);
    document.addEventListener("visibilitychange", refreshClock);
  }
  return () => {
    clockListeners.delete(listener);
    if (!clockListeners.size) {
      clearInterval(clockTimer); clockTimer = undefined;
      window.removeEventListener("focus", refreshClock);
      document.removeEventListener("visibilitychange", refreshClock);
    }
  };
}
const getToday = () => localBirthdayDate(new Date());
const serverToday = () => "";

function ageLabel(age: number, locale: AstrologyLocale) {
  if (locale === "en") return `${age} ${age === 1 ? "year" : "years"}`;
  const form = new Intl.PluralRules("ru").select(age);
  return `${age} ${form === "one" ? "год" : form === "few" ? "года" : "лет"}`;
}

export function BirthdayReminders({ view, locale, act, openProfile }: {
  view: WorkspaceView; locale: AstrologyLocale; act: (action: WorkspaceAction) => void; openProfile: (id: string) => void;
}) {
  const t = (en: string, ru: string) => locale === "ru" ? ru : en;
  const today = useSyncExternalStore(subscribeClock, getToday, serverToday);
  const { profiles, folders } = view.data;
  const birthdays = useMemo(() => upcomingBirthdays(profiles, folders, today), [profiles, folders, today]);
  const enabled = profiles.filter(profile => birthdayReminderEnabled(profile, folders)).length;
  const canEnableMore = folders.some(folder => !folder.birthdayReminder) || profiles.some(profile => !profile.data.folderId && profile.birthdayReminder === undefined);
  const disabled = !view.loaded || view.busy || view.saving || Boolean(view.storageError);
  const formatDate = (date: string) => new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
  return <section className={styles.card} aria-label={t("Upcoming birthdays", "Ближайшие дни рождения")}>
    <h2><WorkspaceIcon name="calendar-days" />{t("Upcoming birthdays", "Ближайшие дни рождения")}</h2>
    <p className={styles.help}>{t("Today and the next 7 days", "Сегодня и ближайшие 7 дней")} · {today ? formatDate(today) : "…"}</p>
    {birthdays.length > 0 ? <ul className={styles.list}>{birthdays.map(item => <li key={item.profile.id}>
      <button type="button" className={styles.person} onClick={() => openProfile(item.profile.id)}>
        <span className={item.daysUntil === 0 ? styles.today : styles.when}>{item.daysUntil === 0 ? t("Today", "Сегодня") : item.daysUntil === 1 ? t("Tomorrow", "Завтра") : formatDate(item.date)}</span>
        <strong>{item.profile.data.name}</strong><span>{ageLabel(item.age, locale)} · <time dateTime={item.date}>{formatDate(item.date)}</time></span>
        {item.adjustedLeapDay && <small>{t("Born February 29", "Дата рождения — 29 февраля")}</small>}
      </button>
      <button type="button" className={styles.dismiss} disabled={disabled} aria-label={`${t("Turn off reminder", "Выключить напоминание")}: ${item.profile.data.name}`}
        onClick={() => act({ type: "profile-birthday-reminder", id: item.profile.id, enabled: false })}><span aria-hidden="true">×</span></button>
    </li>)}</ul> : <p className={styles.empty}>{!profiles.length ? t("Add a chart to keep track of birthdays.", "Добавь карту, чтобы следить за днями рождения.") : !enabled ? t("Choose the charts or folders you want birthday reminders for.", "Выбери карты или папки, о днях рождения которых напоминать.") : t("No enabled birthdays in the next 7 days.", "В ближайшие 7 дней нет дней рождения с включённым напоминанием.")}</p>}
    {canEnableMore && profiles.length > 0 && <div className={styles.enable}>
      <button type="button" disabled={disabled} onClick={() => act({ type: "enable-birthday-reminders" })}>{t("Enable reminders", "Включить напоминания")}</button>
      <p className={styles.help}>{t("Enable folders and unfiled charts. Personal opt-outs remain off.", "Включим для папок и карт без папки. Личные выключения сохраним.")}</p>
    </div>}
    <p className={styles.help}>{t("Enabled charts", "Включено для карт")}: {enabled} / {profiles.length}. {t("Based on your computer's date. For February 29 we use February 28 in common years. Only shown in the app; no email or push.", "По дате компьютера. Для 29 февраля в невисокосный год напоминаем 28 февраля. Только в приложении, без email и push.")}</p>
  </section>;
}
