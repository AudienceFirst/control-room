"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import {
  UTM_CAMPAIGNS,
  UTM_SOURCES,
  UTM_MEDIUMS,
  UTM_TERMS,
  UTM_CONTENTS,
  NIEUWESTROOM_CAMPAIGN,
  type NieuwestroomFunnelData,
  type NieuwestroomUtmFilters,
  type UtmCampaign,
  type UtmSource,
  type UtmMedium,
  type UtmTerm,
  type UtmContent,
  type EnrichedFunnelStep,
  type FunnelDataSource,
} from "@/types/funnel";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  clientName: string;
  clientSlug: string;
  logoUrl: string | null;
  funnel: NieuwestroomFunnelData | null;
  activeFilters: NieuwestroomUtmFilters;
}

// ─── Filter option lists ──────────────────────────────────────────────────────

const CAMPAIGN_OPTIONS: { value: UtmCampaign; label: string }[] = [
  { value: "all", label: "Alle campagnes" },
  ...UTM_CAMPAIGNS.map((c) => ({ value: c as UtmCampaign, label: c })),
];

const SOURCE_OPTIONS: { value: UtmSource; label: string }[] = [
  { value: "all", label: "Alle bronnen" },
  ...UTM_SOURCES.map((s) => ({ value: s as UtmSource, label: s })),
];

const MEDIUM_OPTIONS: { value: UtmMedium; label: string }[] = [
  { value: "all", label: "Alle mediums" },
  ...UTM_MEDIUMS.map((m) => ({ value: m as UtmMedium, label: m })),
];

const TERM_OPTIONS: { value: UtmTerm; label: string }[] = [
  { value: "all", label: "Alle targeting" },
  ...UTM_TERMS.map((t) => ({ value: t as UtmTerm, label: t.replace(/_/g, " ") })),
];

const CONTENT_OPTIONS: { value: UtmContent; label: string }[] = [
  { value: "all", label: "Alle varianten" },
  ...UTM_CONTENTS.map((c) => ({ value: c as UtmContent, label: c.replace(/_/g, " ") })),
];

// ─── Colour helpers ───────────────────────────────────────────────────────────

const SOURCE_COLORS: Record<FunnelDataSource, { bar: string; badge: string; label: string; dot: string }> = {
  ad_platform: {
    bar: "bg-violet-500",
    badge: "bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/30",
    label: "AD PLATFORM",
    dot: "bg-violet-400",
  },
  ga4: {
    bar: "bg-blue-500",
    badge: "bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30",
    label: "GOOGLE ANALYTICS 4",
    dot: "bg-blue-400",
  },
  hubspot: {
    bar: "bg-emerald-500",
    badge: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
    label: "HUBSPOT CRM",
    dot: "bg-emerald-400",
  },
};

function conversionColor(pct: number | null): string {
  if (pct === null) return "text-zinc-500";
  if (pct >= 80) return "text-emerald-400";
  if (pct >= 50) return "text-blue-400";
  if (pct >= 20) return "text-amber-400";
  return "text-red-400";
}

// ─── Number formatters ────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  return n.toLocaleString("nl-NL");
}

