"use client";
import { DeliveryTrackingMap, type DeliveryMapPoint } from "@/components/delivery-tracking-map";

/** Uses the existing OSM map; only user actions change the parent form. */
export function LocationPicker({ value, onChange }: { value: DeliveryMapPoint | null; onChange: (point: DeliveryMapPoint) => void }) {
  return <div className="min-w-0 space-y-2">
    <DeliveryTrackingMap destination={value} selection onSelect={onChange} />
    {value && <p className="text-xs text-slate-600 dark:text-slate-300" aria-label="Selected coordinates">Latitude {value.latitude.toFixed(6)} · Longitude {value.longitude.toFixed(6)}</p>}
  </div>;
}
