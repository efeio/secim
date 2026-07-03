"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import dynamic from "next/dynamic";
import TurkeyMap from "@/components/TurkeyMap";
import Ticker from "@/components/Ticker";
import Clock from "@/components/Clock";
import TopRegions from "@/components/TopRegions";
import ColorDot from "@/components/ColorDot";
import { getCandidateColor } from "@/lib/colors";
import { provinces } from "@/lib/provinces";
import { supportedCountries } from "@/lib/maps/index";
import type { Region } from "@/lib/regions/index";

const CountryMap = dynamic(() => import("@/components/CountryMap"), { ssr: false });

interface Candidate {
  id: string;
  name: string;
  color: string;
  color2: string | null;
  photo_url: string | null;
}

interface CandidateResult {
  candidate_id: string;
  name: string;
  color: string;
  color2: string | null;
  photo_url: string | null;
  votes: number;
}

interface ProvinceResult {
  province_code: string;
  leader_candidate_id: string | null;
  leader_color: string | null;
  counts: Record<string, number>;
  total: number;
}

interface PollDetail {
  active: boolean;
  poll: {
    id: string;
    title: string;
    country: string;
    status: string;
    candidates: Candidate[];
    ended_at: string | null;
  };
  candidateResults: CandidateResult[];
  provinceResults: ProvinceResult[];
  totalVotes: number;
}

interface MapData {
  paths: Record<string, string>;
  viewBox: string;
}

