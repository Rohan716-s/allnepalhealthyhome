declare module "@sbmdkl/nepali-date-converter" {
  export function adToBs(date: string): string | { currentYear: number; currentMonth: number; currentDay: number };
  export function bsToAd(date: string): string | { currentYear: number; currentMonth: number; currentDay: number };
}
