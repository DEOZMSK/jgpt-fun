export const OPEN_WORKSPACE_CHAT = "global-open-chat";
export const CHAT_DRAFT_LIMIT = 2000;
export type OpenWorkspaceChatDetail = { question: string };

/** Preserve the whole draft when a contextual question cannot fit. */
export function appendChatQuestion(draft: string, question: string) {
  const combined = draft ? `${draft}\n\n${question}` : question;
  return combined.length <= CHAT_DRAFT_LIMIT
    ? { draft: combined, overflow: false }
    : { draft, overflow: true };
}

export function discussInWorkspace(question: string) {
  window.dispatchEvent(new CustomEvent<OpenWorkspaceChatDetail>(OPEN_WORKSPACE_CHAT, { detail: { question } }));
}
