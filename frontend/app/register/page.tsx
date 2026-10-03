"use client";

import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  Loader2,
  MapPin,
  UserRoundPlus,
} from "lucide-react";
import { useState } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  registerCustomer,
  getPublicBranches,
  type PublicBranch,
  verifyPan,
} from "@/services/api";
import { resumePendingGuestAction } from "@/lib/pending-guest-action";

const provinces = [
  "Koshi",
  "Madhesh",
  "Bagmati",
  "Gandaki",
  "Lumbini",
  "Karnali",
  "Sudurpashchim",
];
const districts: Record<string, string[]> = {
  Koshi: [
    "Bhojpur",
    "Dhankuta",
    "Ilam",
    "Jhapa",
    "Khotang",
    "Morang",
    "Okhaldhunga",
    "Panchthar",
    "Sankhuwasabha",
    "Solukhumbu",
    "Sunsari",
    "Taplejung",
    "Terhathum",
    "Udayapur",
  ],
  Madhesh: [
    "Bara",
    "Dhanusha",
    "Mahottari",
    "Parsa",
    "Rautahat",
    "Saptari",
    "Sarlahi",
    "Siraha",
  ],
  Bagmati: [
    "Bhaktapur",
    "Chitwan",
    "Dhading",
    "Dolakha",
    "Kathmandu",
    "Kavrepalanchok",
    "Lalitpur",
    "Makwanpur",
    "Nuwakot",
    "Ramechhap",
    "Rasuwa",
    "Sindhuli",
    "Sindhupalchok",
  ],
  Gandaki: [
    "Baglung",
    "Gorkha",
    "Kaski",
    "Lamjung",
    "Manang",
    "Mustang",
    "Myagdi",
    "Nawalpur",
    "Parbat",
    "Syangja",
    "Tanahun",
  ],
  Lumbini: [
    "Arghakhanchi",
    "Banke",
    "Bardiya",
    "Dang",
    "Gulmi",
    "Kapilvastu",
    "Palpa",
    "Pyuthan",
    "Rolpa",
    "Rukum East",
    "Rupandehi",
  ],
  Karnali: [
    "Dailekh",
    "Dolpa",
    "Humla",
    "Jajarkot",
    "Jumla",
    "Kalikot",
    "Mugu",
    "Rukum West",
    "Salyan",
    "Surkhet",
  ],
  Sudurpashchim: [
    "Achham",
    "Baitadi",
    "Bajhang",
    "Bajura",
    "Dadeldhura",
    "Darchula",
    "Doti",
    "Kailali",
    "Kanchanpur",
  ],
};
const municipalities: Record<string, string[]> = {
  Kathmandu: [
    "Kathmandu Metropolitan City",
    "Kageshwori Manohara",
    "Budhanilkantha",
    "Tokha",
    "Tarakeshwar",
    "Nagarjun",
    "Chandragiri",
    "Kirtipur",
    "Shankharapur",
    "Gokarneshwar",
  ],
  Lalitpur: [
    "Lalitpur Metropolitan City",
    "Godawari",
    "Mahalaxmi",
    "Konjyosom",
    "Bagmati",
    "Mahankal",
  ],
  Bhaktapur: [
    "Bhaktapur Municipality",
    "Madhyapur Thimi",
    "Suryabinayak",
    "Changunarayan",
  ],
};

