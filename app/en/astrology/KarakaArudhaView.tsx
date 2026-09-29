"use client";
import { SIGNS, VARGAS, type AstrologyCalculation } from "../../../lib/astrology/contracts";
import { bhavaArudhas, charaKarakas, grahaArudhas, type ArudhaSelection, type GrahaStrengthRule } from "../../../lib/astrology/karakas-arudhas";
import { astrologyName, type AstrologyLocale } from "../../../lib/astrology/workspace-copy";
import type { WorkspaceAction } from "../../../lib/local-workspace/controller";
import styles from "./workspace.module.css";
import { TermHint, karakaHint } from "./TermHint";

const ROLE_NAMES = {
  AK: ["Atma", "Атма"], AmK: ["Amatya", "Аматья"], BK: ["Bhratri", "Бхратри"], MK: ["Matri", "Матри"],
  PiK: ["Pitri", "Питри"], PK: ["Putra", "Путра"], GK: ["Jnati", "Гнати"], DK: ["Dara", "Дара"]
} as const;
const STRENGTH_NAMES: Record<GrahaStrengthRule, readonly [string, string]> = {
  "single-sign": ["One owned sign", "Единственный знак"],
  occupants: ["More planets in the sign", "Больше планет в знаке"],
  "rashi-support": ["Jupiter, Mercury and owner support", "Поддержка Юпитера, Меркурия и управителя"],
  "exalted-occupant": ["Exalted planet in the sign", "Экзальтированная планета в знаке"],
  "lord-oddity": ["Owner in a sign of opposite parity", "Управитель в знаке другой чётности"]
};
type Props = { result: AstrologyCalculation | null; locale: AstrologyLocale };
const degrees = (value: number) => `${value.toFixed(6)}°`;

export function KarakaView({ result, locale }: Props) {
  const t = (en: string, ru: string) => locale === "ru" ? ru : en, n = (value: string) => astrologyName(value, locale);
  const facts = result ? charaKarakas(result.charts.D1) : null;
  return <section aria-label={t("Calculated karakas", "Расчёт карак")}><h2>{t("Chara karakas", "Чара-караки")}</h2>
    <p className={styles.hint}>{t("Eight karakas · natal D1 · Rahu counted from the end of its sign. Ketu is excluded.", "Восемь карак · натальная D1 · Раху отсчитывается от конца знака. Кету не участвует.")}</p>
    {!facts ? <p>{t("Open or calculate a chart first.", "Сначала открой или рассчитай карту.")}</p> : <>
      <div className={styles.aspectScroll} tabIndex={0} role="region" aria-label={t("Karaka ranks", "Ранги карак")}><table className={styles.aspectTable}>
        <caption>{t("Chara karakas · D1", "Чара-караки · D1")}</caption>
        <thead><tr><th scope="col">{t("Karaka", "Карака")}</th><th scope="col">{t("Planet", "Планета")}</th><th scope="col">{t("Natal position", "Натальное положение")}</th><th scope="col">{t("Ranked advancement", "Отсчёт для ранжирования")}</th></tr></thead>
        <tbody>{facts.rows.map(row => <tr key={row.ref} data-karaka-ref={row.ref}><th scope="row"><TermHint text={karakaHint(row.role, locale)}>{row.role}</TermHint><small>{t(ROLE_NAMES[row.role][0], ROLE_NAMES[row.role][1])}</small></th>
          <td>{row.planets.map(p => n(p.name)).join(" / ") || t("Vacant after a tie", "Свободна после равенства")}{row.status === "shared" && <small>{t("Shared rank", "Совместный ранг")}</small>}</td>
          <td>{row.planets.map(p => <div key={p.name}>{n(SIGNS[p.sign])} {degrees(p.longitude - p.sign * 30)}</div>)}</td>
          <td>{row.planets.map(p => <div key={p.name}>{degrees(p.advancement)}</div>)}</td></tr>)}</tbody>
      </table></div>
      {facts.requiresSthiraResolution && <p role="status">{t("Equal advancement shares a karaka and leaves the following rank vacant. A replacement sthira karaka is not assigned automatically.", "При равном отсчёте планеты делят караку, а следующий ранг остаётся свободным. Замена стхира-каракой автоматически не назначается.")}</p>}
      <p className={styles.hint}>{t("Ranks use full saved precision; displayed decimals are rounded. Selecting a divisional chart or dasha does not change natal ranks. These are significator assignments, not Chara Dasha periods.", "Ранги используют полную сохранённую точность; десятичные значения на экране округлены. Выбор варги или даши не меняет натальные ранги. Здесь определяются сигнификаторы, а не периоды Чара Даши.")}</p>
    </>}
  </section>;
}

