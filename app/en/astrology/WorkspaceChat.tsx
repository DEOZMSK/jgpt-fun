"use client";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import type { WorkspaceController, WorkspaceView } from "../../../lib/local-workspace/controller";
import { WorkspaceAssistant, type AssistantReply } from "../../../lib/local-workspace/assistant";
import { assistantMessage } from "../../../lib/local-workspace/assistant-copy";
import { LocalChatStore } from "../../../lib/local-chat";
import { OPEN_WORKSPACE_CHAT, appendChatQuestion } from "../../../lib/workspace-chat-events";
import type { AstrologyLocale } from "../../../lib/astrology/workspace-copy";
import styles from "./workspace-chat.module.css";

export function workspaceChatContext(view: WorkspaceView, locale: AstrologyLocale, section: string) {
  const { ui } = view.data;
  const person = view.data.profiles.find(p => p.id === ui.selectedProfileId);
  const result = view.results.astrology;
  const ru = locale === "ru";
  const screen = section === "chart" ? (ui.workbench.panel === "periods" ? (ui.dashaSystem === "yogini" ? (ru ? "Йогини Даша" : "Yogini Dasha") : (ru ? "Вимшоттари Даша" : "Vimshottari Dasha")) : ui.workbench.panel === "vargas" ? ui.varga : "Rashi + D9")
    : ({ home: ru ? "Главная" : "Home", charts: ru ? "Каталог" : "Catalog", new: ru ? "Новая карта" : "New chart" }[section] ?? section);
  return [person?.data.name ?? (ru ? "Карта не выбрана" : "No selected chart"), screen,
    result && person && result.profileId === person.id ? `${ru ? "Расчёт" : "Result"} ${result.createdAt} · ${result.id.slice(0, 8)}` : (ru ? "Без расчёта" : "No calculation"),
    ui.chartOverlay === "transits" && section === "chart" && ui.transit.result ? `${ru ? "Транзиты" : "Transits"}: ${ui.transit.result.instant.utc} UTC` : ""].filter(Boolean).join(" · ").slice(0, 600);
}

