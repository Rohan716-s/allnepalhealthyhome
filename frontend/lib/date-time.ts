import { adToBs } from "@sbmdkl/nepali-date-converter";
import { getPlatformTimePreferences, parsePlatformDate, platformDateTimeInput, platformDateTimeInputToUtc } from "@/lib/platform-time-preferences";

export type PlatformDateFormat = "AD" | "BS";

/** Format API timestamps consistently in Nepal time without mutating the source value. */
export function formatNepalDateTime(value?: string | Date | null, fallback = "—") {
  if (!value) return fallback;
  const date = parsePlatformDate(value);
  if (Number.isNaN(date.getTime())) return fallback;
  const { timeZone, timeFormat } = getPlatformTimePreferences();
  return new Intl.DateTimeFormat("en-NP", { timeZone, day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: timeFormat === "12" }).format(date);
}

export function formatNepalDate(value?: string | Date | null, fallback = "—") {
  if (!value) return fallback;
  const date = parsePlatformDate(value);
  return Number.isNaN(date.getTime()) ? fallback : new Intl.DateTimeFormat("en-NP", { timeZone: getPlatformTimePreferences().timeZone, day: "2-digit", month: "short", year: "numeric" }).format(date);
}

export function formatPlatformDate(value: string | Date | null | undefined, format: PlatformDateFormat = "AD", fallback = "—") {
  if (!value) return fallback;
  const dateOnly = typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : undefined;
  if (dateOnly) {
    if (format === "AD") return dateOnly;
    try {
      const result = adToBs(dateOnly);
      if (typeof result === "string") return `${result} BS`;
      return `${result.currentYear}-${String(result.currentMonth).padStart(2, "0")}-${String(result.currentDay).padStart(2, "0")} BS`;
    } catch { return fallback; }
  }
  const date = parsePlatformDate(value);
  if (Number.isNaN(date.getTime())) return fallback;
  if (format === "AD") return new Intl.DateTimeFormat("en-NP", { timeZone: getPlatformTimePreferences().timeZone, day: "2-digit", month: "short", year: "numeric" }).format(date);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: getPlatformTimePreferences().timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date).reduce<Record<string, string>>((result, part) => { result[part.type] = part.value; return result; }, {});
  try {
    // Convert the Kathmandu calendar date, never the raw UTC timestamp.
    const result = adToBs(`${parts.year}-${parts.month}-${parts.day}`);
    if (typeof result === "string") return `${result} BS`;
    return `${result.currentYear}-${String(result.currentMonth).padStart(2, "0")}-${String(result.currentDay).padStart(2, "0")} BS`;
  } catch { return fallback; }
}

export function formatPlatformDateTime(value: string | Date | null | undefined, format: PlatformDateFormat = "AD", fallback = "—") {
  if (!value) return fallback;
  return format === "BS" ? `${formatPlatformDate(value, format, fallback)} · ${new Intl.DateTimeFormat("en-NP", { timeZone: getPlatformTimePreferences().timeZone, hour: "numeric", minute: "2-digit", hour12: getPlatformTimePreferences().timeFormat === "12" }).format(parsePlatformDate(value))}` : formatNepalDateTime(value, fallback);
}

/** Convert a date-only input to an ISO date at midnight UTC without local timezone drift. */
export function dateInputToUtc(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  return `${value}T00:00:00.000Z`;
}

/** Convert an API date to the stable YYYY-MM-DD value required by date inputs. */
export function utcToDateInput(value?: string | null) {
  if (!value) return "";
  const match = value.match(/^\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? "";
}

/** Convert a datetime-local value entered in Nepal time to an unambiguous UTC ISO value. */
export function dateTimeInputToUtc(value: string) {
  return platformDateTimeInputToUtc(value);
}

/** Convert an API UTC timestamp to the Kathmandu datetime-local value. */
export function utcToDateTimeInput(value?: string | null) {
  return platformDateTimeInput(value);
}
