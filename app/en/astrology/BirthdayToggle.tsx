"use client";
import type { AstrologyLocale } from "../../../lib/astrology/workspace-copy";
import type { WorkspaceAction } from "../../../lib/local-workspace/controller";
import type { LocalFolder, LocalProfile } from "../../../lib/local-workspace/model";
import { birthdayReminderEnabled } from "../../../lib/local-workspace/birthdays";
import { WorkspaceIcon } from "./WorkspaceIcon";
import styles from "./birthdays.module.css";

type CommonProps = { locale: AstrologyLocale; act: (action: WorkspaceAction) => void; disabled?: boolean };

export function BirthdayToggle({ profile, folders, locale, act, disabled }: CommonProps & { profile?: LocalProfile; folders: LocalFolder[] }) {
  const t = (en: string, ru: string) => locale === "ru" ? ru : en;
  const enabled = profile ? birthdayReminderEnabled(profile, folders) : false;
  const folder = folders.find(item => item.id === profile?.data.folderId);
  return <span className={styles.toggleGroup}>
    <button className={styles.toggle} type="button" role="switch" aria-checked={enabled}
      aria-label={t("Birthday reminder", "Напоминание о дне рождения")}
      disabled={disabled || !profile} title={t("Show this birthday on the home page", "Показывать этот день рождения на главной")}
      onClick={() => { if (profile) act({ type: "profile-birthday-reminder", id: profile.id, enabled: !enabled }); }}>
      <WorkspaceIcon name="calendar-days" /><span>{t("Birthday", "День рождения")}</span><span aria-hidden="true" className={styles.track}><span /></span>
    </button>
    {profile && folder && profile.birthdayReminder !== undefined && <button type="button" className={styles.inherit} disabled={disabled}
      title={`${t("Use folder preference", "Использовать настройку папки")}: ${folder.name}`}
      onClick={() => act({ type: "profile-birthday-reminder", id: profile.id, enabled: null })}>{t("Use folder setting", "Как в папке")}</button>}
  </span>;
}

export function FolderBirthdayToggle({ folder, locale, act, disabled }: CommonProps & { folder: LocalFolder }) {
  const t = (en: string, ru: string) => locale === "ru" ? ru : en;
  return <div className={styles.folderSettings}>
    <button className={styles.toggle} type="button" role="switch" aria-checked={folder.birthdayReminder ?? false} disabled={disabled}
      onClick={() => act({ type: "folder-birthday-reminder", id: folder.id, enabled: !folder.birthdayReminder })}>
      <WorkspaceIcon name="calendar-days" /><span>{t("Birthday reminders in this folder", "Напоминания о днях рождения в папке")}</span><span aria-hidden="true" className={styles.track}><span /></span>
    </button>
    <p className={styles.help}>{t("Personal chart settings take priority. For February 29, the reminder falls on February 28 in common years. Reminders appear only in this app.", "Личная настройка карты имеет приоритет. Для 29 февраля в невисокосный год напоминаем 28 февраля. Напоминания появляются только в приложении.")}</p>
  </div>;
}
