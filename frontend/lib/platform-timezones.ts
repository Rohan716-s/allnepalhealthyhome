import { getTimeZoneOffsetLabel } from "@/lib/platform-time-preferences";

export type PlatformTimezoneOption = { country: string; zone: string };

// A practical country/region catalogue using IANA zone IDs. The list is kept
// in code because timezone metadata is configuration, not product data.
export const PLATFORM_TIMEZONES: PlatformTimezoneOption[] = [
  { country: "Nepal", zone: "Asia/Kathmandu" },
  { country: "India", zone: "Asia/Kolkata" },
  { country: "Bangladesh", zone: "Asia/Dhaka" },
  { country: "Bhutan", zone: "Asia/Thimphu" },
  { country: "Pakistan", zone: "Asia/Karachi" },
  { country: "Sri Lanka", zone: "Asia/Colombo" },
  { country: "United Arab Emirates", zone: "Asia/Dubai" },
  { country: "Saudi Arabia", zone: "Asia/Riyadh" },
  { country: "Qatar", zone: "Asia/Qatar" },
  { country: "Singapore", zone: "Asia/Singapore" },
  { country: "Malaysia", zone: "Asia/Kuala_Lumpur" },
  { country: "Thailand", zone: "Asia/Bangkok" },
  { country: "China", zone: "Asia/Shanghai" },
  { country: "Hong Kong", zone: "Asia/Hong_Kong" },
  { country: "Japan", zone: "Asia/Tokyo" },
  { country: "South Korea", zone: "Asia/Seoul" },
  { country: "Indonesia - Jakarta", zone: "Asia/Jakarta" },
  { country: "Philippines", zone: "Asia/Manila" },
  { country: "Australia - Sydney", zone: "Australia/Sydney" },
  { country: "Australia - Perth", zone: "Australia/Perth" },
  { country: "New Zealand", zone: "Pacific/Auckland" },
  { country: "United Kingdom", zone: "Europe/London" },
  { country: "Ireland", zone: "Europe/Dublin" },
  { country: "France", zone: "Europe/Paris" },
  { country: "Germany", zone: "Europe/Berlin" },
  { country: "Italy", zone: "Europe/Rome" },
  { country: "Spain", zone: "Europe/Madrid" },
  { country: "Netherlands", zone: "Europe/Amsterdam" },
  { country: "Switzerland", zone: "Europe/Zurich" },
  { country: "Greece", zone: "Europe/Athens" },
  { country: "Turkey", zone: "Europe/Istanbul" },
  { country: "South Africa", zone: "Africa/Johannesburg" },
  { country: "Egypt", zone: "Africa/Cairo" },
  { country: "Kenya", zone: "Africa/Nairobi" },
  { country: "Nigeria", zone: "Africa/Lagos" },
  { country: "Morocco", zone: "Africa/Casablanca" },
  { country: "United States - New York", zone: "America/New_York" },
  { country: "United States - Chicago", zone: "America/Chicago" },
  { country: "United States - Denver", zone: "America/Denver" },
  { country: "United States - Los Angeles", zone: "America/Los_Angeles" },
  { country: "United States - Anchorage", zone: "America/Anchorage" },
  { country: "United States - Honolulu", zone: "Pacific/Honolulu" },
  { country: "Canada - Toronto", zone: "America/Toronto" },
  { country: "Canada - Vancouver", zone: "America/Vancouver" },
  { country: "Mexico - Mexico City", zone: "America/Mexico_City" },
  { country: "Brazil - Sao Paulo", zone: "America/Sao_Paulo" },
  { country: "Argentina", zone: "America/Argentina/Buenos_Aires" },
  { country: "Chile", zone: "America/Santiago" },
  { country: "Colombia", zone: "America/Bogota" },
  { country: "Peru", zone: "America/Lima" },
  { country: "Russia - Moscow", zone: "Europe/Moscow" },
  { country: "Ukraine", zone: "Europe/Kyiv" },
  { country: "Israel", zone: "Asia/Jerusalem" },
  { country: "Iceland", zone: "Atlantic/Reykjavik" },
  { country: "UTC", zone: "UTC" },
];

export function timezoneLabel(option: PlatformTimezoneOption) {
  return `${option.country} (${option.zone}, ${getTimeZoneOffsetLabel(option.zone)})`;
}

export function findTimezoneOption(zone: string) {
  return PLATFORM_TIMEZONES.find((option) => option.zone === zone) ?? { country: zone, zone };
}