function fmtEur(n: number): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function fmtPct(n: number | null): string {
  if (n === null) return "—";
  return `${n.toFixed(1)}%`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const isActive = value !== "all";
  return (
    <div className="flex flex-col gap-1">
      <label className={`text-[10px] font-semibold uppercase tracking-widest ${isActive ? "text-blue-400" : "text-zinc-500"}`}>
        {label}
        {isActive && <span className="ml-1 text-blue-400">●</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className={`rounded-lg border px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-[180px] bg-zinc-800/80 ${
          isActive ? "border-blue-500/60" : "border-zinc-700"
        }`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-300 ring-1 ring-blue-500/20">
      <code className="font-mono">{label}</code>
      <button onClick={onRemove} className="ml-0.5 opacity-60 hover:opacity-100" aria-label="verwijder filter">
        ×
      </button>
    </span>
  );
}

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-5">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">{label}</p>
      <p className={`font-mono text-3xl font-bold tabular-nums ${accent ?? "text-white"}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-zinc-600">{sub}</p>}
    </div>
  );
}

function SectionDivider({ source }: { source: FunnelDataSource }) {
  const c = SOURCE_COLORS[source];
  return (
    <div className="flex items-center gap-3 py-1">
      <span className={`inline-block h-2 w-2 rounded-full ${c.dot}`} />
      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{c.label}</span>
      <div className="h-px flex-1 bg-zinc-800" />
    </div>
  );
}

function FunnelStep({
  step,
  maxValue,
  isLast,
}: {
  step: EnrichedFunnelStep;
  maxValue: number;
  isLast: boolean;
}) {
  const c = SOURCE_COLORS[step.dataSource];
  const widthPct = maxValue > 0 ? Math.max((step.value / maxValue) * 100, 0.5) : 0;

  return (
    <div>
      {/* Step row */}
      <div className="group flex items-center gap-4 rounded-lg px-3 py-2.5 transition-colors hover:bg-zinc-800/40">
        {/* Order badge */}
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-800 font-mono text-xs font-semibold text-zinc-400">
          {step.order}
        </span>

        {/* Label + bar */}
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 truncate text-sm text-zinc-300">{step.label}</p>
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-800">
              <div
                className={`h-full rounded-full transition-all duration-500 ${c.bar}`}
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Value */}
        <span className="shrink-0 font-mono text-base font-semibold tabular-nums text-white">
          {fmtNum(step.value)}
        </span>
      </div>

      {/* Conversion connector (between steps) */}
      {!isLast && (
        <div className="ml-[52px] flex items-center gap-2 py-0.5">
          <div className="h-4 w-px bg-zinc-800" />
          <span
            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-xs font-medium tabular-nums ${
              step.conversionFromPrevious !== null
                ? `${conversionColor(step.conversionFromPrevious)} bg-zinc-800/60`
                : "text-zinc-700"
            }`}
          >
            {step.order < step.order + 1 && step.conversionFromPrevious !== null && (
              <svg className="h-3 w-3 shrink-0" viewBox="0 0 12 12" fill="none">
                <path d="M6 2v8M3 7l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function NieuwestroomFunnelView({
  clientName,
  clientSlug,
  logoUrl,
  funnel,
  activeFilters,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "all") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  // Group steps by data source for section dividers
  const steps = funnel?.steps ?? [];
  const maxValue = steps.length > 0 ? Math.max(...steps.map((s) => s.value)) : 1;

  // Determine which source-section headers we've already rendered
  const renderedSections = new Set<FunnelDataSource>();

  const stepsWithSections: Array<{ step: EnrichedFunnelStep; showSection: boolean }> = steps.map(
    (step) => {
      const showSection = !renderedSections.has(step.dataSource);
      renderedSections.add(step.dataSource);
      return { step, showSection };
    }
  );

  const anyFilterActive =
    activeFilters.utmCampaign !== "all" ||
    activeFilters.utmSource !== "all" ||
    activeFilters.utmMedium !== "all" ||
    activeFilters.utmTerm !== "all" ||
    activeFilters.utmContent !== "all";

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* ── Header ── */}
      <header className="border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-screen-xl items-center justify-between gap-4 px-6 py-4 lg:px-10">
          <div className="flex items-center gap-4">
            {logoUrl && (
              <img src={logoUrl} alt="" className="h-8 w-auto object-contain opacity-80" />
            )}
            <div>
              <h1 className="text-base font-semibold leading-none text-white">{clientName}</h1>
              <p className="mt-0.5 text-xs text-zinc-500">
                Conversiefunnel
                {activeFilters.utmCampaign !== "all" && (
                  <span className="text-zinc-400"> · {activeFilters.utmCampaign}</span>
                )}
              </p>
            </div>
          </div>
          <a
            href={`/d/${clientSlug}`}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-500 hover:text-white"
          >
            ← Dashboard
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-screen-xl space-y-8 px-6 py-8 lg:px-10">

        {/* ── Filter bar ── */}
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="mb-4 flex items-center gap-2">
            <svg className="h-4 w-4 text-zinc-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L13 10.414V15a1 1 0 01-.553.894l-4 2A1 1 0 017 17v-6.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
            </svg>
            <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
              Globale UTM-filters
            </span>
            {anyFilterActive && (
              <button
                onClick={() => router.push(pathname)}
                className="ml-auto rounded px-2 py-0.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
              >
                Wis filters
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-4">
            <FilterSelect
              label="utm_campaign"
              value={activeFilters.utmCampaign}
              options={CAMPAIGN_OPTIONS}
              onChange={(v) => updateFilter("campaign", v)}
            />
            <FilterSelect
              label="utm_source"
              value={activeFilters.utmSource}
              options={SOURCE_OPTIONS}
              onChange={(v) => updateFilter("source", v)}
            />
            <FilterSelect
              label="utm_medium"
              value={activeFilters.utmMedium}
              options={MEDIUM_OPTIONS}
              onChange={(v) => updateFilter("medium", v)}
            />
            <FilterSelect
              label="utm_term (targeting)"
              value={activeFilters.utmTerm}
              options={TERM_OPTIONS}
              onChange={(v) => updateFilter("term", v)}
            />
            <FilterSelect
              label="utm_content (variant)"
              value={activeFilters.utmContent}
              options={CONTENT_OPTIONS}
              onChange={(v) => updateFilter("content", v)}
            />
          </div>

          {anyFilterActive && (
            <div className="mt-4 flex flex-wrap gap-2">
              {activeFilters.utmCampaign !== "all" && (
                <FilterChip
                  label={`campaign: ${activeFilters.utmCampaign}`}
                  onRemove={() => updateFilter("campaign", "all")}
                />
              )}
              {activeFilters.utmSource !== "all" && (
                <FilterChip
                  label={`source: ${activeFilters.utmSource}`}
                  onRemove={() => updateFilter("source", "all")}
                />
              )}
              {activeFilters.utmMedium !== "all" && (
                <FilterChip
                  label={`medium: ${activeFilters.utmMedium}`}
                  onRemove={() => updateFilter("medium", "all")}
                />
              )}
              {activeFilters.utmTerm !== "all" && (
                <FilterChip
                  label={`term: ${activeFilters.utmTerm.replace(/_/g, " ")}`}
                  onRemove={() => updateFilter("term", "all")}
                />
              )}
              {activeFilters.utmContent !== "all" && (
                <FilterChip
                  label={`content: ${activeFilters.utmContent.replace(/_/g, " ")}`}
                  onRemove={() => updateFilter("content", "all")}
                />
              )}
            </div>
          )}
        </section>

        {funnel === null ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-10 text-center">
            <p className="text-sm text-zinc-500">
              Funneldata kon niet worden geladen. Controleer of GA4 en HubSpot zijn verbonden.
            </p>
          </div>
        ) : (
          <>
            {/* ── KPI Cards ── */}
            <section>
              <h2 className="mb-4 text-[11px] font-bold uppercase tracking-widest text-zinc-500">
                Campagne KPIs · laatste 30 dagen
              </h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <KpiCard
                  label="Bezoekers landingspagina"
                  value={fmtNum(funnel.steps.find((s) => s.order === 1)?.value ?? 0)}
                  sub="Unieke gebruikers · GA4"
                  accent="text-blue-300"
                />
                <KpiCard
                  label="Bestellingen geplaatst"
                  value={fmtNum(funnel.steps.find((s) => s.order === 9)?.value ?? 0)}
                  sub="Bereikten TYP · GA4"
                  accent="text-blue-300"
                />
                <KpiCard
                  label="Klanten (HubSpot)"
                  value={fmtNum(funnel.kpis.totalKlanten)}
                  sub="Lifecycle stage = klant"
                  accent="text-emerald-300"
                />
              </div>
            </section>

            {/* ── Funnel ── */}
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
                  Conversiefunnel — 10 stappen
                </h2>
                <div className="flex items-center gap-4 text-[10px] text-zinc-600">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-blue-400" />
                    GA4
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                    HubSpot
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                <div className="space-y-0">
                  {stepsWithSections.map(({ step, showSection }, idx) => (
                    <div key={step.order}>
                      {showSection && (
                        <div className={idx > 0 ? "mt-6 mb-2" : "mb-2"}>
                          <SectionDivider source={step.dataSource} />
                        </div>
                      )}
                      <FunnelStep
                        step={step}
                        maxValue={maxValue}
                        isLast={idx === stepsWithSections.length - 1}
                      />
                      {/* Conversion rate shown BETWEEN steps */}
                      {idx < stepsWithSections.length - 1 && step.value > 0 && (
                        <ConversionConnector
                          nextStep={stepsWithSections[idx + 1].step}
                        />
                      )}
                    </div>
                  ))}
                </div>

                {/* Summary table */}
                <div className="mt-8 border-t border-zinc-800 pt-6">
                  <h3 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                    Overzicht drop-off
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-800 text-left text-[10px] uppercase tracking-wider text-zinc-600">
                          <th className="pb-2 pr-4 font-semibold">#</th>
                          <th className="pb-2 pr-4 font-semibold">Stap</th>
                          <th className="pb-2 pr-4 text-right font-semibold">Gebruikers</th>
                          <th className="pb-2 pr-4 text-right font-semibold">Conv. vorige</th>
                          <th className="pb-2 text-right font-semibold">Conv. stap 1</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60">
                        {funnel.steps.map((step) => {
                          const step1Value = funnel.steps[0]?.value ?? 0;
                          const convFromFirst =
                            step1Value > 0 && step.order > 1
                              ? Math.round((step.value / step1Value) * 1000) / 10
                              : null;
                          return (
                            <tr key={step.order} className="group hover:bg-zinc-800/30">
                              <td className="py-2 pr-4 font-mono text-xs text-zinc-600">{step.order}</td>
                              <td className="py-2 pr-4 text-zinc-300">{step.label}</td>
                              <td className="py-2 pr-4 text-right font-mono font-semibold tabular-nums text-white">
                                {fmtNum(step.value)}
                              </td>
                              <td className={`py-2 pr-4 text-right font-mono tabular-nums ${conversionColor(step.conversionFromPrevious)}`}>
                                {fmtPct(step.conversionFromPrevious)}
                              </td>
                              <td className={`py-2 text-right font-mono tabular-nums ${conversionColor(convFromFirst)}`}>
                                {step.order === 1 ? "—" : fmtPct(convFromFirst)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </section>

            {/* ── Data source notes ── */}
            <section className="rounded-xl border border-zinc-800/40 bg-zinc-900/40 p-5">
              <h3 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                Databronnen & UTM-mapping
              </h3>
              <div className="grid gap-3 text-xs text-zinc-500 sm:grid-cols-3">
                <div>
                  <span className="mb-1 block font-semibold text-violet-400">Ad Platform (mock)</span>
                  <p>Impressies, kliks en spend uit gesimuleerde campagnedata. Koppel Google Ads, LinkedIn Marketing API of Meta Marketing API om live data te tonen.</p>
                </div>
                <div>
                  <span className="mb-1 block font-semibold text-blue-400">Google Analytics 4</span>
                  <p>
                    Unieke actieve gebruikers gefilterd op{" "}
                    <code className="rounded bg-zinc-800 px-1 text-zinc-300">sessionCampaignName</code>,{" "}
                    <code className="rounded bg-zinc-800 px-1 text-zinc-300">sessionSource</code>,{" "}
                    <code className="rounded bg-zinc-800 px-1 text-zinc-300">sessionMedium</code>,{" "}
                    <code className="rounded bg-zinc-800 px-1 text-zinc-300">sessionManualTerm</code> en{" "}
                    <code className="rounded bg-zinc-800 px-1 text-zinc-300">sessionManualAdContent</code>.
                  </p>
                </div>
                <div>
                  <span className="mb-1 block font-semibold text-emerald-400">HubSpot CRM</span>
                  <p>
                    Contactpersonen met lifecycle stage ={" "}
                    <code className="rounded bg-zinc-800 px-1 text-zinc-300">klant</code>. UTM-filtering binnen HubSpot vereist custom contactproperties (bijv.{" "}
                    <code className="rounded bg-zinc-800 px-1 text-zinc-300">utm_campaign__c</code>).
                  </p>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="mt-8 border-t border-zinc-900 py-6 text-center text-xs text-zinc-700">
        Powered by ZUID · {NIEUWESTROOM_CAMPAIGN} · data laatste 30 dagen
      </footer>
    </div>
  );
}

// ─── Conversion Connector ─────────────────────────────────────────────────────

function ConversionConnector({ nextStep }: { nextStep: EnrichedFunnelStep }) {
  const pct = nextStep.conversionFromPrevious;

  return (
    <div className="ml-[52px] flex items-center gap-2 py-0.5">
      <div className="flex flex-col items-center">
        <div className="h-2 w-px bg-zinc-800" />
        <div className="h-2 w-px bg-zinc-800" />
      </div>
      <span
        className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-xs font-semibold tabular-nums ${
          pct !== null
            ? `${conversionColor(pct)} bg-zinc-800/80`
            : "text-zinc-700 bg-zinc-800/40"
        }`}
      >
        {pct !== null ? (
          <>
            <svg className="h-3 w-3 shrink-0 opacity-60" viewBox="0 0 12 12" fill="none">
              <path d="M6 1v10M3 8l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {fmtPct(pct)} converteert
          </>
        ) : (
          "—"
        )}
      </span>
    </div>
  );
}
