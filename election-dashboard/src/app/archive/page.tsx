"use client";

import { useEffect, useState } from "react";
import { Archive, ChevronRight, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { supportedCountries } from "@/lib/maps/index";

interface Candidate {
  id: string;
  name: string;
  color: string;
}

interface PollSummary {
  id: string;
  title: string;
  country: string;
  status: string;
  created_at: string;
  ended_at: string | null;
  candidates: Candidate[];
  vote_count: number;
}

export default function ArchivePage() {
  const [polls, setPolls] = useState<PollSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/archive")
      .then((r) => r.json())
      .then((d) => setPolls(d.polls || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-base)" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-48 h-4 rounded shimmer-loading" />
          <div className="w-32 h-3 rounded shimmer-loading" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={{ background: "var(--bg-base)" }}>
      <div className="max-w-4xl mx-auto px-6 py-14">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
                <Archive className="w-5 h-5" style={{ color: "var(--text-tertiary)" }} />
              </div>
              <div>
                <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Geçmiş Oylamalar</h1>
                <p className="text-sm mt-0.5" style={{ color: "var(--text-tertiary)" }}>Sonuçlanmış oylamaların arşivi</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="text-sm font-medium transition-colors hover:opacity-80"
                style={{ color: "var(--text-secondary)" }}
              >
                Canlı Oylama
              </Link>
            </div>
          </div>

          {polls.length === 0 ? (
            <div className="text-center py-24">
              <BarChart3 className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
              <p style={{ color: "var(--text-tertiary)" }}>Henüz tamamlanmış oylama yok.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {polls.map((poll, idx) => (
                <motion.div
                  key={poll.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.06, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Link
                    href={`/archive/${poll.id}`}
                    className="block p-5 rounded-xl transition-all group"
                    style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-base">{supportedCountries.find((c) => c.code === poll.country)?.flag || "🌐"}</span>
                          <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>{poll.title}</h2>
                        </div>
                        <div className="flex items-center gap-4 text-xs" style={{ color: "var(--text-tertiary)" }}>
                          <span className="tabular-nums">{poll.vote_count.toLocaleString("tr-TR")} toplam oy</span>
                          {poll.ended_at && (
                            <span>
                              {new Date(poll.ended_at + "Z").toLocaleDateString("tr-TR", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                          {poll.candidates.map((c) => (
                            <span
                              key={c.id}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium"
                              style={{ backgroundColor: `color-mix(in oklch, ${c.color} 10%, transparent)`, color: c.color }}
                            >
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                              {c.name}
                            </span>
                          ))}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-0.5" style={{ color: "var(--text-muted)" }} />
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </main>
  );
}
