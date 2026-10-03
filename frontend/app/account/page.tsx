"use client";

import Link from "next/link";
import { ArrowRight, FileText, Heart, Loader2, PackageCheck, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { useShop } from "@/components/shop-provider";
import { ButtonLink } from "@/components/ui/button-link";
import { Card, CardContent } from "@/components/ui/card";
import { getCustomerOrders, getCustomerProfile, getPrescriptions, type Customer } from "@/services/api";

export default function AccountPage() {
  const { wishlist } = useShop();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState(0);
  const [prescriptions, setPrescriptions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const token = localStorage.getItem("anhh-access-token");
      if (!token) {
        await Promise.resolve();
        if (!cancelled) { setLoading(false); setError("Sign in to load your account details."); }
        return;
      }
      try {
        const [profile, orderRows, prescriptionRows] = await Promise.all([getCustomerProfile(token), getCustomerOrders(token), getPrescriptions(token)]);
        if (!cancelled) { setCustomer(profile); setOrders(orderRows.length); setPrescriptions(prescriptionRows.length); }
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Account details could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);
  return <div className="min-h-screen bg-[#f8fbfa]"><SiteHeader /><main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8"><div className="rounded-[2rem] bg-slate-950 p-7 text-white sm:p-10"><div className="flex items-center gap-4"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-600"><UserRound size={26} /></span><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-300">Your account</p><h1 className="mt-1 text-2xl font-extrabold">{customer ? `Welcome back, ${customer.fullName}` : "Your health home"}</h1><p className="mt-1 text-sm text-slate-400">Your orders, prescriptions, and saved products in one place.</p></div></div></div>{error && <Card className="mt-6 border-amber-200 bg-amber-50"><CardContent className="p-5 text-sm text-amber-900">{error}<div className="mt-4"><ButtonLink href="/login" size="sm">Sign in</ButtonLink></div></CardContent></Card>}{loading ? <div className="mt-8 flex justify-center"><Loader2 className="animate-spin text-teal-700" /></div> : <><div className="mt-8 grid gap-4 sm:grid-cols-3"><Link href="/orders" className="surface p-5 hover:border-teal-200"><PackageCheck className="text-teal-700" size={20} /><p className="mt-5 text-2xl font-extrabold">{orders}</p><p className="mt-1 text-xs font-bold text-slate-500">Orders</p><span className="mt-4 block text-xs font-bold text-teal-700">View orders <ArrowRight size={13} className="inline" /></span></Link><Link href="/wishlist" className="surface p-5 hover:border-teal-200"><Heart className="text-rose-500" size={20} /><p className="mt-5 text-2xl font-extrabold">{wishlist.length}</p><p className="mt-1 text-xs font-bold text-slate-500">Saved products</p><span className="mt-4 block text-xs font-bold text-teal-700">View wishlist <ArrowRight size={13} className="inline" /></span></Link><Link href="/account/prescriptions" className="surface p-5 hover:border-teal-200"><FileText className="text-teal-700" size={20} /><p className="mt-5 text-2xl font-extrabold">{prescriptions}</p><p className="mt-1 text-xs font-bold text-slate-500">Prescription requests</p><span className="mt-4 block text-xs font-bold text-teal-700">View requests <ArrowRight size={13} className="inline" /></span></Link></div><section className="surface mt-8 p-6"><h2 className="text-lg font-extrabold">Profile details</h2>{customer ? <div className="mt-5 grid gap-5 sm:grid-cols-2"><div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Name</p><p className="mt-1 text-sm font-bold text-slate-800">{customer.fullName}</p></div><div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Email</p><p className="mt-1 break-all text-sm font-bold text-slate-800">{customer.email}</p></div><div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Phone</p><p className="mt-1 text-sm font-bold text-slate-800">{customer.phone}</p></div><div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Support</p><p className="mt-1 text-sm font-bold text-teal-700">01-5313958</p></div></div> : <p className="mt-3 text-sm text-slate-500">Sign in to view your saved profile information.</p>}</section></>}</main><SiteFooter /></div>;
}
