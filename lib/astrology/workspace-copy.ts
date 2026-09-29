import { NAKSHATRAS, SIGNS } from "./contracts";

export type AstrologyLocale = "en" | "ru";
const russianNames: Record<string, string> = {
  Pratipada: "Пратипада", Dwitiya: "Двития", Tritiya: "Трития", Chaturthi: "Чатуртхи", Panchami: "Панчами", Shashthi: "Шаштхи", Saptami: "Саптами", Ashtami: "Аштами", Navami: "Навами", Dashami: "Дашами", Ekadashi: "Экадаши", Dwadashi: "Двадаши", Trayodashi: "Трайодаши", Chaturdashi: "Чатурдаши", Purnima: "Пурнима", Amavasya: "Амавасья",
  Nanda: "Нанда", Bhadra: "Бхадра", Jaya: "Джая", Rikta: "Рикта", Purna: "Пурна",
  Vidhata: "Видхата", Subrahmanya: "Субрахманья", Sarpa: "Сарпа", Dharma: "Дхарма", Savita: "Савита", Manmatha: "Манматха", Kali: "Кали", Pitrs: "Питри", Ashvins: "Ашвины", Vayu: "Ваю", Nirriti: "Ниррити", Apas: "Апас", Dhata: "Дхата", Bhumi: "Бхуми", Ganesha: "Ганеша", Kubera: "Кубера", Shadanana: "Шаданана", Savitri: "Савитри", Kamala: "Камала", Gauri: "Гаури", Lakshmi: "Лакшми", Vrisha: "Вриша",
  Rudra: "Рудра", Uraga: "Урага", Mitra: "Митра", Pitara: "Питара", Vasu: "Васу", Ambu: "Амбу", Vishwedeva: "Вишведева", Vidhi: "Видхи", Indragni: "Индрагни", Daitya: "Дайтья", Varuna: "Варуна", Aryama: "Арьяма", Bhaga: "Бхага",
  Ishwara: "Ишвара", Ajaikapada: "Аджайкапада", Ahirbudhnya: "Ахирбудхнья", Pusha: "Пуша", Yama: "Яма", Agni: "Агни", Chandra: "Чандра", Aditi: "Адити", Brihaspati: "Брихаспати", Vishnu: "Вишну", Surya: "Сурья", Tvashta: "Твашта", Samirana: "Самирана",
  Sun: "Солнце", Moon: "Луна", Mars: "Марс", Mercury: "Меркурий", Jupiter: "Юпитер", Venus: "Венера", Saturn: "Сатурн", Rahu: "Раху", Ketu: "Кету",
  Monday: "понедельник", Tuesday: "вторник", Wednesday: "среда", Thursday: "четверг", Friday: "пятница", Saturday: "суббота", Sunday: "воскресенье",
  Shukla: "Шукла", Krishna: "Кришна", Rashi: "Раши", Navamsha: "Навамша", Dashamsha: "Дашамша",
  Mahadasha: "Махадаша", Antardasha: "Антардаша", Pratyantardasha: "Пратьянтардаша", Sukshmadasha: "Сукшмадаша",
  Vishkambha: "Вишкамбха", Priti: "Прити", Ayushman: "Аюшман", Saubhagya: "Саубхагья", Shobhana: "Шобхана", Atiganda: "Атиганда", Sukarma: "Сукарма", Dhriti: "Дхрити", Shula: "Шула", Ganda: "Ганда", Vriddhi: "Вриддхи", Dhruva: "Дхрува", Vyaghata: "Вьягхата", Harshana: "Харшана", Vajra: "Ваджра", Siddhi: "Сиддхи", Vyatipata: "Вьятипата", Variyana: "Варияна", Parigha: "Паригха", Shiva: "Шива", Siddha: "Сиддха", Sadhya: "Садхья", Shubha: "Шубха", Brahma: "Брахма", Indra: "Индра", Vaidhriti: "Вайдхрити",
  Bava: "Бава", Balava: "Балава", Kaulava: "Каулава", Taitila: "Тайтила", Garaja: "Гараджа", Vanija: "Ваниджа", Vishti: "Вишти", Kimstughna: "Кимстугхна", Shakuni: "Шакуни", Chatushpada: "Чатушпада", Naga: "Нага"
};
const russianSigns = ["Овен", "Телец", "Близнецы", "Рак", "Лев", "Дева", "Весы", "Скорпион", "Стрелец", "Козерог", "Водолей", "Рыбы"];
const russianNakshatras = ["Ашвини", "Бхарани", "Криттика", "Рохини", "Мригашира", "Ардра", "Пунарвасу", "Пушья", "Ашлеша", "Магха", "Пурва Пхалгуни", "Уттара Пхалгуни", "Хаста", "Читра", "Свати", "Вишакха", "Анурадха", "Джйештха", "Мула", "Пурва Ашадха", "Уттара Ашадха", "Шравана", "Дхаништха", "Шатабхиша", "Пурва Бхадрапада", "Уттара Бхадрапада", "Ревати"];
SIGNS.forEach((name, index) => { russianNames[name] = russianSigns[index]; });
NAKSHATRAS.forEach((name, index) => { russianNames[name] = russianNakshatras[index]; });

export function astrologyName(name: string, locale: AstrologyLocale) {
  return locale === "ru" ? russianNames[name] ?? name : name;
}

const russianErrors: Record<string, string> = {
  invalid_input: "Проверь данные рождения.", uncertain_time: "Для этой версии нужно точное время рождения. Приблизительное и неизвестное время требуют отдельного анализа погрешности.",
  invalid_date: "Укажи корректную дату между 1900 и 2100 годами.", invalid_time: "Укажи местное время рождения в формате ЧЧ:ММ.", invalid_timezone: "Укажи часовой пояс IANA, например Asia/Bishkek.",
  invalid_latitude: "Широта должна быть от −89 до 89 градусов.", invalid_longitude: "Долгота должна быть от −180 до 180 градусов.", invalid_place: "Укажи название места: не более 120 символов.", invalid_nodes: "Выбери средние или истинные лунные узлы.",
  nonexistent_time: "Такого местного времени нет в выбранном часовом поясе. Проверь дату и перевод часов.", ambiguous_time: "Это время встречается дважды после перевода часов. Укажи подтверждённое смещение UTC в минутах.", invalid_offset: "Смещение UTC не соответствует указанным дате, времени и часовому поясу.",
  invalid_json: "Не удалось прочитать данные рождения.", invalid_body: "Запрос слишком большой или некорректный.", engine_unavailable: "Локальный расчётный движок недоступен. Проверь подготовку эфемерид.", forbidden: "Расчёт доступен только с локальной страницы приложения.", not_found: "Этот расчёт доступен только в локальной версии."
};
export function astrologyError(code: unknown, englishMessage: unknown, locale: AstrologyLocale) {
  if (locale === "ru") return typeof code === "string" && russianErrors[code] ? russianErrors[code] : "Расчёт недоступен. Попробуй ещё раз.";
  return typeof englishMessage === "string" ? englishMessage : "Calculation is unavailable. Please try again.";
}
