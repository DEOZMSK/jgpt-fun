/** Observed reference navigation. Availability never implies implemented calculation rules. */
export const CHART_PANELS = ["useful", "transits", "panchanga", "karakas", "arudhas", "readings", "sade-sati", "vargas", "ashtakavarga", "planet-charts", "sign-charts", "indu-lagna", "periods", "navamsha-dasha", "chara-dasha", "month-panchanga", "year-transits", "lunar-forecast", "aspects"] as const;
export type ChartPanel = typeof CHART_PANELS[number];
// Retained only so old local documents can be read without losing chart snapshots.
export const RETIRED_CHART_PANELS: readonly ChartPanel[] = ["useful", "planet-charts", "sign-charts", "indu-lagna"];
export type ToolItem = { panel: ChartPanel; en: string; ru: string };
export const ANALYSIS_TOOLS: readonly ToolItem[] = [
  { panel: "panchanga", en: "Birth panchanga", ru: "Панчанга рождения" },
  { panel: "karakas", en: "Karaka analysis", ru: "Анализ карак" },
  { panel: "arudhas", en: "Arudha analysis", ru: "Анализ арудх" },
  { panel: "readings", en: "Position readings", ru: "Прочтение положений" },
  { panel: "sade-sati", en: "Sade Sati", ru: "Саде Сати" },
];
export const OTHER_VARGAS: readonly ToolItem[] = [
  { panel: "planet-charts", en: "Planet charts", ru: "Карты планет" },
  { panel: "sign-charts", en: "Sign charts", ru: "Карты знаков" },
  { panel: "indu-lagna", en: "Indu Lagna", ru: "Инду Лагна" },
];
export const FORECAST_TOOLS: readonly ToolItem[] = [
  { panel: "month-panchanga", en: "Monthly panchanga", ru: "Панчанга на месяц" },
  { panel: "year-transits", en: "Yearly transits", ru: "Транзиты на год" },
  { panel: "lunar-forecast", en: "Lunar forecast", ru: "Лунный прогноз" },
];
export const VARGA_CATALOG = [
  [2, "Hora", "Хора"], [3, "Drekkana", "Дреккана"], [4, "Chaturthamsha", "Чатуртамша"],
  [5, "Panchamsha", "Панчамша"], [6, "Shashthamsha", "Шаштамша"], [7, "Saptamsha", "Саптамша"],
  [8, "Ashtamsha", "Аштамша"], [9, "Navamsha", "Навамша"], [10, "Dashamsha", "Дашамша"],
  [11, "Ekadashamsha", "Экадашамша"], [12, "Dwadashamsha", "Двадашамша"], [16, "Shodashamsha", "Шодашамша"],
  [20, "Vimshamsha", "Вимшамша"], [24, "Chaturvimshamsha", "Чатурвимшамша"], [27, "Saptavimshamsha", "Саптавимшамша"],
  [30, "Trimshamsha", "Тримшамша"], [40, "Khavedamsha", "Кхаведамша"], [45, "Akshayavedamsha", "Акшаяведамша"], [60, "Shashtyamsha", "Шаштьямша"],
] as const;