export default function ArchiveDetailPage() {
  const params = useParams();
  const [data, setData] = useState<PollDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [regions, setRegions] = useState<Region[]>([]);
  const [mapData, setMapData] = useState<MapData | null>(null);

  useEffect(() => {
    if (!params.id) return;
    fetch(`/api/votes?poll_id=${params.id}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.id]);

  useEffect(() => {
    if (!data?.poll?.country) return;
    const country = data.poll.country;
    if (country === "tr") {
      setTimeout(() => {
        setRegions(provinces);
        setMapData(null);
      }, 0);
      return;
    }
    import(`@/lib/regions/${country}.ts`).then((mod) => {
      const key = Object.keys(mod).find((k) => Array.isArray(mod[k]));
      setRegions(key ? mod[key] : []);
    }).catch(() => setRegions([]));
    import(`@/lib/maps/${country}.ts`).then((mod) => {
      const pathsKey = Object.keys(mod).find((k) => k.endsWith("Paths"));
      const paths = pathsKey ? mod[pathsKey] : {};
      const viewBox = mod.SVG_VIEWBOX || "0 0 1000 1000";
      setMapData({ paths, viewBox });
    }).catch(() => setMapData(null));
  }, [data?.poll?.country]);

  const regionMap = useMemo(() => new Map(regions.map((r) => [r.code, r])), [regions]);

  if (loading) {
    return (
      <main className="h-screen flex items-center justify-center" style={{ background: "var(--bg-base)" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-48 h-4 rounded shimmer-loading" />
          <div className="w-32 h-3 rounded shimmer-loading" />
        </div>
      </main>
    );
  }

  if (!data?.poll) {
    return (
      <main className="h-screen flex items-center justify-center" style={{ background: "var(--bg-base)" }}>
        <div className="text-center">
          <p className="text-lg mb-4" style={{ color: "var(--text-tertiary)" }}>Oylama bulunamadı.</p>
          <Link href="/archive" className="text-sm font-medium transition-colors hover:opacity-80" style={{ color: "var(--text-secondary)" }}>
            Arşive dön
          </Link>
        </div>
      </main>
    );
  }

  const { poll, candidateResults, provinceResults, totalVotes } = data;
  const isTurkey = poll.country === "tr";
  const countryInfo = supportedCountries.find((c) => c.code === poll.country) || { name: poll.country, flag: "🌐", code: poll.country };

  const mappedCandidates = poll.candidates.map((c) => ({
    ...c,
    color: getCandidateColor(c.name, c.color),
  }));

  const mappedResults = candidateResults.map((cr) => ({
    ...cr,
    color: getCandidateColor(cr.name, cr.color),
  }));

  const mappedProvinceResults = provinceResults.map((pr) => ({
    ...pr,
    leader_color: pr.leader_candidate_id
      ? getCandidateColor(
          candidateResults.find((cr) => cr.candidate_id === pr.leader_candidate_id)?.name || "",
          pr.leader_color || ""
        )
      : pr.leader_color,
  }));

  const mappedSorted = [...mappedResults].sort((a, b) => b.votes - a.votes);
  const mappedWinner = mappedSorted[0];

  return (
    <main className="h-screen text-white flex flex-col overflow-hidden md:overflow-hidden overflow-y-auto font-sans" style={{ background: "var(--bg-base)" }}>
      {/* Top Ticker */}
      <div
        className="flex items-center h-[38px] shrink-0"
        style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border-subtle)" }}
      >
        <div
          className="px-4 h-full flex items-center gap-2.5 shrink-0"
          style={{ borderRight: "1px solid var(--border-subtle)" }}
        >
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>ARŞİV</span>
        </div>
        <div className="flex-1 overflow-hidden h-full flex items-center">
          <Ticker provinceResults={mappedProvinceResults} candidates={mappedCandidates} regions={regions} />
        </div>
        <div className="px-4 h-full flex items-center gap-3 shrink-0" style={{ borderLeft: "1px solid var(--border-subtle)" }}>
          <Clock compact />
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Sidebar */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="w-full md:w-[320px] shrink-0 flex flex-col md:overflow-y-auto scrollbar-thin"
          style={{ background: "var(--bg-surface)", borderRight: "1px solid var(--border-subtle)" }}
        >
          {/* Title */}
          <div className="px-5 pt-5 pb-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">{countryInfo.flag}</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: "var(--bg-overlay)", border: "1px solid var(--border-default)" }}>
                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Sonuçlandı</span>
              </span>
            </div>
            <h1 className="text-lg font-bold leading-tight" style={{ color: "var(--text-primary)" }}>{poll.title}</h1>
            {poll.ended_at && (
              <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                {new Date(poll.ended_at + "Z").toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            )}
          </div>

          {/* Winner */}
          <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <p className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: "var(--text-tertiary)" }}>Kazanan</p>
            <p className="text-base font-bold" style={{ color: mappedWinner?.color }}>{mappedWinner?.name}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] font-medium tabular-nums" style={{ color: "var(--text-muted)" }}>
                {totalVotes.toLocaleString("tr-TR")} toplam oy
              </span>
            </div>
          </div>

          {/* Candidates */}
          <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <div className="space-y-2.5">
              {mappedSorted.map((cr, idx) => {
                const pct = totalVotes > 0 ? ((cr.votes / totalVotes) * 100) : 0;
                return (
                  <motion.div
                    key={cr.candidate_id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.08, duration: 0.3 }}
                    className="candidate-card rounded-xl p-3.5"
                    style={{
                      background: `color-mix(in oklch, ${cr.color} 6%, var(--bg-elevated))`,
                      border: `1px solid color-mix(in oklch, ${cr.color} 20%, transparent)`,
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold" style={{ color: cr.color }}>{cr.name}</span>
                      {idx === 0 && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: `color-mix(in oklch, ${cr.color} 15%, transparent)`, color: cr.color }}>KAZANAN</span>
                      )}
                    </div>
                    <div className="flex items-end justify-between">
                      <span className="text-2xl font-black tabular-nums leading-none" style={{ color: cr.color }}>
                        %{pct.toFixed(1)}
                      </span>
                      <span className="text-[10px] tabular-nums" style={{ color: "var(--text-muted)" }}>
                        {cr.votes.toLocaleString("tr-TR")} oy
                      </span>
                    </div>
                    <div className="mt-2.5 h-1 rounded-full overflow-hidden" style={{ background: "var(--border-subtle)" }}>
                      <motion.div
                        className="h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: idx * 0.1 }}
                        style={{ background: cr.color }}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Navigation */}
          <div className="px-5 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <Link href="/archive" className="text-[11px] font-medium transition-colors hover:opacity-80" style={{ color: "var(--text-secondary)" }}>
              Tüm Arşiv
            </Link>
            <span style={{ color: "var(--text-muted)" }}>|</span>
            <Link href="/" className="text-[11px] font-medium transition-colors hover:opacity-80" style={{ color: "var(--text-secondary)" }}>
              Canlı Oylama
            </Link>
          </div>

          {/* En Güçlü Bölgeler */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-5 py-2.5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>EN GÜÇLÜ BÖLGELER</span>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-3">
              <TopRegions provinceResults={mappedProvinceResults} candidates={mappedCandidates} regionMap={regionMap} />
            </div>
          </div>
        </motion.div>

        {/* Map */}
        <div className="flex-1 relative flex items-center justify-center min-h-[50vh] md:min-h-0" style={{ background: "var(--bg-base)" }}>
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="absolute top-4 right-5 flex items-center gap-5 px-3 py-2 rounded-lg"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
          >
            {mappedCandidates.map((c) => (
              <span key={c.id} className="flex items-center gap-2">
                <ColorDot color={c.color} color2={c.color2} size="md" />
                <span className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>{c.name}</span>
              </span>
            ))}
          </motion.div>

          {isTurkey ? (
            <TurkeyMap provinceResults={mappedProvinceResults} candidates={mappedCandidates} />
          ) : mapData ? (
            <CountryMap
              paths={mapData.paths}
              viewBox={mapData.viewBox}
              regions={regions}
              provinceResults={mappedProvinceResults}
              candidates={mappedCandidates}
            />
          ) : (
            <div className="flex items-center justify-center">
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>Harita yükleniyor...</span>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
