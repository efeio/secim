"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Radio, Users, TrendingUp, BarChart3 } from "lucide-react";
import Link from "next/link";
import Clock from "@/components/Clock";
import MiniMap from "@/components/MiniMap";
import ColorDot from "@/components/ColorDot";
import { supportedCountries } from "@/lib/maps/index";

interface PollCandidate {
  candidate_id: string;
  name: string;
  color: string;
  color2: string | null;
  votes: number;
}

interface PollSummary {
  id: string;
  title: string;
  country: string;
  totalVotes: number;
  candidates: PollCandidate[];
  leader: { name: string; color: string; pct: string } | null;
}

export default function Home() {
  const [polls, setPolls] = useState<PollSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPolls() {
      try {
        const res = await fetch("/api/polls");
        if (res.ok) {
          const data = await res.json();
          setPolls(data);
        }
      } finally {
        setLoading(false);
      }
    }
    fetchPolls();
    const interval = setInterval(fetchPolls, 5000);
    return () => clearInterval(interval);
  }, []);

  function getCountryInfo(code: string) {
    return supportedCountries.find((c) => c.code === code) || { name: code, flag: "🌐", regionLabel: "Region" };
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass"
        style={{ borderBottom: "1px solid var(--glass-border)" }}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--bg-overlay)", border: "1px solid var(--border-subtle)" }}>
              <span className="text-xs font-black" style={{ color: "var(--text-secondary)" }}>K</span>
            </div>
            <div>
              <h1 className="text-sm font-bold">Seçim Takip Merkezi</h1>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Canlı Oylama Paneli</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-pulse-live absolute inline-flex h-full w-full rounded-full" style={{ background: "var(--accent-live)" }} />
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "var(--accent-live)" }} />
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--accent-live)" }}>
                {polls.length} Aktif Oylama
              </span>
            </div>
            <Clock compact />
          </div>
        </div>
      </motion.header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
            >
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl h-65 animate-pulse" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }} />
              ))}
            </motion.div>
          ) : polls.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-center py-20"
            >
              <BarChart3 className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
              <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Aktif oylama bulunmuyor</p>
              <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>Admin panelinden yeni oylama başlatın</p>
              <Link
                href="/archive"
                className="inline-block mt-6 text-xs font-medium underline underline-offset-4 transition-opacity hover:opacity-70"
                style={{ color: "var(--text-tertiary)" }}
              >
                Geçmiş oylamaları görüntüle
              </Link>
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
            >
              {polls.map((poll, idx) => {
                const country = getCountryInfo(poll.country);
                const totalVotes = poll.totalVotes;

                return (
                  <motion.div
                    key={poll.id}
                    initial={{ opacity: 0, y: 20, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: idx * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Link href={`/poll/${poll.id}`} className="block h-full">
                      <div
                        className="rounded-2xl p-5 h-full glass group cursor-pointer relative overflow-hidden"
                        style={{
                          border: poll.leader ? `1px solid color-mix(in oklch, ${poll.leader.color} 20%, transparent)` : "1px solid var(--glass-border)",
                          transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)";
                          (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-elevated)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                          (e.currentTarget as HTMLElement).style.boxShadow = "";
                        }}
                      >
                        {/* Mini Map Background */}
                        <div className="absolute top-2 right-2 w-25 h-17.5 opacity-30 pointer-events-none">
                          <MiniMap country={poll.country} candidates={poll.candidates} leader={poll.leader} />
                        </div>
                        {/* Card Header */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-2.5">
                            <span className="text-xl">{country.flag}</span>
                            <div>
                              <h3 className="text-[13px] font-bold leading-tight" style={{ color: "var(--text-primary)" }}>
                                {poll.title}
                              </h3>
                              <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                                {country.name}
                              </p>
                            </div>
                          </div>
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: "oklch(0.3 0.12 25 / 0.25)", border: "1px solid oklch(0.5 0.15 25 / 0.3)" }}>
                            <span className="w-1 h-1 rounded-full animate-pulse-live" style={{ background: "var(--accent-live)" }} />
                            <span className="text-[8px] font-bold uppercase" style={{ color: "var(--accent-live)" }}>Canlı</span>
                          </span>
                        </div>

                        {/* Leader */}
                        {poll.leader && (
                          <div className="mb-4">
                            <p className="text-[9px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-tertiary)" }}>Lider</p>
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: poll.leader.color }} />
                              <span className="text-sm font-bold" style={{ color: poll.leader.color }}>{poll.leader.name}</span>
                              <span className="text-xs font-black tabular-nums" style={{ color: poll.leader.color }}>%{poll.leader.pct}</span>
                            </div>
                          </div>
                        )}

                        {/* Progress bars */}
                        <div className="space-y-1.5 mb-4">
                          {poll.candidates.slice(0, 4).map((c) => {
                            const pct = totalVotes > 0 ? (c.votes / totalVotes) * 100 : 0;
                            return (
                              <div key={c.candidate_id} className="flex items-center gap-2">
                                <span className="text-[10px] w-16 truncate" style={{ color: "var(--text-secondary)" }}>{c.name}</span>
                                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border-subtle)" }}>
                                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.color, transition: "width 0.5s ease" }} />
                                </div>
                                <span className="text-[9px] font-bold tabular-nums w-8 text-right" style={{ color: c.color }}>
                                  {pct > 0 ? `${pct.toFixed(0)}%` : "–"}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                          <div className="flex items-center gap-1.5">
                            <Users className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                            <span className="text-[10px] tabular-nums font-medium" style={{ color: "var(--text-secondary)" }}>
                              {totalVotes.toLocaleString("tr-TR")} oy
                            </span>
                          </div>
                          <div className="flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                            <TrendingUp className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Detay →</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
