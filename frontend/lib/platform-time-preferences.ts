export type PlatformTimeFormat = "12" | "24";

export const DEFAULT_PLATFORM_TIME_ZONE = "Asia/Kathmandu";
export const DEFAULT_PLATFORM_TIME_FORMAT: PlatformTimeFormat = "12";

let preferences: {
  timeZone: string;
  timeFormat: PlatformTimeFormat;
} = {
  timeZone: DEFAULT_PLATFORM_TIME_ZONE,
  timeFormat: DEFAULT_PLATFORM_TIME_FORMAT,
};

export function configurePlatformTimePreferences(timeZone?: string, timeFormat?: string) {
  preferences = {
    timeZone: timeZone?.trim() || DEFAULT_PLATFORM_TIME_ZONE,
    timeFormat: timeFormat === "24" ? "24" : DEFAULT_PLATFORM_TIME_FORMAT,
  };
}

export function getPlatformTimePreferences() {
  return preferences;
}

/** API DateTime values without an offset are UTC values from the backend. */
export function parsePlatformDate(value: string | Date) {
  if (value instanceof Date) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00Z`);
  return new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`);
}

export function getPlatformDateInput(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: preferences.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

export function getPlatformMonthInput(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: preferences.timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(value).reduce<Record<string, string>>((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}-${parts.month}`;
}

export function getTimeZoneOffsetLabel(timeZone: string, value = new Date()) {
  try {
    const part = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "longOffset",
    }).formatToParts(value).find((item) => item.type === "timeZoneName")?.value ?? "GMT";
    return part.replace(/^GMT$/, "UTC").replace(/^GMT([+-])0(\d):?(\d\d)$/, "UTC$1$2:$3").replace(/^GMT([+-])(\d+):?(\d\d)$/, "UTC$1$2:$3");
  } catch {
    return "UTC";
  }
}

/** Returns the offset represented by a zone at a given instant. */
function getTimeZoneOffsetMs(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(value).reduce<Record<string, string>>((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return asUtc - value.getTime();
}

/** Convert a datetime-local value in the configured platform zone into UTC. */
export function platformDateTimeInputToUtc(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return undefined;
  const naiveUtc = new Date(`${value}:00Z`);
  if (Number.isNaN(naiveUtc.getTime())) return undefined;
  const first = new Date(naiveUtc.getTime() - getTimeZoneOffsetMs(naiveUtc, preferences.timeZone));
  const corrected = new Date(naiveUtc.getTime() - getTimeZoneOffsetMs(first, preferences.timeZone));
  return corrected.toISOString();
}

export function platformDateTimeInput(value?: string | null) {
  if (!value) return "";
  const date = parsePlatformDate(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: preferences.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).reduce<Record<string, string>>((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
