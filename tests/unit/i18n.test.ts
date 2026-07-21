import { describe, expect, it } from "vitest";
import { catalogs, formatMessage } from "../../src/i18n/catalogs";
import { LOCALE_COOKIE, resolveLocale } from "../../src/i18n/locale";

describe("locale resolution", () => {
  it("prefers a supported cookie over the browser language", () => {
    expect(resolveLocale("en", "ko-KR,ko;q=0.9")).toBe("en");
  });

  it("detects Korean or English and otherwise falls back to Korean", () => {
    expect(resolveLocale(undefined, "en-US,en;q=0.9")).toBe("en");
    expect(resolveLocale(undefined, "ko-KR,ko;q=0.9,en;q=0.8")).toBe("ko");
    expect(resolveLocale(undefined, "fr-FR,fr;q=0.9")).toBe("ko");
    expect(resolveLocale("invalid", undefined)).toBe("ko");
    expect(LOCALE_COOKIE).toBe("omni-locale");
  });
});

describe("typed message catalogs", () => {
  it("keeps Korean and English keys in parity", () => {
    expect(Object.keys(catalogs.ko).sort()).toEqual(Object.keys(catalogs.en).sort());
  });

  it("formats named values without evaluating user content", () => {
    expect(formatMessage("en", "settings.locale.current", { locale: "English" })).toBe("Current language: English");
  });
});
