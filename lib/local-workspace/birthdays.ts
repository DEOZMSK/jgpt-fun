import type { LocalFolder, LocalProfile } from "./model";

export type UpcomingBirthday = { profile: LocalProfile; date: string; daysUntil: number; age: number; adjustedLeapDay: boolean };
type CivilDate = { year: number; month: number; day: number; timestamp: number };
const leapYear = (year: number) => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
const pad = (value: number, length = 2) => String(value).padStart(length, "0");
const isoDate = (year: number, month: number, day: number) => `${pad(year, 4)}-${pad(month)}-${pad(day)}`;

function parseCivilDate(value: string): CivilDate | null {
  if (!/^\d{4}-\d\d-\d\d$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0); date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? { year, month, day, timestamp: date.getTime() } : null;
}

/** Use the computer's civil day, independently of chart and calendar selections. */
export function localBirthdayDate(now: Date): string {
  return Number.isFinite(now.getTime()) ? isoDate(now.getFullYear(), now.getMonth() + 1, now.getDate()) : "";
}

/** An absent personal preference inherits the folder. Explicit false always wins. */
export function birthdayReminderEnabled(profile: LocalProfile, folders: readonly LocalFolder[]): boolean {
  return profile.birthdayReminder ?? folders.find(folder => folder.id === profile.data.folderId)?.birthdayReminder ?? false;
}

/** Calendar arithmetic avoids DST-length days; common-year leap birthdays use February 28. */
export function upcomingBirthdays(profiles: readonly LocalProfile[], folders: readonly LocalFolder[], today: string, horizon = 7): UpcomingBirthday[] {
  const current = parseCivilDate(today);
  if (!current || !Number.isInteger(horizon) || horizon < 0 || horizon > 366) return [];
  const upcoming: UpcomingBirthday[] = [];
  for (const profile of profiles) {
    if (!birthdayReminderEnabled(profile, folders)) continue;
    const birth = parseCivilDate(profile.data.date);
    if (!birth || profile.data.date > today) continue;
    let year = current.year;
    const birthdayIn = (target: number) => isoDate(target, birth.month, birth.month === 2 && birth.day === 29 && !leapYear(target) ? 28 : birth.day);
    if (birthdayIn(year) < today) year++;
    const date = birthdayIn(year), anniversary = parseCivilDate(date);
    if (!anniversary) continue;
    const daysUntil = (anniversary.timestamp - current.timestamp) / 86_400_000;
    if (daysUntil <= horizon) upcoming.push({ profile, date, daysUntil, age: year - birth.year,
      adjustedLeapDay: birth.month === 2 && birth.day === 29 && !leapYear(year) });
  }
  return upcoming.sort((a, b) => a.daysUntil - b.daysUntil || a.profile.data.name.localeCompare(b.profile.data.name) || a.profile.id.localeCompare(b.profile.id));
}
