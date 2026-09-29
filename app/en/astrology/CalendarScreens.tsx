"use client";
import { DateTime } from "luxon";
import { calendarDates } from "../../../lib/astrology/month-panchanga-contract";
import type { AstrologyLocale } from "../../../lib/astrology/workspace-copy";
import styles from "./workspace.module.css";

export function DatePicker({ date, onChange, locale }: { date: string; onChange: (date: string) => void; locale: AstrologyLocale }) {
  const civil = DateTime.fromISO(date, { zone: "UTC" }), ru = locale === "ru";
  const shift = (days: number) => { const next = civil.plus({ days }).toISODate()!; if (next >= "1900-01-01" && next <= "2100-12-31") onChange(next); };
  return <div className={styles.datePicker}><button type="button" aria-label={ru ? "Предыдущий день" : "Previous day"} onClick={() => shift(-1)}>‹</button><input type="date" min="1900-01-01" max="2100-12-31" aria-label={ru ? "Выбранная дата" : "Selected date"} value={date} onChange={e => { if (/^\d{4}-\d\d-\d\d$/.test(e.target.value) && e.target.value >= "1900-01-01" && e.target.value <= "2100-12-31") onChange(e.target.value); }} /><button type="button" aria-label={ru ? "Следующий день" : "Next day"} onClick={() => shift(1)}>›</button></div>;
}
export function LunarCalendar({ date, onDate, locale }: { date: string; onDate: (date: string) => void; locale: AstrologyLocale }) {
  const ru = locale === "ru", month = date.slice(0, 7), first = DateTime.fromISO(month + "-01", { zone: "UTC" });
  return <section><h1>{ru ? "Лунный прогноз" : "Lunar forecast"}</h1><div className={styles.lunarLayout}>
    <article><DatePicker date={date} onChange={onDate} locale={locale} /><h2>{ru ? "Прогноз для выбранного дня" : "Forecast for the selected day"}</h2><p className={styles.pendingCopy}>{ru ? "Здесь появится разбор лунного дня с расчётными основаниями и источниками. Метод трактовки и тексты ещё не подключены." : "A reading of the lunar day will appear here with calculation references and sources. The interpretation method and texts are not connected yet."}</p><div className={styles.futureGrid}>{(ru ? ["Общий фон", "Дела и общение", "Практика дня"] : ["General context", "Work and communication", "Daily practice"]).map(x => <section key={x}><h3>{x}</h3><p>{ru ? "Ожидает правил и материалов" : "Awaiting rules and materials"}</p></section>)}</div></article>
    <aside className={styles.miniCalendar}><div className={styles.screenHeading}><button type="button" aria-label={ru ? "Предыдущий месяц" : "Previous month"} onClick={() => { const d = first.minus({ months: 1 }).toISODate()!; if (d >= "1900-01-01") onDate(d); }}>‹</button><strong>{first.setLocale(locale).toFormat("LLLL yyyy")}</strong><button type="button" aria-label={ru ? "Следующий месяц" : "Next month"} onClick={() => { const d = first.plus({ months: 1 }).toISODate()!; if (d <= "2100-12-31") onDate(d); }}>›</button></div><div className={styles.calendarGrid}>{(ru ? ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] : ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]).map(x => <small key={x}>{x}</small>)}{Array.from({ length: first.weekday - 1 }, (_, i) => <span key={`blank${i}`} />)}{calendarDates(month).map(d => <button type="button" key={d} aria-pressed={date === d} aria-label={d} onClick={() => onDate(d)}>{Number(d.slice(-2))}</button>)}</div></aside>
  </div></section>;
}
