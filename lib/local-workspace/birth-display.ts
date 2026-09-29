import { DateTime } from "luxon";
import { dashaOffsetLabel } from "../astrology/dasha-display";
import { normalizeBirthInput } from "../astrology/contracts";
import { astrologyInput, type BirthDraft } from "./model";

/** Display only: resolve the historical offset through the calculation contract. */
export function birthDisplay(draft: BirthDraft, locale: "ru" | "en") {
  const date = DateTime.fromISO(draft.date, { zone: "UTC" });
  let offset = locale === "ru" ? "Уточните часовой пояс" : "Check time zone";
  try { offset = dashaOffsetLabel(normalizeBirthInput(astrologyInput(draft)).utcOffsetMinutes); } catch { /* An incomplete draft must not imply a verified offset. */ }
  return { date: date.isValid ? date.setLocale(locale).toFormat(locale === "ru" ? "dd.MM.yyyy" : "dd LLL yyyy") : draft.date, time: draft.time, offset };
}
