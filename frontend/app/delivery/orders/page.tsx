"use client";

/* eslint-disable react-hooks/exhaustive-deps */

import { useDeliveryRefresh } from "@/lib/delivery-refresh";
import Link from "next/link";
import { Suspense } from "react";
import { Eye, RefreshCw, Search, Truck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { StaffShell, staffToken } from "@/components/staff-shell";
import { ApiError, getStaffOrders, type Paged, type StaffOrderListItem } from "@/services/api";

function DeliveryOrdersContent() {
	const searchParams = useSearchParams();
	const pathname = usePathname() ?? "/delivery/orders";
	const router = useRouter();
	const status = searchParams.get("status") ?? "";
	const [data, setData] = useState<Paged<StaffOrderListItem> | null>(null);
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(1);
	const [loading, setLoading] = useState(false);
	const [appliedSearch, setAppliedSearch] = useState("");
	const [error, setError] = useState("");
	const requestSequence = useRef(0);

	const load = () => { const sequence = ++requestSequence.current; setLoading(true); return getStaffOrders(staffToken(), "delivery", {
		search: appliedSearch || undefined,
		page, pageSize: 20,
		status: status || undefined,
	})
		.then((result) => {
			if (sequence !== requestSequence.current) return;
			setData(result);
			setError("");
		})
		.catch((e) => { if (sequence === requestSequence.current) setError(e instanceof ApiError ? e.message : "Assigned deliveries could not be loaded."); }).finally(() => { if (sequence === requestSequence.current) setLoading(false); }); };

	useDeliveryRefresh(load);
	useEffect(() => {
		const timer = window.setTimeout(() => void load(), 0);
		return () => { window.clearTimeout(timer); requestSequence.current++; };
	}, [status, page, appliedSearch]);
	function changeStatus(nextStatus: string) {
		setPage(1);
		const query = new URLSearchParams(searchParams.toString());
		if (nextStatus) query.set("status", nextStatus);
		else query.delete("status");
		const serialized = query.toString();
		router.replace(serialized ? `${pathname}?${serialized}` : pathname, { scroll: false });
	}

	function applySearch() { setPage(1); setAppliedSearch(search.trim()); if (page === 1 && appliedSearch === search.trim()) void load(); }
	return (
		<StaffShell
			panel="delivery"
			title="My deliveries"
			action={<button onClick={load} className="soft-btn"><RefreshCw size={15} /> Refresh</button>}
		>
			<div className="mt-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row">
				<div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3">
					<Search size={16} className="text-slate-400" />
					<input
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && applySearch()}
						className="w-full bg-transparent py-2.5 text-sm outline-none"
						placeholder="Search order, customer, or area"
					/>
				</div>
				<select value={status} onChange={(e) => changeStatus(e.target.value)} className="field sm:max-w-56">
					<option value="">All assigned</option>
					{["ASSIGNED_FOR_DELIVERY", "ACCEPTED", "PICKED_UP", "OUT_FOR_DELIVERY", "ARRIVED", "DELIVERED", "FAILED"].map((value) => (
						<option key={value} value={value}>{value === "OUT_FOR_DELIVERY" ? "In progress" : value.replaceAll("_", " ")}</option>
					))}
				</select>
				<button onClick={applySearch} className="primary-btn justify-center">Search</button>
			</div>
			{loading && <p role="status" className="mt-4 text-sm text-slate-500">Loading deliveries?</p>}
			{error && <p role="alert" className="mt-5 rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</p>}
			<div className="mt-6 grid gap-4">
				{data?.items.map((order) => (
					<Link
						key={order.id}
						href={`/delivery/orders/${order.id}`}
						className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-sm"
					>
						<div className="flex flex-wrap items-start justify-between gap-3">
							<div>
								<p className="text-lg font-extrabold">{order.orderNumber}</p>
								<p className="mt-1 text-sm text-slate-600">{order.customerName}{"\u00b7"}{order.customerPhone}</p>
							</div>
							<span className="rounded-full bg-teal-50 px-3 py-1 text-[11px] font-extrabold text-teal-800">
								{order.deliveryStatus ?? order.status}
							</span>
						</div>
						<div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs">
							<span className="flex items-center gap-2 text-slate-500"><Truck size={15} className="text-teal-700" /> {order.paymentMethod}</span>
							<span className="font-extrabold text-slate-900">{order.paymentMethod === "CASH_ON_DELIVERY" ? "To collect: " : "Order total: "}Rs. {(order.paymentMethod === "CASH_ON_DELIVERY" ? order.amountDue ?? order.total : order.total).toLocaleString("en-IN")}</span>
							<span className="inline-flex items-center gap-1 font-extrabold text-teal-700"><Eye size={15} /> Open delivery</span>
						</div>
					</Link>
				))}
				{data?.items.length === 0 && (
					<div className="rounded-2xl border border-slate-200 bg-white px-6 py-20 text-center">
						<Truck className="mx-auto text-slate-300" size={38} />
						<p className="mt-4 font-extrabold">No deliveries assigned to you.</p>
						<p className="mt-2 text-sm text-slate-500">New assignments will appear here.</p>
					</div>
				)}
			</div>
            {data && data.totalPages > 1 && <nav aria-label="Delivery pages" className="mt-5 flex items-center justify-between gap-3">
              <button className="soft-btn" disabled={loading || page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
              <span className="text-sm">Page {data.page} of {data.totalPages} ? {data.totalItems} deliveries</span>
              <button className="soft-btn" disabled={loading || page >= data.totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
            </nav>}
		</StaffShell>
	);
}

export default function DeliveryOrders() {
	return <Suspense fallback={<main className="grid min-h-screen place-items-center bg-slate-100 text-sm text-slate-500 dark:bg-slate-950">Loading deliveries…</main>}>
		<DeliveryOrdersContent />
	</Suspense>;
}
