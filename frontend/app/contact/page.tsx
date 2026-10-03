"use client";

import { CheckCircle2, ExternalLink, Mail, MapPin, Phone } from "lucide-react";
import { useState } from "react";
import { SiteFooter, SiteHeader } from "@/components/site-header";

const directionsUrl = "https://www.google.com/maps/place/All+Nepal+Healthy+Home+Pvt+Ltd/@27.7091197,85.3074236,50m/data=!3m1!1e3!4m10!1m2!2m1!1sall+nepal+healthy+home!3m6!1s0x39eb190399164027:0x337acb8d5e52c65a!8m2!3d27.7091852!4d85.3077905!15sChZhbGwgbmVwYWwgaGVhbHRoeSBob21lWhgiFmFsbCBuZXBhbCBoZWFsdGh5IGhvbWWSAQp3aG9sZXNhbGVy4AEA!16s%2Fg%2F11zh3pysh9?entry=ttu";
// Use a provider-neutral embed for the always-visible map preview. The Google
// Maps link below still opens the exact business listing and directions.
const mapEmbedUrl = "https://www.openstreetmap.org/export/embed.html?bbox=85.3045%2C27.7075%2C85.3110%2C27.7110&layer=mapnik&marker=27.7091852%2C85.3077905";

export default function ContactPage() {
  const [sent, setSent] = useState(false);
  return (
    <div className="min-h-screen bg-[#f8fbfa]">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-teal-700">We’re here for you</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight">Contact our team</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">Questions about a product, prescription or delivery? Visit our location, call us, or send the team a message.</p>

        <div className="mt-9 grid gap-8 lg:grid-cols-[0.72fr_1.28fr]">
          <div className="grid content-start gap-4">
            <div className="surface p-5">
              <Phone className="text-teal-700" size={20} aria-hidden="true" />
              <h2 className="mt-4 text-sm font-extrabold">Call us</h2>
              <a href="tel:01-5313958" className="mt-1 block text-sm text-slate-500 hover:text-teal-700">01-5313958 · 9851310286</a>
            </div>
            <div className="surface p-5">
              <Mail className="text-teal-700" size={20} aria-hidden="true" />
              <h2 className="mt-4 text-sm font-extrabold">Email</h2>
              <a href="mailto:hello@allnepalhealthyhome.com" className="mt-1 block break-all text-sm text-slate-500 hover:text-teal-700">hello@allnepalhealthyhome.com</a>
            </div>
            <div className="surface p-5">
              <MapPin className="text-teal-700" size={20} aria-hidden="true" />
              <h2 className="mt-4 text-sm font-extrabold">Visit our location</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">All Nepal Healthy Home Pvt Ltd<br />Kathmandu, Nepal</p>
              <a href={directionsUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[var(--color-primary)] hover:text-[var(--color-secondary)]">
                Open in Google Maps <ExternalLink size={14} />
              </a>
            </div>
          </div>

          <section className="surface overflow-hidden" aria-label="All Nepal Healthy Home map">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-lg font-extrabold">Find us on the map</h2>
                <p className="mt-1 text-xs text-slate-500">Our Kathmandu delivery and pharmacy location.</p>
              </div>
              <a href={directionsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]">
                <MapPin size={14} /> Get directions
              </a>
            </div>
            <div className="relative h-[310px] overflow-hidden bg-slate-100 sm:h-[390px]">
              <iframe title="All Nepal Healthy Home Pvt Ltd location" src={mapEmbedUrl} className="h-full w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
              <div className="pointer-events-none absolute bottom-4 left-4 max-w-[calc(100%-2rem)] rounded-xl border border-white/80 bg-white/95 px-4 py-3 shadow-lg backdrop-blur-sm">
                <p className="text-xs font-extrabold text-slate-900">All Nepal Healthy Home Pvt Ltd</p>
                <p className="mt-1 text-[11px] text-slate-500">Kathmandu, Nepal · 27.7091852, 85.3077905</p>
              </div>
            </div>
          </section>
        </div>

        <form onSubmit={(event) => { event.preventDefault(); setSent(true); }} className="surface mt-8 p-6 sm:p-8">
          <h2 className="text-xl font-extrabold">Send a message</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="text-xs font-bold text-slate-600">Your name<input required className="field mt-2" /></label>
            <label className="text-xs font-bold text-slate-600">Phone<input required className="field mt-2" /></label>
            <label className="text-xs font-bold text-slate-600 sm:col-span-2">Email<input type="email" required className="field mt-2" /></label>
            <label className="text-xs font-bold text-slate-600 sm:col-span-2">Message<textarea required className="field mt-2 min-h-32 resize-y" /></label>
          </div>
          {sent && <p className="mt-4 flex items-center gap-2 text-xs font-bold text-emerald-700"><CheckCircle2 size={16} /> Thanks—we’ll get back to you soon.</p>}
          <button className="primary-btn mt-6" type="submit">Send message</button>
        </form>
      </main>
      <SiteFooter />
    </div>
  );
}