export function ArudhaView({ result, selection, locale, act }: Props & { selection: ArudhaSelection; act: (action: WorkspaceAction) => void }) {
  const t = (en: string, ru: string) => locale === "ru" ? ru : en, n = (value: string) => astrologyName(value, locale);
  const chart = result?.charts[selection.varga], facts = chart ? bhavaArudhas(chart, selection) : null;
  const grahas = chart ? grahaArudhas(chart, selection.varga) : null;
  return <section aria-label={t("Calculated arudhas", "Расчёт арудх")}><h2>{t("Arudhas", "Арудхи")}</h2>
    <div className={styles.monthForm}><label className={styles.field}><span>{t("Arudha chart", "Карта для арудх")}</span><select value={selection.varga} disabled={!result} onChange={e => act({ type: "select-arudhas", selection: { ...selection, varga: e.target.value as ArudhaSelection["varga"] } })}>{VARGAS.map(varga => <option key={varga} value={varga} disabled={!result?.charts[varga]}>{varga}</option>)}</select></label></div>
    {!facts ? <p>{result ? t("This saved result does not contain that chart. Choose an available chart.", "В сохранённом результате нет этой карты. Выбери доступную.") : t("Open or calculate a chart first.", "Сначала открой или рассчитай карту.")}</p> : <>
      <p className={styles.hint}>{selection.varga} · {t("Whole-sign houses. Scorpio and Aquarius use Rao's co-lord rules.", "Дома по целым знакам. Для Скорпиона и Водолея действуют правила соуправителей Рао.")}</p>
      <p>{facts.coLords.map(row => `${n(row.sign)}: ${row.candidates.map(n).join(" / ")}`).join(" · ")}</p>
      {facts.coLordResolution !== "unique" && <p role="status">{t("The co-lord rules do not give a unique choice for this chart. All remaining alternatives are shown; none is selected silently.", "Правила соуправителей не дают единственного выбора для этой карты. Показаны оставшиеся варианты без скрытого выбора одного из них.")}</p>}
      <div className={styles.aspectScroll} tabIndex={0} role="region" aria-label={t("Arudha positions", "Положения арудх")}><table className={styles.aspectTable}>
        <caption>{selection.varga} · {t("Bhava arudhas", "Бхава-арудхи")}</caption>
        <thead><tr><th scope="col">{t("Pada / house", "Пада / дом")}</th><th scope="col">{t("Source sign", "Исходный знак")}</th><th scope="col">{t("Lord / count", "Управитель / отсчёт")}</th><th scope="col">{t("Arudha sign", "Знак арудхи")}</th></tr></thead>
        <tbody>{facts.rows.map(row => <tr key={row.ref} data-arudha-ref={row.ref}><th scope="row">{row.label}<small>{t("House", "Дом")} {row.house}</small></th><td>{n(SIGNS[row.sourceSign])}</td>
          <td>{row.options.map(option => <div key={option.lord}>{n(option.lord)} · {n(SIGNS[option.lordSign])} · {option.count}</div>)}</td>
          <td>{row.options.map(option => <div key={option.lord}>{n(SIGNS[option.sign])}{option.exception && <small>{t("Exception", "Исключение")}: {option.exception === "first" ? "1" : "7"} → 10</small>}</div>)}</td></tr>)}</tbody>
      </table></div>
      <p className={styles.hint}>{t("Count forward to the lord and repeat that count from the lord. If the provisional result is the 1st or 7th from the source, take the 10th from that result. AL = A1; UL = A12.", "Отсчёт идёт вперёд до управителя и повторяется от него. Если промежуточный результат попал в 1-й или 7-й знак от исходного, берётся 10-й от этого результата. AL = A1; UL = A12.")}</p>
      {grahas && <section aria-label={t("Graha arudhas", "Граха-арудхи")}>
        <h3>{t("Graha arudhas", "Граха-арудхи")}</h3>
        <p className={styles.hint}>{t("Nine planets · Rao's owned-sign strength rules · the selected saved chart.", "Девять планет · правила силы собственных знаков Рао · выбранная сохранённая карта.")}</p>
        <div className={styles.aspectScroll} tabIndex={0} role="region" aria-label={t("Planetary arudha positions", "Положения граха-арудх")}><table className={styles.aspectTable}>
          <caption>{selection.varga} · {t("Graha arudhas", "Граха-арудхи")}</caption>
          <thead><tr><th scope="col">{t("Planet / position", "Планета / положение")}</th><th scope="col">{t("Owned sign / choice", "Собственный знак / выбор")}</th><th scope="col">{t("Count", "Отсчёт")}</th><th scope="col">{t("Arudha sign", "Знак арудхи")}</th></tr></thead>
          <tbody>{grahas.rows.map(row => <tr key={row.ref} data-graha-arudha-ref={row.ref}>
            <th scope="row">{n(row.planet)}<small>{n(SIGNS[row.sourceSign])}</small></th>
            <td>{n(SIGNS[row.selectedOwnedSign])}<small>{t(...STRENGTH_NAMES[row.strength.rule])}</small>
              {row.strength.checks.length > 0 && <details><summary>{t("Comparison", "Сравнение")}</summary>
                <p className={styles.hint}>{row.ownedSigns.map(sign => n(SIGNS[sign])).join(" / ")}</p>
                <ul>{row.strength.checks.map(check => <li key={check.rule}>{t(...STRENGTH_NAMES[check.rule])}: {check.scores.join(" / ")}</li>)}</ul>
              </details>}
            </td>
            <td>{row.count}</td><td>{n(SIGNS[row.sign])}{row.exception && <small>{t("Exception", "Исключение")}: {row.exception === "first" ? "1" : "7"} → 10</small>}</td>
          </tr>)}</tbody>
        </table></div>
        <details><summary>{t("How planetary arudhas are calculated", "Как рассчитаны граха-арудхи")}</summary>
          <p>{t("Count forward from the planet to its stronger owned sign, then repeat the count from that sign. Apply the same first/seventh exception as above. Rahu owns Aquarius and Ketu owns Scorpio in this method.", "От планеты отсчитываются знаки вперёд до её более сильного собственного знака, затем отсчёт повторяется от него. Применяется то же исключение для первого и седьмого результата. В этом методе Раху управляет Водолеем, Кету — Скорпионом.")}</p>
          <p>{t("For a two-sign planet, compare occupants, then sign aspects or occupation by Jupiter, Mercury and the planet itself, then an exalted occupant, then the owner's opposite sign parity. Stop at the first difference. Repeated support roles count separately. Node exaltations here use Gemini/Sagittarius.", "Для планеты с двумя знаками сравниваются число планет, затем раши-аспекты или присутствие Юпитера, Меркурия и самой планеты, затем наличие экзальтированной планеты и другая чётность знака управителя. Выбор делается по первому различию. Повторяющиеся роли поддержки считаются отдельно. Экзальтация узлов здесь принята в Близнецах/Стрельце.")}</p>
          <p>{t("The planet itself is the owner in this comparison; the bhava co-lord choice does not replace it. This is a sign-selection rule, not a full planetary strength score.", "В этом сравнении управителем служит сама планета; выбор соуправителя для бхава-арудх её не заменяет. Это правило выбора знака, а не общий балл силы планеты.")}</p>
          <a href="https://www.vedicastrologer.org/articles/vedic_astro_textbook.pdf#page=106" target="_blank" rel="noopener noreferrer">{t("Source: Rao, sections 9.5 and 15.5.2", "Источник: Рао, разделы 9.5 и 15.5.2")}</a>
        </details>
      </section>}
      {selection.varga !== "D1" && <p className={styles.hint}>{t("Divisional positions are symbolic. These arudhas are derived from the selected saved varga, not physical sky longitudes.", "Положения варг символические. Арудхи получены из выбранной сохранённой варги, а не из физических долгот на небе.")}</p>}
    </>}
  </section>;
}
