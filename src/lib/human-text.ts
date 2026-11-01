export function latinDigits(value: string) {
  return value.replace(/[۰-۹٠-٩]/g, char => String("۰۱۲۳۴۵۶۷۸۹".includes(char) ? "۰۱۲۳۴۵۶۷۸۹".indexOf(char) : "٠١٢٣٤٥٦٧٨٩".indexOf(char)));
}
export function comparableName(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}
export function sourceContainsName(source: string, name: string) {
  const escaped = comparableName(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^\\p{L}\\p{N}\\p{M}])${escaped}(?=$|[^\\p{L}\\p{N}\\p{M}])`, "u").test(comparableName(source));
}

export function financialText(value: string) {
  const months = "january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|october|oct|november|nov|december|dec|جنوری|فروری|مارچ|اپریل|مئی|جون|جولائی|اگست|ستمبر|اکتوبر|نومبر|دسمبر";
  return latinDigits(value)
    .replace(/(?:\+?92[ -]?|0)3\d{2}[ -]?\d{7}\b/g, " ")
    .replace(/\b\d{4}-\d{2}-\d{2}(?:t\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:z|[+-]\d{2}:\d{2})?)?/gi, " ")
    .replace(/\b\d{1,2}[/.]\d{1,2}[/.]\d{4}\b/g, " ")
    .replace(new RegExp(`\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${months})\\s+\\d{4}|(?:${months})\\s+\\d{1,2}(?:st|nd|rd|th)?[,]?\\s+\\d{4}`, "gi"), " ")
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?|\b\d{1,2}\s*(?:am|pm)\b/gi, " ");
}
