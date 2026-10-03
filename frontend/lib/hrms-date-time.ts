import { adToBs } from "@sbmdkl/nepali-date-converter";
import { getPlatformDateInput, getPlatformTimePreferences, parsePlatformDate } from "@/lib/platform-time-preferences";

function kathmanduParts(value: string | Date) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = parsePlatformDate(value);
  return new Intl.DateTimeFormat("en-CA", { timeZone: getPlatformTimePreferences().timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function formatEnglishDate(value?: string | Date) {
  if (!value) return "—";
  return kathmanduParts(value);
}

export function formatNepaliDate(value?: string | Date) {
  if (!value) return "—";
  try {
    const result = adToBs(kathmanduParts(value));
    if (typeof result === "string") return `${result} BS`;
    return `${result.currentYear}-${String(result.currentMonth).padStart(2, "0")}-${String(result.currentDay).padStart(2, "0")} BS`;
  } catch {
    return "BS date unavailable";
  }
}

export function formatKathmanduTime(value?: string | Date) {
  if (!value) return "—";
  const { timeZone, timeFormat } = getPlatformTimePreferences();
  return new Intl.DateTimeFormat("en-NP", { timeZone, hour: "2-digit", minute: "2-digit", hour12: timeFormat === "12" }).format(parsePlatformDate(value));
}

export function formatNepaliDateTime(value?: string | Date) {
  if (!value) return "—";
  return `${formatNepaliDate(value)} · ${formatKathmanduTime(value)}`;
}

export function getKathmanduNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: getPlatformTimePreferences().timeZone }));
}

export { getPlatformDateInput };
