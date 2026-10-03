"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, requestDemoPasswordReset, resetDemoPassword } from "@/services/api";

function ForgotPasswordForm() {
  const params = useSearchParams();
  const [accountType, setAccountType] = useState<"CUSTOMER" | "STAFF">(params.get("mode") === "staff" ? "STAFF" : "CUSTOMER");
  const [identifier, setIdentifier] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [demoCode, setDemoCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [success, setSuccess] = useState("");

  function switchAccountType(value: "CUSTOMER" | "STAFF") {
    setAccountType(value); setStep(1); setChallengeId(""); setDemoCode(""); setVerificationCode(""); setError(""); setNotice(""); setSuccess("");
  }
  async function requestCode(event: FormEvent) {
    event.preventDefault(); setError(""); setNotice(""); setSuccess("");
    if (identifier.trim().length < 3) { setError("Enter the email address or username on your account."); return; }
    setLoading(true);
    try {
      const result = await requestDemoPasswordReset(identifier.trim(), accountType);
      if (!result.challengeId || !result.demoCode) { setError(result.message); return; }
      setChallengeId(result.challengeId); setDemoCode(result.demoCode); setVerificationCode(result.demoCode); setNotice(result.message); setStep(2);
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : "The reset request could not be completed."); }
    finally { setLoading(false); }
  }
  async function resetPassword(event: FormEvent) {
    event.preventDefault(); setError(""); setNotice(""); setSuccess("");
    if (!/^\d{6}$/.test(verificationCode.trim())) { setError("Enter the 6-digit demo verification code."); return; }
    if (newPassword.length < 8) { setError("Your new password must be at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { setError("New password and confirmation do not match."); return; }
    setLoading(true);
    try { const result = await resetDemoPassword({ challengeId, verificationCode: verificationCode.trim(), newPassword, confirmPassword }); setSuccess(result.message); setNewPassword(""); setConfirmPassword(""); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "The password could not be reset."); }
    finally { setLoading(false); }
  }

  return <main className="min-h-screen bg-[var(--color-background)] px-4 py-8 text-[var(--color-text-primary)] sm:px-6 sm:py-12"><div className="mx-auto max-w-2xl"><Link href={accountType === "STAFF" ? "/staff/login" : "/login"} className="inline-flex items-center gap-2 text-sm font-bold text-[var(--color-primary)] hover:underline"><ArrowLeft size={16} />Back to sign in</Link><Card className="mt-6 overflow-hidden rounded-[2rem] border-[var(--color-border)] shadow-[0_24px_70px_rgba(15,23,42,0.12)]"><CardHeader className="border-b border-[var(--color-border)] bg-[linear-gradient(135deg,var(--color-primary-dark),var(--color-primary))] p-7 text-white sm:p-10"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15"><KeyRound size={22} /></span><div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-white/70">Account recovery</p><CardTitle className="mt-1 text-2xl text-white sm:text-3xl">Forgot your password?</CardTitle></div></div><p className="mt-4 max-w-xl text-sm leading-6 text-white/80">Recover access with a verification code, then choose a new password.</p></CardHeader><CardContent className="grid gap-6 p-6 sm:p-10"><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p className="flex items-center gap-2 font-extrabold"><ShieldCheck size={16} /> DEMO FLOW</p><p className="mt-1 leading-6">Email/SMS delivery is not configured yet. For this demo, the verification code appears on this screen and is never stored as plain text.</p></div><div className="grid gap-2"><Label>Account type</Label><div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1"><button type="button" onClick={() => switchAccountType("CUSTOMER")} className={`rounded-lg px-3 py-2 text-sm font-bold transition ${accountType === "CUSTOMER" ? "bg-white text-[var(--color-primary)] shadow-sm" : "text-slate-500"}`}>Customer</button><button type="button" onClick={() => switchAccountType("STAFF")} className={`rounded-lg px-3 py-2 text-sm font-bold transition ${accountType === "STAFF" ? "bg-white text-[var(--color-primary)] shadow-sm" : "text-slate-500"}`}>Staff</button></div></div>{error && <Alert className="flex items-start gap-2 border-rose-200 bg-rose-50 text-rose-800"><AlertCircle size={17} className="mt-0.5 shrink-0" />{error}</Alert>}{notice && <Alert className="border-blue-200 bg-blue-50 text-blue-900">{notice}</Alert>}{success && <Alert className="flex items-start gap-2 border-emerald-200 bg-emerald-50 text-emerald-800"><CheckCircle2 size={17} className="mt-0.5 shrink-0" />{success}</Alert>}
      {step === 1 && !success && <form onSubmit={requestCode} className="grid gap-5"><div className="grid gap-2"><Label htmlFor="reset-identifier">Email address or username</Label><Input id="reset-identifier" value={identifier} onChange={event => setIdentifier(event.target.value)} autoComplete="username" placeholder={accountType === "STAFF" ? "staff@example.com" : "you@example.com"} required /></div><Button type="submit" disabled={loading} size="lg" className="h-12">{loading ? <><Loader2 size={17} className="animate-spin" />Checking account…</> : "Show demo verification code"}</Button></form>}
      {step === 2 && !success && <form onSubmit={resetPassword} className="grid gap-5"><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-extrabold uppercase tracking-wide text-emerald-800">Demo verification code</p><p className="mt-2 font-mono text-2xl font-black tracking-[0.35em] text-emerald-950">{demoCode}</p><p className="mt-2 text-xs text-emerald-800">Use this code now. It expires in 10 minutes and can only be used once.</p></div><div className="grid gap-2"><Label htmlFor="reset-code">Verification code</Label><Input id="reset-code" inputMode="numeric" maxLength={6} value={verificationCode} onChange={event => setVerificationCode(event.target.value.replace(/\D/g, ""))} required /></div><div className="grid gap-2"><Label htmlFor="new-password">New password</Label><div className="relative"><Input id="new-password" type={showPassword ? "text" : "password"} value={newPassword} onChange={event => setNewPassword(event.target.value)} autoComplete="new-password" className="pr-12" minLength={8} required /><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Hide new password" : "Show new password"} className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div><p className="text-xs text-slate-500">Use at least 8 characters. Your password is hashed securely before storage.</p></div><div className="grid gap-2"><Label htmlFor="confirm-password">Confirm new password</Label><Input id="confirm-password" type={showPassword ? "text" : "password"} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} required /></div><div className="flex flex-wrap gap-3"><Button type="submit" disabled={loading} size="lg" className="h-12">{loading ? <><Loader2 size={17} className="animate-spin" />Saving password…</> : "Reset password"}</Button><Button type="button" variant="outline" onClick={() => { setStep(1); setChallengeId(""); setDemoCode(""); setVerificationCode(""); setNotice(""); }}>Start again</Button></div></form>}
      {success && <Link href={accountType === "STAFF" ? "/staff/login" : "/login"} className="inline-flex h-12 items-center justify-center rounded-xl bg-[var(--color-primary)] px-5 text-sm font-extrabold text-white hover:bg-[var(--color-primary-dark)]">Continue to sign in</Link>}
    </CardContent></Card></div></main>;
}

export default function ForgotPasswordPage() {
  return <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">Loading account recovery…</main>}><ForgotPasswordForm /></Suspense>;
}
