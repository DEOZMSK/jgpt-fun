"use client";
import { DateTime } from "luxon";
import type { AstrologyLocale } from "../../../lib/astrology/workspace-copy";
import styles from "./workspace.module.css";

export function DatePicker({ date, onChange, locale }: { date: string; onChange: (date: string) => void; locale: AstrologyLocale }) {
  const civil = DateTime.fromISO(date, { zone: "UTC" }), ru = locale === "ru";
  const shift = (days: number) => { const next = civil.plus({ days }).toISODate()!; if (next >= "1900-01-01" && next <= "2100-12-31") onChange(next); };
  return <div className={styles.datePicker}><button type="button" aria-label={ru ? "Предыдущий день" : "Previous day"} onClick={() => shift(-1)}>‹</button><input type="date" min="1900-01-01" max="2100-12-31" aria-label={ru ? "Выбранная дата" : "Selected date"} value={date} onChange={e => { if (/^\d{4}-\d\d-\d\d$/.test(e.target.value) && e.target.value >= "1900-01-01" && e.target.value <= "2100-12-31") onChange(e.target.value); }} /><button type="button" aria-label={ru ? "Следующий день" : "Next day"} onClick={() => shift(1)}>›</button></div>;
}
