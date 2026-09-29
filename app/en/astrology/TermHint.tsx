"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useSiteLocale } from "../../components/SiteLocaleProvider";
import { discussInWorkspace } from "../../../lib/workspace-chat-events";
import styles from "./term-hint.module.css";

/** Static, accessible explanations; never requests a model or reads private context. */
export function TermHint({ children, text }: { children: ReactNode; text: string }) {
  const id = useId(), trigger = useRef<HTMLButtonElement>(null), bubble = useRef<HTMLDivElement>(null), action = useRef<HTMLButtonElement>(null);
  const locale = useSiteLocale();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null), suppressFocus = useRef(false);
  const [open, setOpen] = useState(false), [pinned, setPinned] = useState(false);
  const [position, setPosition] = useState({ left: 8, top: 8 });
  const show = () => {
    if (suppressFocus.current) return;
    if (timer.current) clearTimeout(timer.current);
    const rect = trigger.current?.getBoundingClientRect();
    if (rect) setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 296)), top: Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 210)) });
    setOpen(true);
  };
  const close = () => { setOpen(false); setPinned(false); };
  const leave = () => { if (!pinned) timer.current = setTimeout(() => { if (!bubble.current?.contains(document.activeElement)) setOpen(false); }, 180); };
  const blur = (target: EventTarget | null) => { if (!bubble.current?.contains(target as Node) && target !== trigger.current) close(); };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    if (!open) return;
    const close = () => { setOpen(false); setPinned(false); };
    const outside = (event: PointerEvent) => { if (!trigger.current?.contains(event.target as Node) && !bubble.current?.contains(event.target as Node)) close(); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); close(); suppressFocus.current = true; trigger.current?.focus(); suppressFocus.current = false; } };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape); window.addEventListener("scroll", close, true);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); window.removeEventListener("scroll", close, true); };
  }, [open]);
  return <><button ref={trigger} type="button" className={styles.term} aria-controls={open ? id : undefined} aria-haspopup="dialog" aria-expanded={open}
    onFocus={show} onBlur={event => blur(event.relatedTarget)} onMouseEnter={show} onMouseLeave={leave}
    onKeyDown={event => { if (open && (event.key === "ArrowDown" || (event.key === "Tab" && !event.shiftKey))) { event.preventDefault(); action.current?.focus(); } }}
    onClick={() => { setPinned(!pinned); if (pinned) setOpen(false); else show(); }}>{children}</button>
    {open && createPortal(<div ref={bubble} id={id} role="dialog" aria-label={locale === "ru" ? "Пояснение термина" : "Term explanation"} className={styles.bubble} style={position}
      onMouseEnter={() => { if (timer.current) clearTimeout(timer.current); }} onMouseLeave={leave} onBlur={event => blur(event.relatedTarget)}>
      <p>{text}</p><button ref={action} type="button" className={styles.discuss} onClick={() => { close(); discussInWorkspace(locale === "ru" ? `Объясни подробнее: ${text}` : `Explain further: ${text}`); }}
        onKeyDown={event => { if (event.key === "Tab") { event.preventDefault(); close(); suppressFocus.current = true; trigger.current?.focus(); suppressFocus.current = false; } }}>
        {locale === "ru" ? "Обсудить в чате" : "Discuss in chat"}</button>
    </div>, document.body)}</>;
}

const roles: Record<string, [string, string]> = {
  AK: ["Atmakaraka", "Атмакарака"], AmK: ["Amatyakaraka", "Аматьякарака"], BK: ["Bhratrikaraka", "Бхратрикарака"], MK: ["Matrikaraka", "Матрикарака"],
  PiK: ["Pitrikaraka", "Питрикарака"], PK: ["Putrakaraka", "Путракарака"], GK: ["Gnatikaraka", "Гнатикарака"], DK: ["Darakaraka", "Даракарака"]
};
export function karakaHint(role: string, locale: "ru" | "en") {
  const name = roles[role]?.[locale === "ru" ? 1 : 0] ?? role;
  return locale === "ru" ? `${role} — ${name}, роль планеты в выбранной системе чара-карак, определяемая её положением внутри знака.` : `${role} — ${name}, a planetary role in the selected chara-karaka system, ranked by position within its sign.`;
}