export function WorkspaceChat({ controller, view, locale, section, store, blocked, navigate }: {
  controller: WorkspaceController; view: WorkspaceView; locale: AstrologyLocale; section: string; store: LocalChatStore; blocked: boolean;
  navigate: (reply: AssistantReply) => void;
}) {
  const [assistant] = useState(() => new WorkspaceAssistant(controller));
  const { chat, ready, error } = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [busy, setBusy] = useState(false);
  const [pendingState, setPendingState] = useState<{reply:AssistantReply;context:string} | null>(null);
  const pendingContext = `${locale}/${view.data.ui.selectedProfileId ?? ""}`;
  const pending = pendingState?.context === pendingContext ? pendingState.reply : null;
  const setPending = (reply:AssistantReply|null) => setPendingState(reply ? {reply,context:pendingContext} : null);
  const [showHelp, setShowHelp] = useState(false);
  const [draftOverflow, setDraftOverflow] = useState(false);
  const [keyboard, setKeyboard] = useState({ bottom: 0, available: 800, mobile: false });
  const input = useRef<HTMLTextAreaElement>(null), log = useRef<HTMLDivElement>(null), running = useRef(false);
  const t = (en: string, ru: string) => locale === "ru" ? ru : en;
  const context = workspaceChatContext(view, locale, section);
  useEffect(() => { assistant.setLocale(locale); assistant.cancel(); }, [assistant, locale, view.data.ui.selectedProfileId]);
  useEffect(() => () => assistant.cancel(), [assistant]);
  useEffect(() => {
    const open = (event: Event) => {
      const detail: unknown = event instanceof CustomEvent ? event.detail : null;
      const question = detail && typeof detail === "object" && "question" in detail && typeof detail.question === "string" ? detail.question : "";
      const appended = appendChatQuestion(store.getSnapshot().chat.draft, question);
      setDraftOverflow(appended.overflow);
      store.update(c => ({ ...c, open: true, draft: question ? appended.draft : c.draft }));
      requestAnimationFrame(() => input.current?.focus());
    };
    window.addEventListener(OPEN_WORKSPACE_CHAT, open);
    const viewport = window.visualViewport;
    const resize = () => setKeyboard({ bottom: viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0, available: viewport?.height ?? window.innerHeight, mobile: window.innerWidth <= 600 });
    resize(); viewport?.addEventListener("resize", resize); viewport?.addEventListener("scroll", resize);
    window.addEventListener("resize", resize);
    return () => { window.removeEventListener(OPEN_WORKSPACE_CHAT, open); window.removeEventListener("resize", resize); viewport?.removeEventListener("resize", resize); viewport?.removeEventListener("scroll", resize); };
  }, [store]);
  useEffect(() => { if (chat.open) log.current?.scrollTo({ top: log.current.scrollHeight }); }, [chat.messages.length, chat.open, pending]);
  const execute = async (text: string, choice?: string, confirmation?: string) => {
    if (running.current || blocked || view.busy || view.saving || !view.loaded || chat.messages.length > 998) return;
    running.current = true; setBusy(true); setPending(null); setShowHelp(false); setDraftOverflow(false);
    const origin = workspaceChatContext(controller.getSnapshot(), locale, section);
    store.update(c => ({ ...c, open: true, draft: "", messages: [...c.messages, { role: "user", text, context: origin }] }));
    try {
      const reply = choice ? await assistant.choose(choice, locale) : confirmation ? await assistant.confirm(confirmation, locale) : await assistant.run(text, locale);
      const applied = workspaceChatContext(controller.getSnapshot(), locale, reply.screen ?? section);
      setShowHelp(reply.code === "command_help");
      let answer = assistantMessage(reply.code, locale) + (reply.detail ? ` ${reply.detail}` : "");
      if (reply.code === "context_ready") answer = applied;
      store.update(c => ({ ...c, messages: [...c.messages, { role: "assistant", text: answer.slice(0, 2000), context: applied }] }));
      setPending(reply.choices || reply.confirmation ? reply : null);
      if (reply.screen) navigate(reply);
    } catch {
      store.update(c => ({ ...c, messages: [...c.messages, { role: "assistant", text: t("Command failed. Check the workspace before retrying.", "Команда не завершена. Проверь состояние карты перед повтором."), context: origin }] }));
    } finally { running.current = false; setBusy(false); }
  };
  if (!ready) return null;
  const disabled = busy || blocked || view.busy || view.saving || !view.loaded || chat.messages.length > 998;
  const quick = locale === "ru" ? ["Построить карту", "Открой D9", "Покажи транзиты", "Открой Вимшоттари", "Помощь"] : ["Build a chart", "Open D9", "Show transits", "Open Vimshottari", "Help"];
  return <aside className={styles.dock} aria-label={t("Workspace chat", "Чат мастерской")} style={{ bottom: `${keyboard.bottom + 12}px`, "--chat-height": `${keyboard.available * (keyboard.mobile ? .60 : .45)}px`, maxHeight: keyboard.available - 24 } as CSSProperties}
    onKeyDown={event => { if (event.key === "Escape") { store.update(c => ({ ...c, open: false })); input.current?.focus(); } }}>
    <header className={styles.header}><button type="button" aria-expanded={chat.open} aria-controls="workspace-conversation" onClick={() => store.update(c => ({ ...c, open: !c.open }))}>{chat.open ? "⌄" : "⌃"} {t("Conversation", "Переписка")} <span>({chat.messages.length})</span></button><span className={styles.context} title={context}>{context}</span></header>
    {chat.open && <section id="workspace-conversation" className={styles.conversation}>
      <div className={styles.log} ref={log} role="log" aria-live="polite" aria-relevant="additions">
        <p className={styles.intro}>{t("Open charts and tools here. GPT interpretations are a later stage; commands run without an AI call.", "Здесь можно открывать карты и инструменты. GPT-разборы подключим позже; команды работают без обращения к AI.")}</p>
        {chat.messages.map((message, index) => <article className={message.role === "user" ? styles.user : styles.reply} key={index}><small>{message.role === "user" ? t("You", "Ты") : t("Workspace · command result", "Мастерская · результат команды")}</small><p>{message.text}</p>{message.context && <small className={styles.messageContext}>{message.context}</small>}</article>)}
        {busy && <p role="status">{t("Running command…", "Выполняю команду…")}</p>}
        {pending?.choices && <div className={styles.choices}>{pending.choices.map(choice => <button type="button" disabled={disabled} key={choice.id} onClick={() => void execute(choice.label, choice.id)}>{choice.label}</button>)}</div>}
        {pending?.confirmation && <div><p>{pending.confirmation.folder}: {pending.confirmation.people.join(", ")}</p><button disabled={disabled} type="button" onClick={() => void execute(t("Confirm move", "Подтверждаю перенос"), undefined, pending.confirmation!.id)}>{t("Confirm", "Подтвердить")}</button><button type="button" onClick={() => { assistant.dismiss(); setPending(null); }}>{t("Cancel", "Отмена")}</button></div>}
      </div>
      {(!chat.messages.length || showHelp) && <div className={styles.quick}>{quick.map(command => <button type="button" key={command} disabled={disabled} onClick={() => void execute(command)}>{command}</button>)}</div>}
    </section>}
    {error && <p role="alert" className={styles.warning}>{t("Chat storage is unavailable. Keep this tab open; new messages remain in memory.", "Хранилище переписки недоступно. Оставь вкладку открытой: новые сообщения остаются в памяти страницы.")}</p>}
    {draftOverflow && <p role="alert" className={styles.warning}>{t("The question does not fit. Your entire draft is preserved; send or shorten it first.", "Вопрос не поместился. Черновик сохранён целиком — сначала отправь или сократи его.")}</p>}
    <form className={styles.composer} onSubmit={event => { event.preventDefault(); if (chat.draft.trim()) void execute(chat.draft.trim()); }}>
      <textarea ref={input} aria-label={t("Workspace command", "Команда мастерской")} placeholder={t("Open a chart, show D9, or ask for help…", "Открой карту, покажи D9 или напиши «Помощь»…")} rows={1} maxLength={2000} value={chat.draft} onChange={event => store.update(c => ({ ...c, draft: event.target.value }))} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (chat.draft.trim()) void execute(chat.draft.trim()); } }} />
      <button type="submit" disabled={disabled || !chat.draft.trim()} aria-label={t("Run command", "Выполнить команду")}>↑</button>
    </form>
    {blocked && <p className={styles.warning}>{t("Finish or close the open dialog to use chat commands.", "Заверши действие или закрой диалог, чтобы использовать команды.")}</p>}
    {chat.messages.length > 998 && <p className={styles.warning}>{t("Conversation limit reached. History is preserved; use the workspace buttons.", "Достигнут лимит переписки. История сохранена; используй кнопки программы.")}</p>}
  </aside>;
}
