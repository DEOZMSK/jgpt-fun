import { VARGAS, type Varga } from "../astrology/contracts";
import type { SiteLocale } from "../site-locale";
import type { WorkspaceAssistantContext } from "./assistant-context";
import { emptyDraft, fail, isDraft, type BirthDraft } from "./model";

export type AssistantIntent =
  | { type: "new-chart" | "show-rashi" }
  | { type: "show-transits"; enabled: boolean }
  | { type: "create-profile" | "fill-draft"; fields: Partial<BirthDraft> }
  | { type: "select-profile"; profile: string }
  | { type: "create-folder"; name: string }
  | { type: "rename-folder"; folder: string; name: string }
  | { type: "move-profile" | "move-all"; folder: string }
  | { type: "open-calculation"; id: string }
  | { type: "calculate"; kind: "astrology" }
  | { type: "select-varga"; varga: Varga }
  | { type: "select-dasha-system"; system: "vimshottari" | "yogini" }
  | { type: "open-period"; lords: string[]; start?: string }
  | { type: "save-profile" | "save-calculation" | "show-context" | "help" };
export interface WorkspaceAssistantAdapter {
  readonly mode: "scripted";
  propose(input: { text: string; locale: SiteLocale; context: WorkspaceAssistantContext }, signal: AbortSignal): Promise<unknown>;
}
const short = (v: unknown, max = 120): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v);
export function validateAssistantIntent(value: unknown): AssistantIntent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail("invalid_action");
  const v = value as Record<string, unknown>;
  const keys = (...expected: string[]) => Object.keys(v).sort().join() === ["type", ...expected].sort().join();
  switch (v.type) {
    case "new-chart": case "show-rashi": if (!keys()) return fail("invalid_action"); break;
    case "show-transits": if (!keys("enabled") || typeof v.enabled !== "boolean") return fail("invalid_action"); break;
    case "create-profile": case "fill-draft":
      if (!keys("fields") || !v.fields || typeof v.fields !== "object" || Array.isArray(v.fields)
        || !Object.keys(v.fields).length || Object.hasOwn(v.fields, "folderId") || !isDraft({ ...emptyDraft(), ...v.fields })) return fail("invalid_action"); break;
    case "select-profile": if (!keys("profile") || !short(v.profile)) return fail("invalid_action"); break;
    case "create-folder": if (!keys("name") || !short(v.name)) return fail("invalid_action"); break;
    case "rename-folder": if (!keys("folder", "name") || !short(v.folder) || !short(v.name)) return fail("invalid_action"); break;
    case "move-profile": case "move-all": if (!keys("folder") || !short(v.folder)) return fail("invalid_action"); break;
    case "open-calculation": if (!keys("id") || !short(v.id)) return fail("invalid_action"); break;
    case "calculate": if (!keys("kind") || v.kind !== "astrology") return fail("invalid_action"); break;
    case "select-varga": if (!keys("varga") || !(VARGAS as readonly string[]).includes(v.varga as string)) return fail("invalid_action"); break;
    case "select-dasha-system": if (!keys("system") || !["vimshottari", "yogini"].includes(v.system as string)) return fail("invalid_action"); break;
    case "open-period": if (!(v.start === undefined ? keys("lords") : keys("lords", "start") && typeof v.start === "string" && /^\d{4}-\d\d-\d\d$/.test(v.start)) || !Array.isArray(v.lords) || v.lords.length < 1 || v.lords.length > 4 || !v.lords.every(l => typeof l === "string" && ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"].includes(l))) return fail("invalid_action"); break;
    case "save-profile": case "save-calculation": case "show-context": case "help": if (!keys()) return fail("invalid_action"); break;
    default: return fail("unsupported_command");
  }
  return structuredClone(value) as AssistantIntent;
}

const fieldNames: Record<string, keyof BirthDraft> = { name: "name", "имя": "name", date: "date", "дата": "date", time: "time", "время": "time",
  place: "place", "место": "place", timezone: "timezone", "пояс": "timezone", latitude: "latitude", "широта": "latitude", longitude: "longitude", "долгота": "longitude",
  accuracy: "accuracy", "точность": "accuracy", nodes: "nodes", "узлы": "nodes", offset: "utcOffsetMinutes", "смещение": "utcOffsetMinutes" };
function fields(text: string): Partial<BirthDraft> {
  const result: Record<string, string> = {};
  if (!text.trim()) return result;
  for (const part of text.split(";")) {
    if (!part.trim()) continue;
    const match = /^\s*([^=]+)=([^=;]*)$/.exec(part);
    const key = match && fieldNames[match[1].trim().toLowerCase()];
    if (!match || !key || Object.hasOwn(result, key)) return fail("invalid_fields");
    result[key] = match[2].trim();
  }
  return result as Partial<BirthDraft>;
}
const planetNames: Record<string, string> = { sun: "Sun", "солнце": "Sun", moon: "Moon", "луна": "Moon", mars: "Mars", "марс": "Mars", mercury: "Mercury", "меркурий": "Mercury", jupiter: "Jupiter", "юпитер": "Jupiter", venus: "Venus", "венера": "Venus", saturn: "Saturn", "сатурн": "Saturn", rahu: "Rahu", "раху": "Rahu", ketu: "Ketu", "кету": "Ketu" };

/** Deliberately limited grammar: no semantic model, code execution or context instructions. */
export class ScriptedWorkspaceAdapter implements WorkspaceAssistantAdapter {
  readonly mode = "scripted" as const;
  async propose({ text }: { text: string; locale: SiteLocale; context: WorkspaceAssistantContext }, signal: AbortSignal) {
    if (signal.aborted) return fail("assistant_cancelled");
    if (typeof text !== "string" || text.length > 1600) return fail("unsupported_command");
    const value = text.trim(); let match: RegExpExecArray | null;
    if (/^(?:построить|построй|создать|создай|новая) (?:новую )?карт[ау]$|^(?:build|create|new)(?: a)?(?: new)? chart$/i.test(value)) return { type: "new-chart" };
    if (/^(?:покажи|открой|показать|show|open) (?:(?:rashi|rasi|раши|раси)(?:\s*(?:\+|и|and|вместе с)\s*D9)?|D1\s*(?:\+|и|and|вместе с)\s*D9)$/i.test(value)) return { type: "show-rashi" };
    if (/^(?:покажи|отобрази|включи|показать|включить|show|enable) (?:транзиты|transits)(?: (?:на|on) (?:rashi|rasi|раши|раси|D1))?$/i.test(value)) return { type: "show-transits", enabled: true };
    if (/^(?:убери|скрой|выключи|выключить|hide|disable) (?:транзиты|transits)(?: (?:на|с|on) (?:rashi|rasi|раши|раси|D1))?$/i.test(value)) return { type: "show-transits", enabled: false };
    if ((match = /^(?:open|show|открой|покажи|показать) (D\d{1,3})$/i.exec(value))) return validateAssistantIntent({ type: "select-varga", varga: match[1].toUpperCase() });
    if ((match = /^(?:open|show|открой|покажи|показать) (Yogini|Йогини|Vimshottari|Вимшоттари|даши)(?: (?:даша|дашу|даши|dasha))?$/i.exec(value))) return { type: "select-dasha-system", system: /^(Yogini|Йогини)$/i.test(match[1]) ? "yogini" : "vimshottari" };
    if (/^(?:что открыто|что сейчас открыто|покажи контекст|show context|what is open)$/i.test(value)) return { type: "show-context" };
    if (/^(?:помощь|справка|команды|что ты умеешь|help|commands)$/i.test(value)) return { type: "help" };
    if ((match = /^(?:create profile|создай профиль) "([^";]+)"(.*)$/i.exec(value))) {
      if (match[2] && !match[2].trimStart().startsWith(";")) return fail("invalid_fields");
      const supplied = fields(match[2]);
      if (Object.hasOwn(supplied, "name")) return fail("invalid_fields");
      return validateAssistantIntent({ type: "create-profile", fields: { name: match[1], ...supplied } });
    }
    if ((match = /^(?:fill draft|заполни черновик)(;.*)$/i.exec(value))) return validateAssistantIntent({ type: "fill-draft", fields: fields(match[1]) });
    if ((match = /^(?:select profile|выбери профиль) "([^"]+)"$/i.exec(value))) return validateAssistantIntent({ type: "select-profile", profile: match[1] });
    if ((match = /^(?:create folder|создай папку) "([^"]+)"$/i.exec(value))) return validateAssistantIntent({ type: "create-folder", name: match[1] });
    if ((match = /^(?:rename folder|переименуй папку) "([^"]+)" (?:to|в) "([^"]+)"$/i.exec(value))) return validateAssistantIntent({ type: "rename-folder", folder: match[1], name: match[2] });
    if ((match = /^(?:move to|положи в) "([^"]+)"$/i.exec(value))) return validateAssistantIntent({ type: "move-profile", folder: match[1] });
    if ((match = /^(?:move all to|перемести всех в) "([^"]+)"$/i.exec(value))) return validateAssistantIntent({ type: "move-all", folder: match[1] });
    if ((match = /^(?:open calculation|открой расчёт) "([^"]+)"$/i.exec(value))) return validateAssistantIntent({ type: "open-calculation", id: match[1] });
    if (/^(?:open latest calculation|открой последний расчёт)$/i.test(value)) return { type: "open-calculation", id: "latest" };
    if (/^(?:calculate astrology|рассчитай карту)$/i.test(value)) return { type: "calculate", kind: "astrology" };
    if (/^(?:save profile|сохрани профиль)$/i.test(value)) return { type: "save-profile" };
    if (/^(?:save result|сохрани результат)$/i.test(value)) return { type: "save-calculation" };
    if ((match = /^(?:open|открой) (D\d{1,2})$/i.exec(value))) return validateAssistantIntent({ type: "select-varga", varga: match[1].toUpperCase() });
    if ((match = /^(?:open|открой) (Yogini|Йогини|Vimshottari|Вимшоттари)$/i.exec(value))) return { type: "select-dasha-system", system: /^(Yogini|Йогини)$/i.test(match[1]) ? "yogini" : "vimshottari" };
    if ((match = /^(?:show period|покажи период) ([^;]+)(?:; start=(\d{4}-\d\d-\d\d))?$/i.exec(value))) return validateAssistantIntent({ type: "open-period", lords: match[1].split("/").map(l => planetNames[l.trim().toLowerCase()]), ...(match[2] ? { start: match[2] } : {}) });
    if (/^(?:show context|покажи контекст)$/i.test(value)) return { type: "show-context" };
    if (/^(?:help|помощь)$/i.test(value)) return { type: "help" };
  if (/^(?:find articles|open article|найди статьи|открой статью)(?:\s|$)/i.test(value)) return fail("unsupported_command");
    if ((match = /^(?:открой|найди|выбери|open|find|select)(?: (?:карту|профиль|chart|profile))?\s+(.+)$/i.exec(value))) return validateAssistantIntent({ type: "select-profile", profile: match[1].replace(/^["«]|["»]$/g, "") });
    return fail("unsupported_command");
  }
}
