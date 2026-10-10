"use client";
import { useState } from "react";
import { DeliveryTrackingMap } from "@/components/delivery-tracking-map";
import { downloadOrderDocument, type StaffOrder } from "@/services/api";
import { formatNepalDateTime } from "@/lib/date-time";
import { useDeliveryClock } from "@/lib/delivery-refresh";

export function OrderDeliveryDetails({ order, token }: {
  order: Pick<StaffOrder, "delivery" | "deliveryInstructions" | "address" | "documents">;
  token: string;
}) {
  const [error, setError] = useState("");
  const now = useDeliveryClock();
  const delivery = order.delivery;
  const destination = order.address?.latitude != null && order.address.longitude != null
    ? { latitude: order.address.latitude, longitude: order.address.longitude } : null;
  const current = delivery?.currentLocation;
  const freshLocation = current && now > 0 && now - Date.parse(current.updatedAt) <= 120000 ? current : null;
  return <section className="grid gap-3 rounded-xl border border-slate-200 p-4">
    {order.deliveryInstructions && <div><h3 className="text-sm font-bold">Delivery notes</h3><p className="whitespace-pre-wrap break-words text-sm">{order.deliveryInstructions}</p></div>}
    {delivery && <>
      <p className="text-sm font-semibold">{delivery.deliveryStaff || "Assigned rider"} · {delivery.status.replaceAll("_", " ")}</p>
      {delivery.notes && <p className="whitespace-pre-wrap break-words text-sm"><strong>Rider note:</strong> {delivery.notes}</p>}
      <div className="flex flex-wrap gap-3 text-xs text-slate-600">{([
        ["Accepted", delivery.acceptedAt], ["Arrived", delivery.arrivedAt], ["Delivered", delivery.deliveredAt],
      ] as const).map(([label, time]) => time && <span key={label}>{label}: {formatNepalDateTime(time)}</span>)}</div>
      {(destination || freshLocation) && <DeliveryTrackingMap current={freshLocation} destination={destination} />}
    </>}
    {(order.documents?.length ?? 0) > 0 && <div><h3 className="text-sm font-bold">Documents</h3><ul className="mt-2 grid gap-2">{order.documents?.map(file => <li key={file.id}><button type="button" className="break-all text-sm text-teal-800 underline" onClick={() => {
      void downloadOrderDocument(file.downloadUrl, token).catch(reason => setError(reason instanceof Error ? reason.message : "Document could not be downloaded."));
    }}>{file.originalFileName} · {file.kind.replaceAll("_", " ")}</button></li>)}</ul></div>}
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
  </section>;
}
