import type { AstrologyCalculation, DashaSystem } from "../../../lib/astrology/contracts";
import { GEOMETRIC_DASHA_CONVENTIONS } from "../../../lib/astrology/dasha";
import { astrologyName, type AstrologyLocale } from "../../../lib/astrology/workspace-copy";
import styles from "./workspace.module.css";

export function CalculationProfiles({ result, locale }: { result: AstrologyCalculation | null; locale: AstrologyLocale }) {
  const t = (en: string, ru: string) => locale === "ru" ? ru : en;
  const split = !result || "dashaBasis" in result;
  const geometric = !result || ("dashaBasis" in result && "positionKind" in result.dashaBasis);
  return <section><h3>{result ? t("This snapshot's methods", "Методы этого снимка") : t("Methods for new calculations", "Методы новых расчётов")}</h3>
    <dl className={styles.facts}><div><dt>{t("Natal and divisional charts", "Натальная и дробные карты")}</dt><dd>Lahiri · {t("whole-sign houses", "цельнознаковые дома")}</dd></div>
      {(["vimshottari", "yogini"] as const).map(system => <div key={system}><dt>{system === "vimshottari" ? t("Vimshottari", "Вимшоттари") : t("Yogini", "Йогини")}</dt><dd>{split ? "Swiss True Pushya" : "Lahiri"} · {geometric ? t("geometric Moon", "геометрическая Луна") : t("apparent Moon", "видимая Луна")} · {result && "dashas" in result ? result.dashas[system].yearDays : result ? result.settings.yearDays : GEOMETRIC_DASHA_CONVENTIONS[system].yearDays} {t("days per year", "суток в году")}</dd></div>)}
    </dl>
    {(!result || ("formatVersion" in result && result.formatVersion >= 4)) && <p className={styles.hint}>{t("20 charts. D2: Sun/Leo, Moon/Cancer; D30: degree-unit longitudes. Other reference variants may differ.", "20 карт. D2: Солнце/Лев, Луна/Рак; D30: долготы по отдельным градусам. Другие варианты эталонов могут отличаться.")}</p>}
    {geometric ? <p className={styles.hint}>{t("Vimshottari uses JHora's geometric Moon and civil-UT convention. One reference agrees within 12 seconds; broader verification is pending. Yogini shares this Moon, but its year and other JHora options remain unverified.", "Вимшоттари использует геометрическую Луну и отсчёт времени JHora. На одном примере расхождение не превышает 12 секунд; нужны дополнительные проверки. Йогини использует ту же Луну, но её год и другие настройки JHora ещё не сверены.")}</p>
      : split ? <p className={styles.hint}>{t("Earlier snapshot: apparent Swiss True Pushya Moon. Original numbers are preserved; use Update calculation to apply the geometric dasha method.", "Прежний снимок: видимая Луна Swiss True Pushya. Исходные числа сохранены; «Обновить расчёт» применит геометрический метод даш.")}</p>
      : <p className={styles.hint}>{t("Earlier snapshot: original numbers are preserved. Separate profiles require an explicit new calculation.", "Прежний снимок: исходные числа сохранены. Для раздельных профилей выполни новый расчёт явно.")}</p>}
  </section>;
}

export function DashaBasisDetails({ result, system, locale }: { result: AstrologyCalculation; system: DashaSystem; locale: AstrologyLocale }) {
  const t = (en: string, ru: string) => locale === "ru" ? ru : en;
  const basis = "dashaBasis" in result ? result.dashaBasis : result.planets.find(p => p.name === "Moon")!;
  const dasha = "dashas" in result ? result.dashas[system] : null;
  return <details className={styles.details}><summary>{t("Dasha calculation basis", "Основа расчёта даш")}</summary>
    <p>{"dashaBasis" in result ? result.dashaBasis.ayanamsha : "Lahiri"} · {t("Moon", "Луна")} {basis.longitude.toFixed(8)}° · {astrologyName(basis.nakshatra, locale)} / {basis.pada}</p>
    <p>{dasha?.yearDays ?? result.settings.yearDays} {t("days per year", "суток в году")} · <code>{dasha?.basisRef ?? "natal/Moon"}</code></p>
    {"dashaBasis" in result && <p>{t("Ayanamsha", "Аянамша")}: {result.dashaBasis.ayanamshaDegrees.toFixed(8)}° · <code>{result.dashaBasis.method}</code></p>}
    {"dashaBasis" in result && "time" in result.dashaBasis && <p>{t("Geometric geocentric Moon. Birth civil time is treated as UT; Delta T is applied once. Natal charts keep their separate UTC conversion.", "Геометрическая геоцентрическая Луна. Гражданское время рождения принято за UT; поправка Delta T применена один раз. Натальные карты используют отдельное преобразование UTC.")}</p>}
  </details>;
}