type AccountType = "PERSONAL" | "PHARMACY";
type FormState = {
  accountType: AccountType;
  fullName: string;
  gender: string;
  dateOfBirth: string;
  username: string;
  phone: string;
  email: string;
  province: string;
  district: string;
  municipality: string;
  ward: string;
  deliveryAddress: string;
  panNumber: string;
  panRegisteredName: string;
  pharmacyName: string;
  drugLicenseNumber: string;
  ownerPhone: string;
  ownerEmail: string;
  contactPersonName: string;
  telephone: string;
  landmark: string;
  pharmacistRegistrationNumber: string;
  preferredBranchId: string;
  pharmacyCategory: "RETAIL" | "WHOLESALE";
  password: string;
  confirmPassword: string;
};
const initialForm: FormState = {
  accountType: "PERSONAL",
  fullName: "",
  gender: "",
  dateOfBirth: "",
  username: "",
  phone: "",
  email: "",
  province: "Bagmati",
  district: "Kathmandu",
  municipality: "Kathmandu Metropolitan City",
  ward: "",
  deliveryAddress: "",
  panNumber: "",
  panRegisteredName: "",
  pharmacyName: "",
  drugLicenseNumber: "",
  ownerPhone: "",
  ownerEmail: "",
  contactPersonName: "",
  telephone: "",
  landmark: "",
  pharmacistRegistrationNumber: "",
  preferredBranchId: "",
  pharmacyCategory: "RETAIL",
  password: "",
  confirmPassword: "",
};

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [branches, setBranches] = useState<PublicBranch[]>([]);
  const [panBusy, setPanBusy] = useState(false);
  const [panStatus, setPanStatus] = useState<{
    kind: "verified" | "manual" | "not-found";
    message: string;
  } | null>(null);
  useEffect(() => {
    getPublicBranches().then(setBranches).catch(() => setBranches([]));
  }, []);
  const update = (key: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: "" }));
  };
  const changeProvince = (value: string) =>
    setForm((current) => ({
      ...current,
      province: value,
      district: districts[value]?.[0] ?? "",
      municipality: "",
    }));
  const changeDistrict = (value: string) =>
    setForm((current) => ({
      ...current,
      district: value,
      municipality: municipalities[value]?.[0] ?? "Other municipality",
    }));

  function validateForm() {
    const next: Record<string, string> = {};
    const mobilePattern = /^(98|97)\d{8}$/;
    if (!form.fullName.trim() && form.accountType === "PERSONAL") next.fullName = "Full name is required.";
    if (!form.email.trim()) next.email = "Email address is required.";
    else if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = "Enter a valid email address.";
    if (!mobilePattern.test(form.phone.trim())) next.phone = "Use a valid Nepal mobile number: 98XXXXXXXX or 97XXXXXXXX.";
    if (!form.province) next.province = "Province is required.";
    if (!form.district) next.district = "District is required.";
    if (!form.municipality) next.municipality = "Municipality is required.";
    if (!form.ward.trim()) next.ward = "Ward is required.";
    if (!form.deliveryAddress.trim()) next.deliveryAddress = "Full address is required.";
    if (form.password.length < 8) next.password = "Password must be at least 8 characters.";
    if (form.password !== form.confirmPassword) next.confirmPassword = "Passwords do not match.";
    if (form.accountType === "PHARMACY") {
      if (!/^\d{9}$/.test(form.panNumber)) next.panNumber = "Enter a valid 9-digit PAN number.";
      if (!form.panRegisteredName.trim()) next.panRegisteredName = "Verify PAN or enter the registered name manually.";
      if (!form.pharmacyName.trim()) next.pharmacyName = "Pharmacy or trade name is required.";
      if (!form.drugLicenseNumber.trim()) next.drugLicenseNumber = "Drug/pharmacy license number is required.";
      if (!form.contactPersonName.trim()) next.contactPersonName = "Contact person name is required.";
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function checkPan() {
    const pan = form.panNumber.replace(/\D/g, "");
    if (pan.length !== 9) {
      setPanStatus({
        kind: "not-found",
        message: "Enter a valid 9-digit PAN before verifying.",
      });
      return;
    }
    setPanBusy(true);
    setError("");
    try {
      const result = await verifyPan(pan);
      if (result.status === "VERIFIED" && result.registeredName) {
        setForm((current) => ({
          ...current,
          panNumber: pan,
          panRegisteredName: result.registeredName ?? "",
          fullName: result.registeredName ?? current.fullName,
        }));
        setPanStatus({ kind: "verified", message: result.message });
      } else if (result.status === "MANUAL_FALLBACK") {
        setForm((current) => ({ ...current, panNumber: pan }));
        setPanStatus({
          kind: "manual",
          message: `${result.message} Enter the registered name manually to continue.`,
        });
      } else setPanStatus({ kind: "not-found", message: result.message });
    } catch (caught) {
      setPanStatus({
        kind: "manual",
        message:
          caught instanceof Error
            ? `${caught.message} Enter the registered name manually to continue.`
            : "IRD lookup is unavailable. Enter the registered name manually to continue.",
      });
    } finally {
      setPanBusy(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!validateForm()) {
      setError("Please fix the highlighted fields before continuing.");
      return;
    }
    setLoading(true);
    try {
      const response = await registerCustomer({
        ...form,
        email: form.email.trim(),
        phone: form.phone.trim(),
        username: form.username.trim() || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        ownerPhone: form.accountType === "PHARMACY" ? form.phone.trim() : undefined,
        ownerEmail: form.accountType === "PHARMACY" ? form.email.trim() : undefined,
      });
      localStorage.setItem("anhh-access-token", response.accessToken);
      localStorage.setItem("anhh-customer", JSON.stringify(response.customer));
      const resumed = await resumePendingGuestAction(response.accessToken);
      window.dispatchEvent(new Event("anhh-auth-changed"));
      toast.success(
        form.accountType === "PHARMACY"
          ? "Pharmacy account created"
          : "Account created",
      );
      const returnTo = new URLSearchParams(window.location.search).get(
        "returnTo",
      );
      router.push(resumed?.returnTo ?? (returnTo?.startsWith("/") ? returnTo : "/account"));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "We could not create your account.",
      );
    } finally {
      setLoading(false);
    }
  }

  function closeRegistration() {
    const requested = new URLSearchParams(window.location.search).get("cancelTo");
    let destination = "/";
    if (requested) {
      try {
        const safeUrl = new URL(requested, window.location.origin);
        if (safeUrl.origin === window.location.origin && safeUrl.pathname !== "/register") {
          destination = `${safeUrl.pathname}${safeUrl.search}${safeUrl.hash}`;
        }
      } catch {
        // Invalid return targets safely fall back to the storefront home.
      }
    }
    router.replace(destination);
  }

  const returnTo =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("returnTo")
      : null;
  const signInHref = returnTo?.startsWith("/")
    ? `/login?returnTo=${encodeURIComponent(returnTo)}`
    : "/login";
  const districtOptions = districts[form.province] ?? [];
  const municipalityOptions = municipalities[form.district] ?? [
    "Other municipality",
  ];
  const isPharmacy = form.accountType === "PHARMACY";

  return (
    <Dialog open onOpenChange={(open) => { if (!open) closeRegistration(); }}>
      <DialogContent
        className="flex h-[min(92dvh,900px)] max-h-[min(92dvh,900px)] max-w-4xl flex-col gap-0 overflow-hidden rounded-3xl border-slate-200 bg-white p-0 shadow-2xl"
      >
        <form id="account-registration-form" onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <DialogHeader className="shrink-0 border-b border-slate-200 bg-white px-5 py-5 sm:px-8 sm:py-6">
          <div className="flex items-start gap-3 pr-10">
            <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-[#003893]">
              {isPharmacy ? <Building2 size={20} /> : <UserRoundPlus size={20} />}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#003893]">Account registration</p>
              <DialogTitle className="mt-1 text-xl font-extrabold tracking-tight text-slate-950 sm:text-2xl">
                Create your {isPharmacy ? "pharmacy" : "personal use"} account
              </DialogTitle>
              <DialogDescription className="mt-1 max-w-2xl leading-5">
                Choose an account type and enter your details. Your information is used to set up ordering and delivery.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-8 sm:py-6">
          <div className="grid gap-2 sm:max-w-sm">
            <Label htmlFor="account-type">Choose account type</Label>
            <Select
              id="account-type"
              value={form.accountType}
              onChange={(event) => {
                update("accountType", event.target.value as AccountType);
                setPanStatus(null);
                setFieldErrors({});
              }}
            >
              <option value="PERSONAL">Personal Use</option>
              <option value="PHARMACY">Pharmacy</option>
            </Select>
            <p className="text-xs leading-5 text-slate-500">
              {isPharmacy
                ? "For retail pharmacies and wholesale distributors."
                : "For home and individual healthcare needs."}
            </p>
          </div>
          <div className="mt-6 grid gap-5 sm:gap-6">
            {isPharmacy ? (
              <>
                <div className="rounded-2xl border border-teal-100 bg-teal-50/70 p-4">
                  <Label htmlFor="pan-number">PAN number</Label>
                  <div className="mt-2 flex gap-2">
                    <Input
                      id="pan-number"
                      required
                      inputMode="numeric"
                      pattern="[0-9]{9}"
                      maxLength={9}
                      value={form.panNumber}
                      onChange={(event) => {
                        update(
                          "panNumber",
                          event.target.value.replace(/\D/g, ""),
                        );
                        setPanStatus(null);
                      }}
                      onBlur={() => {
                        if (form.panNumber.length === 9) void checkPan();
                      }}
                      placeholder="9-digit Nepal PAN"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={panBusy}
                      onClick={() => void checkPan()}
                    >
                      {panBusy ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : (
                        "Verify"
                      )}
                    </Button>
                  </div>
                  <ErrorText message={fieldErrors.panNumber} />
                  {panStatus && (
                    <p
                      className={`mt-2 flex items-start gap-2 text-xs font-semibold ${panStatus.kind === "verified" ? "text-emerald-700" : panStatus.kind === "manual" ? "text-amber-700" : "text-rose-700"}`}
                    >
                      {panStatus.kind === "verified" && (
                        <CheckCircle2 size={15} />
                      )}
                      {panStatus.message}
                    </p>
                  )}
                  <p className="mt-2 text-[11px] leading-5 text-slate-500">
                    Verification uses the official IRD PAN search. If IRD
                    requires CAPTCHA or is unavailable, enter the registered
                    name manually.
                  </p>
                </div>
                <div>
                  <Label htmlFor="pan-registered-name">
                    IRD registered name
                  </Label>
                  <Input
                    id="pan-registered-name"
                    required
                    value={form.panRegisteredName}
                    onChange={(event) =>
                      update("panRegisteredName", event.target.value)
                    }
                    className="mt-2"
                    placeholder="Registered business/person name"
                  />
                  <ErrorText message={fieldErrors.panRegisteredName} />
                </div>
                <div>
                  <Label htmlFor="pharmacy-name">Pharmacy / trade name</Label>
                  <Input
                    id="pharmacy-name"
                    required
                    value={form.pharmacyName}
                    onChange={(event) =>
                      update("pharmacyName", event.target.value)
                    }
                    className="mt-2"
                    placeholder="Trading name"
                  />
                  <ErrorText message={fieldErrors.pharmacyName} />
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field
                    id="contact-person-name"
                    label="Contact person name"
                    required
                    value={form.contactPersonName}
                    onChange={(value) => update("contactPersonName", value)}
                    placeholder="Owner or manager name"
                    error={fieldErrors.contactPersonName}
                  />
                  <Field
                    id="phone"
                    label="Contact person mobile"
                    required
                    value={form.phone}
                    onChange={(value) => update("phone", value)}
                    placeholder="98XXXXXXXX"
                    error={fieldErrors.phone}
                  />
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field
                    id="email"
                    label="Email address"
                    required
                    type="email"
                    value={form.email}
                    onChange={(value) => update("email", value)}
                    placeholder="business@example.com"
                    error={fieldErrors.email}
                  />
                  <Field
                    id="telephone"
                    label="Telephone number"
                    value={form.telephone}
                    onChange={(value) => update("telephone", value)}
                    placeholder="01-XXXXXXX (optional)"
                  />
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="drug-license">Drug license number</Label>
                    <Input
                      id="drug-license"
                      required
                      value={form.drugLicenseNumber}
                      onChange={(event) =>
                        update("drugLicenseNumber", event.target.value)
                      }
                      className="mt-2"
                    />
                    <ErrorText message={fieldErrors.drugLicenseNumber} />
                  </div>
                  <div>
                    <Label htmlFor="pharmacy-category">Pharmacy category</Label>
                    <Select
                      id="pharmacy-category"
                      value={form.pharmacyCategory}
                      onChange={(event) =>
                        update("pharmacyCategory", event.target.value)
                      }
                      className="mt-2"
                    >
                      <option value="RETAIL">Retail</option>
                      <option value="WHOLESALE">Wholesale</option>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field
                    id="pharmacist-registration"
                    label="Pharmacist registration/license"
                    value={form.pharmacistRegistrationNumber}
                    onChange={(value) => update("pharmacistRegistrationNumber", value)}
                    placeholder="Optional"
                  />
                  <div>
                    <Label htmlFor="preferred-branch">Preferred delivery branch</Label>
                    <Select
                      id="preferred-branch"
                      value={form.preferredBranchId}
                      onChange={(event) => update("preferredBranchId", event.target.value)}
                      className="mt-2"
                    >
                      <option value="">Choose later at checkout</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>{branch.name} · {branch.address}</option>
                      ))}
                    </Select>
                  </div>
                </div>
              </>
            ) : (
              <>
                <Field
                  id="full-name"
                  label="Full name"
                  required
                  value={form.fullName}
                  onChange={(value) => update("fullName", value)}
                  placeholder="Your full name"
                  error={fieldErrors.fullName}
                />
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field
                    id="phone"
                    label="Phone number"
                    required
                    value={form.phone}
                    onChange={(value) => update("phone", value)}
                    placeholder="98XXXXXXXX"
                    error={fieldErrors.phone}
                  />
                  <Field
                    id="email"
                    label="Email"
                    required
                    type="email"
                    value={form.email}
                    onChange={(value) => update("email", value)}
                    placeholder="you@example.com"
                    error={fieldErrors.email}
                  />
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="gender">Gender <span className="font-normal text-slate-400">(optional)</span></Label>
                    <Select id="gender" value={form.gender} onChange={(event) => update("gender", event.target.value)} className="mt-2">
                      <option value="">Prefer not to say</option>
                      <option value="FEMALE">Female</option>
                      <option value="MALE">Male</option>
                      <option value="OTHER">Other</option>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="date-of-birth">Date of birth <span className="font-normal text-slate-400">(optional)</span></Label>
                    <Input id="date-of-birth" type="date" value={form.dateOfBirth} onChange={(event) => update("dateOfBirth", event.target.value)} className="mt-2" />
                  </div>
                </div>
              </>
            )}
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                <MapPin size={17} className="text-teal-700" /> Delivery location
              </div>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                <div>
                  <Label htmlFor="province">Province</Label>
                  <Select
                    id="province"
                    required
                    value={form.province}
                    onChange={(event) => changeProvince(event.target.value)}
                    className="mt-2"
                  >
                    <option value="">Select province</option>
                    {provinces.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </Select>
                  <ErrorText message={fieldErrors.province} />
                </div>
                <div>
                  <Label htmlFor="district">District</Label>
                  <Select
                    id="district"
                    required
                    value={form.district}
                    onChange={(event) => changeDistrict(event.target.value)}
                    className="mt-2"
                  >
                    <option value="">Select district</option>
                    {districtOptions.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </Select>
                  <ErrorText message={fieldErrors.district} />
                </div>
                <div>
                  <Label htmlFor="municipality">Municipality</Label>
                  <Select
                    id="municipality"
                    required
                    value={form.municipality}
                    onChange={(event) =>
                      update("municipality", event.target.value)
                    }
                    className="mt-2"
                  >
                    <option value="">Select municipality</option>
                    {municipalityOptions.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </Select>
                  <ErrorText message={fieldErrors.municipality} />
                </div>
                <Field
                  id="ward"
                  label="Ward"
                  required
                  value={form.ward}
                  onChange={(value) => update("ward", value)}
                  placeholder="Ward number"
                  error={fieldErrors.ward}
                />
                <div className="sm:col-span-2">
                  <Label htmlFor="delivery-address">Full address</Label>
                  <textarea
                    id="delivery-address"
                    required
                    value={form.deliveryAddress}
                    onChange={(event) =>
                      update("deliveryAddress", event.target.value)
                    }
                    className="field mt-2 min-h-24 resize-y"
                    placeholder="Street, tole, landmark"
                  />
                  <ErrorText message={fieldErrors.deliveryAddress} />
                </div>
                <div className="sm:col-span-2">
                  <Field
                    id="landmark"
                    label="Landmark"
                    value={form.landmark}
                    onChange={(value) => update("landmark", value)}
                    placeholder="Nearby landmark (optional)"
                  />
                </div>
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                id="username"
                label="Username"
                value={form.username}
                onChange={(value) => update("username", value)}
                placeholder="Optional; email can be used to sign in"
              />
              <div className="flex items-end pb-2 text-xs leading-5 text-slate-500">
                You can sign in with your email{form.username ? " or username" : ""}.
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                id="password"
                label="Password"
                required
                type="password"
                value={form.password}
                onChange={(value) => update("password", value)}
                placeholder="At least 8 characters"
                error={fieldErrors.password}
              />
              <Field
                id="confirm-password"
                label="Confirm password"
                required
                type="password"
                value={form.confirmPassword}
                onChange={(value) => update("confirmPassword", value)}
                placeholder="Repeat your password"
                error={fieldErrors.confirmPassword}
              />
            </div>
            {error && (
              <p
                role="alert"
                className="rounded-xl bg-rose-50 p-3 text-xs font-semibold leading-5 text-rose-800"
              >
                {error}
              </p>
            )}
          </div>
        </div>
        <DialogFooter className="shrink-0 border-t border-slate-200 bg-white px-5 py-4 sm:px-8">
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-center text-xs text-slate-500 sm:text-left">
              Already registered?{" "}
              <Link href={signInHref} className="font-bold text-[#003893] hover:underline">Sign in</Link>
            </p>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
              <Button type="button" variant="outline" onClick={closeRegistration} disabled={loading} className="h-11 rounded-xl px-5">Cancel</Button>
              <Button type="submit" disabled={loading} className="h-11 min-w-36 rounded-xl bg-[#003893] px-5 font-bold text-white hover:bg-[#002b6f]">
                {loading ? <><Loader2 className="animate-spin" size={16} /> Creating…</> : isPharmacy ? "Create pharmacy account" : "Create account"}
              </Button>
            </div>
          </div>
        </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  required = false,
  type = "text",
  placeholder,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
  error?: string;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        required={required}
        type={type}
        minLength={type === "password" ? 8 : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2"
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
      />
      <ErrorText message={error} />
    </div>
  );
}

function ErrorText({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-xs font-semibold text-rose-700">{message}</p> : null;
}
