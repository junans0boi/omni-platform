export type TimeFormatChoice = "auto" | "12h" | "24h";

export function formatTimestamp(dateInput: string | Date | number, formatChoice: TimeFormatChoice = "auto", locale: string = "ko"): string {
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "";

  if (formatChoice === "12h") {
    return date.toLocaleTimeString(locale === "en" ? "en-US" : "ko-KR", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  if (formatChoice === "24h") {
    return date.toLocaleTimeString(locale === "en" ? "en-US" : "ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  // "auto"
  return date.toLocaleTimeString(locale === "en" ? "en-US" : "ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
