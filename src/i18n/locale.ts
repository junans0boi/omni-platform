export const SUPPORTED_LOCALES = ["ko", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ko";
export const LOCALE_COOKIE = "omni-locale";

export function isLocale(value: unknown): value is Locale {
  return value === "ko" || value === "en";
}

export function resolveLocale(cookieValue?: string, acceptLanguage?: string | null): Locale {
  if (isLocale(cookieValue)) return cookieValue;
  if (!acceptLanguage) return DEFAULT_LOCALE;

  const requested = acceptLanguage
    .split(",")
    .map((part, order) => {
      const [tag = "", ...parameters] = part.trim().split(";");
      const q = Number(parameters.find((parameter) => parameter.trim().startsWith("q="))?.trim().slice(2) ?? "1");
      return { language: tag.toLowerCase().split("-")[0], q: Number.isFinite(q) ? q : 0, order };
    })
    .sort((a, b) => b.q - a.q || a.order - b.order);

  for (const item of requested) {
    if (isLocale(item.language)) return item.language;
  }
  return DEFAULT_LOCALE;
}
