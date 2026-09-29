"use client";
import { useEffect, useId, useState } from "react";
import type { AstrologyLocale } from "../../../lib/astrology/workspace-copy";
import styles from "./workspace.module.css";

export type CityChoice = { id: number; name: string; label: string; country: string; latitude: number; longitude: number; timezone: string };
export function CitySearch({ value, locale, disabled, onChange, onSelect, label }: { value: string; locale: AstrologyLocale; disabled: boolean; onChange: (value: string) => void; onSelect: (city: CityChoice) => void; label?: string }) {
  const t = (en: string, ru: string) => locale === "ru" ? ru : en;
  const listId = useId(), [open, setOpen] = useState(false), [active, setActive] = useState(-1);
  const [result, setResult] = useState<{ query: string; status: "loading" | "ready" | "error"; places: CityChoice[] }>({ query: "", status: "ready", places: [] });
  const query = value.trim(), shown = open && query.length >= 2 && !disabled;
  useEffect(() => {
    if (!open || query.length < 2 || disabled) return;
    const abort = new AbortController();
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(async () => {
      setResult({ query, status: "loading", places: [] });
      deadline = setTimeout(() => { setResult({ query, status: "error", places: [] }); abort.abort(); }, 20_000);
      try {
        const endpoint = "/api/astrology/places";
        const response = await fetch(`${endpoint}?q=${encodeURIComponent(query)}&language=${locale}`, { signal: abort.signal, cache: "no-store", credentials: "same-origin" });
        if (!response.ok) throw new Error("city_lookup_unavailable");
        const body = await response.json() as { places?: CityChoice[] };
        if (!Array.isArray(body.places)) throw new Error("invalid_city_response");
        if (!abort.signal.aborted) { setResult({ query, status: "ready", places: body.places }); setActive(-1); }
      } catch { if (!abort.signal.aborted) setResult({ query, status: "error", places: [] }); }
      finally { clearTimeout(deadline); }
    }, 250);
    return () => { clearTimeout(timer); clearTimeout(deadline); abort.abort(); };
  }, [query, open, disabled, locale]);
  const places = result.query === query ? result.places : [];
  const choose = (city: CityChoice) => { onSelect(city); setOpen(false); setActive(-1); };
  return <div className={styles.citySearch} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <label className={styles.field}><span>{label ?? t("Birthplace", "Место рождения")}</span>
      <input name="place" autoComplete="off" role="combobox" disabled={disabled} aria-autocomplete="list" aria-expanded={shown} aria-controls={listId} aria-activedescendant={active >= 0 && places[active] ? `${listId}-${active}` : undefined} value={value} maxLength={120} placeholder={t("Start typing a city or settlement", "Начни вводить город или населённый пункт")} onChange={e => { onChange(e.target.value); setOpen(true); setActive(-1); }} onFocus={() => setOpen(true)} onKeyDown={e => {
        if (e.key === "Escape" && open) { e.preventDefault(); e.stopPropagation(); setOpen(false); return; }
        if (shown && places.length && (e.key === "ArrowDown" || e.key === "ArrowUp")) { e.preventDefault(); setActive(i => i < 0 ? e.key === "ArrowDown" ? 0 : places.length - 1 : (i + (e.key === "ArrowDown" ? 1 : -1) + places.length) % places.length); }
        if (shown && active >= 0 && places[active] && e.key === "Enter") { e.preventDefault(); choose(places[active]); }
      }} />
    </label>
    {shown && <div className={styles.cityResults}>
      {result.query !== query || result.status === "loading" ? <p role="status">{t("Finding cities…", "Ищем города…")}</p> : result.status === "error" ? <p role="status">{t("City lookup is unavailable. You can enter coordinates and a time zone manually below.", "Справочник сейчас недоступен. Ниже можно указать координаты и часовой пояс вручную.")}</p> : places.length === 0 ? <p role="status">{t("No matches. Try another spelling or enter the location manually.", "Совпадений нет. Попробуй другое название или укажи место вручную.")}</p> : <ul id={listId} role="listbox" aria-label={t("Matching cities", "Найденные города")}>{places.map((city, i) => <li role="presentation" key={city.id}><button id={`${listId}-${i}`} type="button" role="option" aria-selected={active === i} onClick={() => choose(city)}><strong>{city.name}</strong><span>{city.label}</span><small>{city.timezone}</small></button></li>)}</ul>}
      <button type="button" className={styles.cityDismiss} onClick={() => setOpen(false)}>{t("Close suggestions", "Закрыть подсказки")}</button>
    </div>}
  </div>;
}
