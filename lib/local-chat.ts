export const CHAT_KEY = "global-local-chat-v1";
export type ChatMessage = { role: "user" | "assistant"; text: string; context?: string };
export type LocalChat = { version: 2; open: boolean; draft: string; messages: ChatMessage[]; recentProfiles: string[]; activeCalculationId?: string | null };
export const emptyChat = (): LocalChat => ({ version: 2, open: false, draft: "", messages: [], recentProfiles: [] });
export function readChat(raw: string | null): LocalChat {
  if (raw === null) return emptyChat();
  // JSON escaping can expand each of the bounded UTF-16 code units sixfold.
  if (raw.length > 16000000) throw new Error("invalid_chat");
  const v: unknown = JSON.parse(raw);
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("invalid_chat");
  const c = v as Record<string, unknown>;
  if (typeof c.open !== "boolean" || typeof c.draft !== "string" || c.draft.length > 2000 || !Array.isArray(c.messages)) throw new Error("invalid_chat");
  if (c.version === 1) {
    if (Object.keys(c).length !== 4 || c.messages.length > 50 || c.messages.some(m => typeof m !== "string" || !m.trim() || m.length > 2000)) throw new Error("invalid_chat");
    return { ...emptyChat(), open: c.open, draft: c.draft, messages: c.messages.map(text => ({ role: "user", text })) };
  }
  if (c.version !== 2 || Object.keys(c).filter(key => key !== "activeCalculationId").sort().join() !== "draft,messages,open,recentProfiles,version" || c.messages.length > 1000
    || (c.activeCalculationId !== undefined && c.activeCalculationId !== null && (typeof c.activeCalculationId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(c.activeCalculationId)))
    || !Array.isArray(c.recentProfiles) || c.recentProfiles.length > 8 || c.recentProfiles.some(id => typeof id !== "string" || id.length > 120)
    || c.messages.some(m => !m || typeof m !== "object" || Array.isArray(m) || !["user", "assistant"].includes(m.role)
      || typeof m.text !== "string" || !m.text.trim() || m.text.length > 2000 || (m.context !== undefined && (typeof m.context !== "string" || m.context.length > 600))
      || Object.keys(m).some(k => !["role", "text", "context"].includes(k)))) throw new Error("invalid_chat");
  return c as LocalChat;
}

export class LocalChatStore {
  constructor(private readonly storageKey = CHAT_KEY) {}
  private state = { chat: emptyChat(), error: false, ready: false };
  private listeners = new Set<() => void>();
  private storage: Pick<Storage, "getItem" | "setItem"> | null = null;
  subscribe = (callback: () => void) => { this.listeners.add(callback); return () => { this.listeners.delete(callback); }; };
  getSnapshot = () => this.state;
  private emit() { this.listeners.forEach(callback => callback()); }
  load(storage: Pick<Storage, "getItem" | "setItem"> | null) {
    if (this.state.ready) return;
    this.storage = storage;
    try { if (!storage) throw new Error("storage_unavailable"); this.state = { chat: readChat(storage.getItem(this.storageKey)), error: false, ready: true }; }
    catch { this.state = { ...this.state, error: true, ready: true }; }
    this.emit();
  }
  update = (change: (chat: LocalChat) => LocalChat) => {
    const chat = readChat(JSON.stringify(change(this.state.chat)));
    let error = this.state.error;
    if (!error) { try { if (!this.storage) throw new Error("storage_unavailable"); this.storage.setItem(this.storageKey, JSON.stringify(chat)); } catch { error = true; } }
    this.state = { chat, error, ready: true }; this.emit();
  };
}
