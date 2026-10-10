import { requestApi } from "@/services/api";

export type DeliveryCashSummary = {
  collected: number; available: number; pending: number; confirmed: number;
  collections: { id: string; orderId: string; orderNumber: string; amount: number; createdAt: string; handoverRequestId?: string }[];
  handovers: { id: string; amount: number; reference: string; status: string; reviewNote?: string; createdAt: string }[];
};
export type DeliveryRetry = { id: string; orderId: string; orderNumber: string; requestedDate: string; reason: string; status: string; reviewNote?: string; rider?: string; riderId?: string };
export type DeliveryReviews = {
  handovers: { id: string; rider: string; amount: number; reference: string; status: string; reviewNote?: string }[];
  retries: DeliveryRetry[];
  riders: { id: string; fullName: string; branchId?: string }[];
};
export const getDeliveryCash = (token: string) => requestApi<DeliveryCashSummary>("/api/delivery-operations/cash", {}, token);
export const getDeliveryRetries = (token: string) => requestApi<DeliveryRetry[]>("/api/delivery-operations/retries", {}, token);
export const getDeliveryReviews = (token: string) => requestApi<DeliveryReviews>("/api/delivery-operations/reviews", {}, token);
export const recordDeliveryCash = (id: string, amount: number, token: string) => requestApi<string>(`/api/delivery-operations/orders/${id}/collect`, { method: "POST", body: JSON.stringify({ amount }) }, token);
export const submitDeliveryHandover = (input: { requestId: string; reference: string }, token: string) => requestApi<string>("/api/delivery-operations/handovers", { method: "POST", body: JSON.stringify(input) }, token);
export const requestDeliveryRetry = (id: string, input: { requestId: string; requestedDate: string; reason: string }, token: string) => requestApi<string>(`/api/delivery-operations/orders/${id}/retry`, { method: "POST", body: JSON.stringify(input) }, token);
export const reviewDeliveryOperation = (kind: "handovers" | "retries", id: string, input: { approve: boolean; note: string; riderId?: string }, token: string) => requestApi<{ status: string }>(`/api/delivery-operations/${kind}/${id}/review`, { method: "POST", body: JSON.stringify(input) }, token);
