"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2, Pill, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSiteValue } from "@/components/site-config-provider";
import { cn } from "@/lib/utils";

export type LoginCredentials = {
  emailOrPhone: string;
  password: string;
};

export type LoginRoleOption = {
  key: string;
  label: string;
  email: string;
  password: string;
  Icon: LucideIcon;
};

type ModernLoginShellProps = {
  mode: "customer" | "staff";
  title: string;
  description: string;
  eyebrow?: string;
  submitLabel?: string;
  error?: string;
  loading?: boolean;
  onSubmit: (credentials: LoginCredentials) => Promise<void>;
  onBack?: () => void;
  registerHref?: string;
  registerLabel?: string;
  roleOptions?: LoginRoleOption[];
  activeRoleKey?: string;
  onRoleChange?: (role: LoginRoleOption) => void;
  demoCredentials?: { email: string; password: string };
};

export function ModernLoginShell({
  mode,
  title,
  description,
  eyebrow = mode === "staff" ? "Secure operations access" : "Welcome back",
  submitLabel = mode === "staff" ? "Sign in securely" : "Sign in",
  error,
  loading = false,
  onSubmit,
  onBack,
  registerHref = "/register",
  registerLabel = "Create an account",
  roleOptions,
  activeRoleKey,
  onRoleChange,
  demoCredentials,
}: ModernLoginShellProps) {
  const router = useRouter();
  const siteName = useSiteValue("website.name", "All Nepal Healthy Home");
  const [identifier, setIdentifier] = useState(demoCredentials?.email ?? "");
  const [password, setPassword] = useState(demoCredentials?.password ?? "");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ identifier?: string; password?: string }>({});

  function validate(values: { identifier: string; password: string }) {
    const next: typeof fieldErrors = {};
    const trimmedIdentifier = values.identifier.trim();
    if (!trimmedIdentifier) next.identifier = "Enter your email, phone number, or username.";
    else if (trimmedIdentifier.includes("@") && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedIdentifier)) {
      next.identifier = "Enter a valid email address.";
    }
    if (!values.password) next.password = "Enter your password.";
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const values = {
      identifier: String(formData.get("emailOrPhone") ?? identifier),
      password: String(formData.get("password") ?? password),
    };
    if (!validate(values)) return;
    await onSubmit({ emailOrPhone: values.identifier.trim(), password: values.password });
  }

  function updateIdentifier(value: string) {
    setIdentifier(value);
    if (fieldErrors.identifier) setFieldErrors((current) => ({ ...current, identifier: undefined }));
  }

  function updatePassword(value: string) {
    setPassword(value);
    if (fieldErrors.password) setFieldErrors((current) => ({ ...current, password: undefined }));
  }

  function showRequiredError(field: "identifier" | "password") {
    setFieldErrors((current) => ({
      ...current,
      [field]: field === "identifier" ? "Enter your email, phone number, or username." : "Enter your password.",
    }));
  }

  return (
    <main className="min-h-screen bg-[var(--color-background)] px-4 py-6 text-[var(--color-text-primary)] sm:px-6 sm:py-10 lg:px-8 lg:py-12">
      <div className="mx-auto grid min-h-[min(760px,calc(100vh-3rem))] w-full max-w-6xl overflow-hidden rounded-[2rem] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_24px_70px_rgba(15,23,42,0.14)] lg:grid-cols-[0.92fr_1.08fr]">
        <section className="relative hidden overflow-hidden bg-[linear-gradient(145deg,var(--color-primary-dark),var(--color-primary)_58%,#1d65bd)] p-8 text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
          <div className="pointer-events-none absolute -right-28 -top-28 h-80 w-80 rounded-full border-[38px] border-white/10" />
          <div className="pointer-events-none absolute -bottom-36 -left-28 h-96 w-96 rounded-full bg-white/5" />
          <div className="relative z-10 flex items-center gap-3 text-sm font-extrabold tracking-wide">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
              <Pill size={20} aria-hidden="true" />
            </span>
            {siteName}
          </div>
          <div className="relative z-10 mt-12 max-w-md animate-fade-up">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-white/70">Trusted pharmacy care</p>
            <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight xl:text-5xl">Health support that feels closer to home.</h1>
            <p className="mt-5 max-w-sm text-sm leading-7 text-white/75">Shop confidently, manage your care, and stay connected to the people helping you feel your best.</p>
            <div className="relative mt-10 overflow-hidden rounded-[1.75rem] border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
              <Image src="/trust-verification.png" alt="Pharmacist verification illustration" width={520} height={300} className="h-auto w-full rounded-2xl object-contain" priority />
              <div className="mt-3 flex items-center gap-2 text-xs font-bold text-white/85"><ShieldCheck size={16} /> Verified care for Nepal</div>
            </div>
          </div>
          <p className="relative z-10 text-xs text-white/55">Secure access to your All Nepal Healthy Home account</p>
        </section>

        <section className="flex flex-col justify-center bg-[var(--color-surface)] p-6 sm:p-10 lg:p-14">
          <div className="mx-auto w-full max-w-xl animate-fade-up">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[var(--color-primary)]">{eyebrow}</p>
                <h2 className="mt-3 text-3xl font-black tracking-tight text-[var(--color-text-primary)] sm:text-4xl">{title}</h2>
                <p className="mt-3 max-w-md text-sm leading-6 text-[var(--color-text-secondary)]">{description}</p>
              </div>
              <button type="button" onClick={onBack ?? (() => router.push("/"))} className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]">Close</button>
            </div>

            {roleOptions && roleOptions.length > 0 && onRoleChange && (
              <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {roleOptions.map((role) => {
                  const Icon = role.Icon;
                  const selected = role.key === activeRoleKey;
                  return <button key={role.key} type="button" onClick={() => onRoleChange(role)} className={cn("flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-xs font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]", selected ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white shadow-md shadow-blue-900/15" : "border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]") }><Icon size={17} aria-hidden="true" />{role.label}</button>;
                })}
              </div>
            )}

            <form method="post" onSubmit={submit} className="mt-8 grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor="login-identifier" className="text-[var(--color-text-primary)]">{mode === "staff" ? "Work email, phone, or username" : "Email, phone, or username"}</Label>
                <Input id="login-identifier" name="emailOrPhone" required value={identifier} onInvalid={() => showRequiredError("identifier")} onChange={(event) => updateIdentifier(event.target.value)} autoComplete="username" placeholder={mode === "staff" ? "staff@example.com" : "you@example.com"} aria-invalid={Boolean(fieldErrors.identifier)} aria-describedby={fieldErrors.identifier ? "login-identifier-error" : undefined} className="h-12 rounded-xl border-[var(--color-border)] bg-[var(--color-background)] px-4 text-base text-[var(--color-text-primary)] focus:border-[var(--color-primary)] focus:ring-[var(--color-primary-light)]" />
                {fieldErrors.identifier && <p id="login-identifier-error" className="flex items-center gap-1 text-xs font-semibold text-[var(--color-danger)]"><AlertCircle size={13} />{fieldErrors.identifier}</p>}
              </div>
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3"><Label htmlFor="login-password" className="text-[var(--color-text-primary)]">Password</Label><Link href={`/forgot-password?mode=${mode}`} className="text-xs font-bold text-[var(--color-primary)] hover:underline">Forgot Password?</Link></div>
                <div className="relative">
                  <Input id="login-password" name="password" required type={showPassword ? "text" : "password"} onInvalid={() => showRequiredError("password")} value={password} onChange={(event) => updatePassword(event.target.value)} autoComplete="current-password" placeholder="Enter your password" aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? "login-password-error" : undefined} className="h-12 rounded-xl border-[var(--color-border)] bg-[var(--color-background)] px-4 pr-12 text-base text-[var(--color-text-primary)] focus:border-[var(--color-primary)] focus:ring-[var(--color-primary-light)]" />
                  <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                </div>
                {fieldErrors.password && <p id="login-password-error" className="flex items-center gap-1 text-xs font-semibold text-[var(--color-danger)]"><AlertCircle size={13} />{fieldErrors.password}</p>}
              </div>
              {error && <Alert className="flex items-start gap-2 border-rose-200 bg-rose-50 text-rose-800"><AlertCircle size={17} className="mt-0.5 shrink-0" />{error}</Alert>}
              <Button type="submit" size="lg" disabled={loading} className="mt-1 h-12 w-full rounded-xl text-sm font-extrabold shadow-lg shadow-blue-900/15">{loading ? <><Loader2 size={17} className="animate-spin" /> Signing in…</> : <>{submitLabel}<ArrowRight size={17} /></>}</Button>
            </form>

            {demoCredentials && <div className="mt-7 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-background)] p-4 text-xs"><p className="font-extrabold uppercase tracking-wider text-[var(--color-text-secondary)]">Demo credentials</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><div><span className="text-[var(--color-text-secondary)]">Email</span><p className="mt-1 break-all font-bold text-[var(--color-text-primary)]">{demoCredentials.email}</p></div><div><span className="text-[var(--color-text-secondary)]">Password</span><p className="mt-1 font-bold text-[var(--color-text-primary)]">{demoCredentials.password}</p></div></div></div>}
            <p className="mt-7 text-center text-sm text-[var(--color-text-secondary)]">{mode === "staff" ? "Customer?" : "Don’t have an account?"}{" "}<Link href={registerHref} className="font-extrabold text-[var(--color-primary)] hover:underline">{mode === "staff" ? "Use customer sign in" : registerLabel}</Link></p>
          </div>
        </section>
      </div>
    </main>
  );
}
