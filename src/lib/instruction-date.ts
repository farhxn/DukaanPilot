const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const urduMonths = ["جنوری", "فروری", "مارچ", "اپریل", "مئی", "جون", "جولائی", "اگست", "ستمبر", "اکتوبر", "نومبر", "دسمبر"];
const fail = () => { throw new Error("Use one valid date, for example 1 December 2026, and optionally a time such as 3 pm (Pakistan time)."); };
const digits = (value: string) => value.replace(/[۰-۹٠-٩]/g, char => String("۰۱۲۳۴۵۶۷۸۹".includes(char) ? "۰۱۲۳۴۵۶۷۸۹".indexOf(char) : "٠١٢٣٤٥٦٧٨٩".indexOf(char)));
function timesOutsideISO(source: string, iso: string) {
  return /\b\d{1,2}:\d{1,2}|\b\d{1,2}\s*(?:am|pm)\b|\b(?:at|time|waqt)\s*\d/.test(source.replace(iso, ""));
}

export function nextMonthFirst(now = new Date()) {
  const local = new Date(now.getTime() + 5 * 3600000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 1, 4)).toISOString(); // 09:00 PKT
}

// Financial dates are interpreted from source text, never from a model guess.
export function instructionDueDate(instruction: string, now = new Date()) {
  const source = digits(instruction).toLowerCase().replace(/(?:\+?92|0)3\d{2}[- ]?\d{7}\b/g, " ");
  const dates: { year: number; month: number; day: number }[] = [];
  for (const match of source.matchAll(/\b(\d{4})-(\d{2})-(\d{2})(?=t|\b)/g)) dates.push({ year: +match[1], month: +match[2], day: +match[3] });
  for (const match of source.matchAll(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/g)) dates.push({ year: +match[3], month: +match[2], day: +match[1] });
  const names = months.map(name => `${name}|${name.slice(0, 3)}`).join("|");
  for (const match of source.matchAll(new RegExp(`(\\d{1,2})\\s+(${urduMonths.join("|")})\\s+(\\d{4})`, "g"))) dates.push({ year: +match[3], month: urduMonths.indexOf(match[2]) + 1, day: +match[1] });
  for (const match of source.matchAll(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${names})\\s+(\\d{4})\\b`, "g"))) dates.push({ year: +match[3], month: months.findIndex(name => name === match[2] || name.slice(0, 3) === match[2]) + 1, day: +match[1] });
  for (const match of source.matchAll(new RegExp(`\\b(${names})\\s+(\\d{1,2})(?:st|nd|rd|th)?[,]?\\s+(\\d{4})\\b`, "g"))) dates.push({ year: +match[3], month: months.findIndex(name => name === match[1] || name.slice(0, 3) === match[1]) + 1, day: +match[2] });
  // Recognizable but unsupported/invalid written dates must not silently fall
  // through to a default (e.g. 100 December 2026 or 1 Dec. 2026).
  if (!dates.length && new RegExp(`\\d+\\s*(?:${names})\\.?\\s*\\d{2,4}|(?:${names})\\s+\\d+[,]?\\s+\\d{4}`, "i").test(source)) fail();
  if (dates.length > 1) fail();
  if (!dates.length && (new RegExp(`\\b(?:\\d{1,2}\\s+(?:${names})|(?:${names})\\s+\\d{1,2}|today|tomorrow|yesterday|kal|aaj|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\\b`).test(source) || urduMonths.some(month => source.includes(month)) || /\d\s*[-/]\s*\d|\d{1,2}\.\d{1,2}\.\d{2,4}/.test(source) || /تاریخ|کل|آج/.test(source))) fail();
  const { year, month, day } = dates[0] ?? (() => { const date = new Date(new Date(nextMonthFirst(now)).getTime() + 5 * 3600000); return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: 1 }; })();
  const check = new Date(Date.UTC(year, month - 1, day));
  if (year < 2000 || year > 9999 || check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) fail();
  // ISO offsets must be honored; timezone-free written dates use Pakistan time.
  const iso = source.match(/\b\d{4}-\d{2}-\d{2}t\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(z|[+-]\d{2}:\d{2})/);
  if (iso && timesOutsideISO(source, iso[0])) fail();
  if (iso) { const value = new Date(iso[0]); if (!Number.isFinite(value.getTime())) fail(); return value.toISOString(); }
  if (/\b(?:utc|gmt)\b|[+-]\d{2}:\d{2}/.test(source)) fail();
  const times = [...source.matchAll(/(?:t|\b)(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?\s*(am|pm)?|\b(\d{1,2})\s*(am|pm)\b/g)];
  if (times.length > 1) fail();
  let hour = 9, minute = 0, second = 0;
  if (times[0]) {
    const time = times[0], meridiem = time[4] ?? time[6]; hour = +(time[1] ?? time[5]); minute = +(time[2] ?? 0); second = +(time[3] ?? 0);
    if (meridiem) { if (hour < 1 || hour > 12) fail(); hour = hour % 12 + (meridiem === "pm" ? 12 : 0); }
    if (hour > 23 || minute > 59 || second > 59) fail();
  } else if (/\bbaje\b|بجے|\b(?:am|pm)\b|\b(?:at|time|waqt)\s*\d|\b\d{1,2}:\d{1,2}/.test(source)) fail();
  return new Date(Date.UTC(year, month - 1, day, hour - 5, minute, second)).toISOString();
}
