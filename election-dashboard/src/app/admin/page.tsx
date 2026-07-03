"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Lock,
  Shield,
  Plus,
  Trash2,
  Play,
  Square,
  Wifi,
  BarChart3,
  AlertTriangle,
  X,
  Palette,
  Eye,
  ChevronDown,
  MapPin,
  Globe,
  Trophy,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supportedCountries } from "@/lib/maps/index";
import type { Region } from "@/lib/regions/index";

interface Candidate {
  id: string;
  poll_id: string;
  name: string;
  color: string;
  photo_url: string | null;
}

interface Poll {
  id: string;
  title: string;
  country: string;
  status: "draft" | "active" | "ended";
  created_at: string;
  ended_at: string | null;
  candidates: Candidate[];
  vote_count: number;
}

interface CandidateResult {
  candidate_id: string;
  name: string;
  color: string;
  photo_url: string | null;
  votes: number;
}

interface AdminData {
  polls: Poll[];
  activePoll: (Poll & { candidates: Candidate[] }) | null;
  activeAnalytics: {
    candidateResults: CandidateResult[];
    provinceResults: { province_code: string; leader_color: string | null; counts: Record<string, number>; total: number }[];
    irregularities: { ip_hash: string; count: number; provinces: string }[];
    totalVotes: number;
  } | null;
  connections: number;
}

interface PollDetailData {
  candidateResults: CandidateResult[];
  provinceResults: { province_code: string; leader_candidate_id: string | null; leader_color: string | null; counts: Record<string, number>; total: number }[];
  irregularities: { ip_hash: string; count: number; provinces: string }[];
  totalVotes: number;
}

interface CandidateForm {
  name: string;
  color: string;
  color2: string;
  photo_url: string;
}

const PRESET_COLORS = ["#EAB308", "#991B1B", "#2563EB", "#16A34A", "#9333EA", "#F97316", "#06B6D4", "#EC4899"];

const CONTINENTS: Record<string, { name: string; codes: string[] }> = {
  europe: { name: "Avrupa", codes: ["al","ad","at","by","be","ba","bg","hr","cy","cz","dk","ee","fi","fr","de","gr","hu","is","ie","it","xk","lv","li","lt","lu","mk","mt","md","mc","me","nl","no","pl","pt","ro","ru","sm","rs","sk","si","es","se","ch","ua","gb","va"] },
  asia: { name: "Asya", codes: ["af","am","az","bh","bd","bt","bn","kh","cn","ge","in","id","ir","iq","il","jp","jo","kz","kw","kg","la","lb","my","mv","mn","mm","np","kp","om","pk","ps","ph","qa","sa","sg","kr","lk","sy","tw","tj","th","tl","tm","tr","ae","uz","vn","ye"] },
  africa: { name: "Afrika", codes: ["dz","ao","bj","bw","bf","bi","cm","cv","cf","td","km","cd","cg","dj","eg","gq","er","sz","et","ga","gm","gh","gn","gw","ci","ke","ls","lr","ly","mg","mw","ml","mr","mu","ma","mz","na","ne","ng","rw","st","sn","sc","sl","so","za","ss","sd","tz","tg","tn","ug","zm","zw"] },
  northAmerica: { name: "Kuzey Amerika", codes: ["ag","bs","bb","bz","ca","cr","cu","dm","do","sv","gd","gt","ht","hn","jm","mx","ni","pa","kn","lc","vc","tt","us"] },
  southAmerica: { name: "Güney Amerika", codes: ["ar","bo","br","cl","co","ec","gy","py","pe","sr","uy","ve"] },
  oceania: { name: "Okyanusya", codes: ["au","fj","ki","mh","fm","nr","nz","pw","pg","ws","sb","to","tv","vu"] },
};

function getContinentForCode(code: string): string {
  for (const [key, continent] of Object.entries(CONTINENTS)) {
    if (continent.codes.includes(code)) return key;
  }
  return "other";
}

function PollDetailDashboard({ pollDetail, poll, regionCache }: {
  pollDetail: PollDetailData;
  poll: Poll;
  regionCache: Record<string, Map<string, Region>>;
}) {
  const pollCountry = poll.country || "tr";
  const isWorldPoll = pollCountry === "world";

  const continentStats = (() => {
    if (!isWorldPoll) return null;
    const stats: Record<string, { name: string; total: number; counts: Record<string, number>; regionCount: number }> = {};
    for (const pr of pollDetail.provinceResults) {
      const continent = getContinentForCode(pr.province_code);
      const cName = continent === "other" ? "Diğer" : (CONTINENTS[continent]?.name || "Diğer");
      if (!stats[continent]) stats[continent] = { name: cName, total: 0, counts: {}, regionCount: 0 };
      stats[continent].total += pr.total;
      stats[continent].regionCount++;
      for (const [cId, count] of Object.entries(pr.counts)) {
        stats[continent].counts[cId] = (stats[continent].counts[cId] || 0) + count;
      }
    }
    return Object.values(stats).sort((a, b) => b.total - a.total);
  })();

  const topRegionsPerCandidate = (() => {
    return poll.candidates.map((candidate) => {
      const regions: { code: string; name: string; pct: number; votes: number; total: number }[] = [];
      for (const pr of pollDetail.provinceResults) {
        const votes = pr.counts[candidate.id] || 0;
        if (votes === 0 || pr.total === 0) continue;
        regions.push({
          code: pr.province_code,
          name: regionCache[pollCountry]?.get(pr.province_code)?.name || pr.province_code,
          pct: (votes / pr.total) * 100,
          votes,
          total: pr.total,
        });
      }
      regions.sort((a, b) => b.pct - a.pct);
      return { candidate, regions: regions.slice(0, 5) };
    });
  })();

  const dominanceStats = (() => {
    const stats: Record<string, number> = {};
    for (const c of poll.candidates) stats[c.id] = 0;
    for (const pr of pollDetail.provinceResults) {
      if (pr.leader_candidate_id) stats[pr.leader_candidate_id] = (stats[pr.leader_candidate_id] || 0) + 1;
    }
    return poll.candidates.map((c) => ({ ...c, regions: stats[c.id] || 0 }));
  })();

  return (
    <div className="space-y-5">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
          <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Toplam Oy</p>
          <p className="text-lg font-black tabular-nums mt-1" style={{ color: "var(--text-primary)" }}>{pollDetail.totalVotes.toLocaleString("tr-TR")}</p>
        </div>
        <div className="p-3 rounded-lg" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
          <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Aktif Bölge</p>
          <p className="text-lg font-black tabular-nums mt-1" style={{ color: "var(--text-primary)" }}>{pollDetail.provinceResults.length}</p>
        </div>
        <div className="p-3 rounded-lg" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
          <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Ort. Oy/Bölge</p>
          <p className="text-lg font-black tabular-nums mt-1" style={{ color: "var(--text-primary)" }}>
            {pollDetail.provinceResults.length > 0 ? Math.round(pollDetail.totalVotes / pollDetail.provinceResults.length) : 0}
          </p>
        </div>
        <div className="p-3 rounded-lg" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
          <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Şüpheli</p>
          <p className="text-lg font-black tabular-nums mt-1" style={{ color: pollDetail.irregularities.length > 0 ? "var(--status-warn-text)" : "var(--text-primary)" }}>
            {pollDetail.irregularities.length}
          </p>
        </div>
      </div>

      {/* Candidate Results */}
      <div>
        <h4 className="text-[10px] font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: "var(--text-tertiary)" }}>
          <BarChart3 className="w-3 h-3" /> Aday Sonuçları
        </h4>
        <div className="space-y-2">
          {[...pollDetail.candidateResults].sort((a, b) => b.votes - a.votes).map((cr, idx) => {
            const pct = pollDetail.totalVotes > 0 ? ((cr.votes / pollDetail.totalVotes) * 100).toFixed(1) : "0.0";
            return (
              <div key={cr.candidate_id} className="flex items-center gap-3">
                <span className="text-[10px] font-bold w-5 text-center tabular-nums" style={{ color: "var(--text-muted)" }}>{idx + 1}</span>
                <div className="w-28 flex items-center gap-2 shrink-0">
                  {cr.photo_url && <img src={cr.photo_url} alt={cr.name} className="w-6 h-6 rounded-full object-cover" />}
                  <span className="text-xs font-bold truncate" style={{ color: cr.color }}>{cr.name}</span>
                </div>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--border-subtle)" }}>
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: idx * 0.05 }}
                    style={{ backgroundColor: cr.color }}
                  />
                </div>
                <span className="text-xs font-bold w-24 text-right tabular-nums" style={{ color: cr.color }}>
                  {cr.votes.toLocaleString("tr-TR")} (%{pct})
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Region Dominance */}
      <div>
        <h4 className="text-[10px] font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: "var(--text-tertiary)" }}>
          <MapPin className="w-3 h-3" /> Bölge Hakimiyeti
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {dominanceStats.sort((a, b) => b.regions - a.regions).map((d) => (
            <div key={d.id} className="p-2.5 rounded-lg" style={{ background: `color-mix(in oklch, ${d.color} 6%, var(--bg-surface))`, border: `1px solid color-mix(in oklch, ${d.color} 20%, transparent)` }}>
              <p className="text-[10px] font-bold truncate" style={{ color: d.color }}>{d.name}</p>
              <p className="text-lg font-black tabular-nums" style={{ color: d.color }}>{d.regions}</p>
              <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>bölge lider</p>
            </div>
          ))}
        </div>
      </div>

      {/* Continent Analysis (World Polls) */}
      {isWorldPoll && continentStats && continentStats.length > 0 && (
        <div>
          <h4 className="text-[10px] font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: "var(--text-tertiary)" }}>
            <Globe className="w-3 h-3" /> Kıta Analizi
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {continentStats.map((cs) => {
              const leader = Object.entries(cs.counts).sort(([,a],[,b]) => b - a)[0];
              const leaderCandidate = leader ? poll.candidates.find((c) => c.id === leader[0]) : null;
              return (
                <div key={cs.name} className="p-3 rounded-lg" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>{cs.name}</span>
                    <span className="text-[9px] tabular-nums" style={{ color: "var(--text-muted)" }}>{cs.regionCount} ülke</span>
                  </div>
                  <p className="text-sm font-black tabular-nums mb-2" style={{ color: "var(--text-primary)" }}>{cs.total.toLocaleString("tr-TR")} oy</p>
                  <div className="space-y-1">
                    {poll.candidates.map((c) => {
                      const votes = cs.counts[c.id] || 0;
                      const pct = cs.total > 0 ? (votes / cs.total) * 100 : 0;
                      return (
                        <div key={c.id} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c.color }} />
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border-subtle)" }}>
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.color }} />
                          </div>
                          <span className="text-[10px] font-bold tabular-nums w-8 text-right" style={{ color: c.color }}>%{pct.toFixed(0)}</span>
                        </div>
                      );
                    })}
                  </div>
                  {leaderCandidate && (
                    <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: `color-mix(in oklch, ${leaderCandidate.color} 12%, transparent)`, color: leaderCandidate.color }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: leaderCandidate.color }} />
                        {leaderCandidate.name} lider
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top Regions Per Candidate */}
      <div>
        <h4 className="text-[10px] font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: "var(--text-tertiary)" }}>
          <Trophy className="w-3 h-3" /> En Güçlü Bölgeler (Top 5)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {topRegionsPerCandidate.map(({ candidate, regions }) => (
            <div key={candidate.id} className="rounded-lg p-3" style={{ background: `color-mix(in oklch, ${candidate.color} 4%, var(--bg-surface))`, border: `1px solid color-mix(in oklch, ${candidate.color} 15%, transparent)` }}>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: candidate.color }} />
                <span className="text-[11px] font-bold" style={{ color: candidate.color }}>{candidate.name}</span>
              </div>
              {regions.length === 0 ? (
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Henüz oy yok</p>
              ) : (
                <div className="space-y-1.5">
                  {regions.map((r, i) => (
                    <div key={r.code} className="flex items-center gap-2">
                      <span className="text-[9px] font-black w-4 h-4 rounded flex items-center justify-center shrink-0" style={{ background: i === 0 ? `color-mix(in oklch, ${candidate.color} 20%, transparent)` : "var(--border-subtle)", color: i === 0 ? candidate.color : "var(--text-muted)" }}>
                        {i + 1}
                      </span>
                      <span className="flex-1 text-[11px] truncate" style={{ color: "var(--text-secondary)" }}>{r.name}</span>
                      <span className="text-[10px] font-bold tabular-nums" style={{ color: candidate.color }}>%{r.pct.toFixed(0)}</span>
                      <span className="text-[9px] tabular-nums" style={{ color: "var(--text-muted)" }}>{r.votes}/{r.total}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Province Breakdown Table */}
      {pollDetail.provinceResults.length > 0 && (
        <div>
          <h4 className="text-[10px] font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: "var(--text-tertiary)" }}>
            <MapPin className="w-3 h-3" /> Tüm Bölgeler ({pollDetail.provinceResults.length})
          </h4>
          <div className="overflow-x-auto max-h-[300px] overflow-y-auto scrollbar-thin rounded-lg" style={{ border: "1px solid var(--border-subtle)" }}>
            <table className="w-full text-xs">
              <thead className="sticky top-0" style={{ background: "var(--bg-surface)" }}>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <th className="text-left py-2 px-3 font-semibold" style={{ color: "var(--text-tertiary)" }}>Bölge</th>
                  {poll.candidates.map((c) => (
                    <th key={c.id} className="text-right py-2 px-3 font-semibold" style={{ color: c.color }}>{c.name}</th>
                  ))}
                  <th className="text-right py-2 px-3 font-semibold" style={{ color: "var(--text-tertiary)" }}>Toplam</th>
                  <th className="text-right py-2 px-3 font-semibold" style={{ color: "var(--text-tertiary)" }}>Lider</th>
                </tr>
              </thead>
              <tbody>
                {[...pollDetail.provinceResults]
                  .sort((a, b) => b.total - a.total)
                  .map((pr) => {
                    const regionName = regionCache[pollCountry]?.get(pr.province_code)?.name || pr.province_code;
                    const leader = pr.leader_candidate_id ? poll.candidates.find((c) => c.id === pr.leader_candidate_id) : null;
                    return (
                      <tr key={pr.province_code} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <td className="py-1.5 px-3 font-medium" style={{ color: "var(--text-secondary)" }}>{regionName}</td>
                        {poll.candidates.map((c) => {
                          const votes = pr.counts[c.id] || 0;
                          const cellPct = pr.total > 0 ? ((votes / pr.total) * 100).toFixed(0) : "0";
                          return (
                            <td key={c.id} className="py-1.5 px-3 text-right tabular-nums" style={{ color: votes > 0 ? c.color : "var(--text-muted)" }}>
                              {votes > 0 ? `${votes} (${cellPct}%)` : "–"}
                            </td>
                          );
                        })}
                        <td className="py-1.5 px-3 text-right tabular-nums font-medium" style={{ color: "var(--text-secondary)" }}>{pr.total}</td>
                        <td className="py-1.5 px-3 text-right">
                          {leader && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: `color-mix(in oklch, ${leader.color} 12%, transparent)`, color: leader.color }}>
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: leader.color }} />
                              {leader.name}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Irregularities */}
      {pollDetail.irregularities.length > 0 && (
        <div>
          <h4 className="text-[10px] font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: "var(--status-warn-text)" }}>
            <AlertTriangle className="w-3 h-3" /> Şüpheli Aktivite ({pollDetail.irregularities.length})
          </h4>
          <div className="rounded-lg p-3 space-y-1.5" style={{ background: "var(--status-warn-bg)", border: `1px solid var(--status-warn-border)` }}>
            {pollDetail.irregularities.map((ir, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="font-mono" style={{ color: "var(--text-secondary)" }}>{ir.ip_hash.slice(0, 12)}...</span>
                <span className="font-bold tabular-nums" style={{ color: "var(--status-warn-text)" }}>{ir.count}x</span>
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>[{ir.provinces}]</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [pollTitle, setPollTitle] = useState("");
  const [pollCountry, setPollCountry] = useState("tr");
  const [candidates, setCandidates] = useState<CandidateForm[]>([
    { name: "", color: "#EAB308", color2: "", photo_url: "" },
    { name: "", color: "#991B1B", color2: "", photo_url: "" },
  ]);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [expandedPoll, setExpandedPoll] = useState<string | null>(null);
  const [pollDetail, setPollDetail] = useState<PollDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [regionCache, setRegionCache] = useState<Record<string, Map<string, Region>>>({});

  async function loadRegions(country: string): Promise<Map<string, Region>> {
    if (regionCache[country]) return regionCache[country];
    try {
      const mod = await import(`@/lib/regions/${country}.ts`);
      const key = Object.keys(mod).find((k) => Array.isArray(mod[k]));
      const regions: Region[] = key ? mod[key] : [];
      const map = new Map(regions.map((r) => [r.code, r]));
      setRegionCache((prev) => ({ ...prev, [country]: map }));
      return map;
    } catch {
      const empty = new Map<string, Region>();
      setRegionCache((prev) => ({ ...prev, [country]: empty }));
      return empty;
    }
  }

  const fetchAdmin = useCallback(async () => {
    if (!adminKey) return;
    try {
      const res = await fetch("/api/admin", { headers: { "x-admin-key": adminKey } });
      if (res.ok) {
        setData(await res.json());
      } else {
        setMsg({ text: "Şifre hatalı.", type: "error" });
        setAuthenticated(false);
      }
    } catch {}
  }, [adminKey]);

  useEffect(() => {
    if (!authenticated) return;
    fetchAdmin();
    const id = setInterval(fetchAdmin, 2500);
    return () => clearInterval(id);
  }, [authenticated, fetchAdmin]);

  const activeCountry = data?.activePoll?.country || "tr";
  useEffect(() => {
    if (!data) return;
    if (!regionCache[activeCountry]) loadRegions(activeCountry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCountry]);

  async function action(body: object) {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) {
        setMsg({ text: d.error || "Hata.", type: "error" });
      } else {
        setMsg({ text: "Başarılı.", type: "success" });
        fetchAdmin();
      }
    } catch {
      setMsg({ text: "Bağlantı hatası.", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function createPoll() {
    const valid = candidates.filter((c) => c.name.trim());
    if (!pollTitle.trim()) { setMsg({ text: "Başlık gerekli.", type: "error" }); return; }
    if (valid.length < 2) { setMsg({ text: "En az 2 aday ekleyin.", type: "error" }); return; }
    await action({
      action: "create_poll",
      title: pollTitle.trim(),
      country: pollCountry,
      candidates: valid.map((c) => ({ name: c.name.trim(), color: c.color, color2: c.color2.trim() || undefined, photo_url: c.photo_url.trim() || undefined })),
    });
    setPollTitle("");
    setPollCountry("tr");
    setCandidates([{ name: "", color: "#EAB308", color2: "", photo_url: "" }, { name: "", color: "#991B1B", color2: "", photo_url: "" }]);
    setShowCreate(false);
  }

  function updateCandidate(i: number, field: keyof CandidateForm, value: string) {
    const arr = [...candidates];
    arr[i] = { ...arr[i], [field]: value };
    setCandidates(arr);
  }

  async function togglePollDetail(pollId: string) {
    if (expandedPoll === pollId) {
      setExpandedPoll(null);
      setPollDetail(null);
      return;
    }
    setExpandedPoll(pollId);
    setDetailLoading(true);
    setPollDetail(null);
    try {
      const poll = data?.polls.find((p) => p.id === pollId);
      if (poll) await loadRegions(poll.country || "tr");
      const res = await fetch(`/api/admin/poll-detail?poll_id=${pollId}`, { headers: { "x-admin-key": adminKey } });
      if (res.ok) {
        setPollDetail(await res.json());
      }
    } catch {}
    finally { setDetailLoading(false); }
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--bg-base)" }}>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-sm rounded-2xl p-8"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
              <Lock className="w-4 h-4" style={{ color: "var(--text-tertiary)" }} />
            </div>
            <div>
              <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Admin Girişi</h1>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Yönetim paneline erişim</p>
            </div>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { setAdminKey(password); setAuthenticated(true); }}}
            placeholder="Admin PIN"
            className="w-full rounded-lg px-4 py-3 mb-4 focus:outline-none text-sm"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
          />
          <button
            onClick={() => { setAdminKey(password); setAuthenticated(true); }}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-colors"
            style={{ background: "var(--text-primary)", color: "var(--bg-base)" }}
          >
            Giriş
          </button>
        </motion.div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-base)" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-48 h-4 rounded shimmer-loading" />
          <div className="w-32 h-3 rounded shimmer-loading" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6" style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
              <Shield className="w-5 h-5" style={{ color: "var(--text-tertiary)" }} />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Admin Panel</h1>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Oylama Yönetim Merkezi</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg" style={{ background: "var(--status-active-bg)", color: "var(--status-active-text)" }}>
              <Wifi className="w-3.5 h-3.5" />
              {data.connections} canlı
            </span>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors"
              style={{ background: "var(--text-primary)", color: "var(--bg-base)" }}
            >
              <Plus className="w-4 h-4" />
              Yeni Oylama
            </button>
          </div>
        </motion.header>

        <AnimatePresence>
          {msg && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-6 p-3 rounded-lg text-sm"
              style={{
                background: msg.type === "success" ? "var(--status-active-bg)" : "var(--status-danger-bg)",
                border: `1px solid ${msg.type === "success" ? "var(--status-active-border)" : "var(--status-danger-border)"}`,
                color: msg.type === "success" ? "var(--status-active-text)" : "var(--status-danger-text)",
              }}
            >
              {msg.text}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Create Form */}
        <AnimatePresence>
          {showCreate && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="mb-8 rounded-2xl p-6"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Yeni Oylama Oluştur</h2>
                <button onClick={() => setShowCreate(false)} className="p-2 rounded-lg transition-colors" style={{ color: "var(--text-tertiary)", background: "var(--bg-elevated)" }}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider font-medium mb-2" style={{ color: "var(--text-tertiary)" }}>Başlık</label>
                  <input
                    value={pollTitle}
                    onChange={(e) => setPollTitle(e.target.value)}
                    placeholder="Örn: Cumhurbaşkanlığı Seçimi 2026"
                    className="w-full rounded-lg px-4 py-3 text-sm focus:outline-none"
                    style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider font-medium mb-2" style={{ color: "var(--text-tertiary)" }}>Ülke</label>
                  <select
                    value={pollCountry}
                    onChange={(e) => setPollCountry(e.target.value)}
                    className="w-full rounded-lg px-4 py-3 text-sm focus:outline-none"
                    style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
                  >
                    {supportedCountries.map((c) => (
                      <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mb-5">
                <label className="block text-[11px] uppercase tracking-wider font-medium mb-3" style={{ color: "var(--text-tertiary)" }}>Adaylar</label>
                <div className="space-y-3">
                  {candidates.map((cf, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          type="color"
                          value={cf.color}
                          onChange={(e) => updateCandidate(i, "color", e.target.value)}
                          className="w-8 h-10 rounded-l-lg border-0 cursor-pointer bg-transparent"
                          title="Ana renk"
                        />
                        <input
                          type="color"
                          value={cf.color2 || cf.color}
                          onChange={(e) => updateCandidate(i, "color2", e.target.value)}
                          className="w-8 h-10 rounded-r-lg border-0 cursor-pointer bg-transparent"
                          title="İkinci renk (opsiyonel)"
                        />
                      </div>
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                        <input
                          value={cf.name}
                          onChange={(e) => updateCandidate(i, "name", e.target.value)}
                          placeholder={`Aday ${i + 1}`}
                          className="rounded-lg px-3 py-2 text-sm focus:outline-none"
                          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
                        />
                        <input
                          value={cf.photo_url}
                          onChange={(e) => updateCandidate(i, "photo_url", e.target.value)}
                          placeholder="Fotoğraf URL (opsiyonel)"
                          className="rounded-lg px-3 py-2 text-sm focus:outline-none"
                          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
                        />
                      </div>
                      <div className="hidden md:flex gap-1">
                        {PRESET_COLORS.slice(0, 4).map((pc) => (
                          <button key={pc} onClick={() => updateCandidate(i, "color", pc)} className="w-5 h-5 rounded-full hover:scale-125 transition-transform" style={{ backgroundColor: pc, border: "1px solid var(--border-subtle)" }} />
                        ))}
                      </div>
                      {candidates.length > 2 && (
                        <button onClick={() => setCandidates(candidates.filter((_, j) => j !== i))} style={{ color: "var(--text-muted)" }} className="hover:text-red-400">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setCandidates([...candidates, { name: "", color: PRESET_COLORS[candidates.length % PRESET_COLORS.length], color2: "", photo_url: "" }])}
                  className="mt-3 flex items-center gap-2 text-sm transition-colors hover:opacity-80"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <Plus className="w-4 h-4" /> Aday Ekle
                </button>
              </div>

              <button
                onClick={createPoll}
                disabled={loading}
                className="px-6 py-3 rounded-xl font-semibold text-sm disabled:opacity-50 transition-colors"
                style={{ background: "var(--text-primary)", color: "var(--bg-base)" }}
              >
                Oluştur
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active Analytics */}
        {data.activeAnalytics && data.activePoll && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 rounded-2xl p-6"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
          >
            <div className="flex items-center gap-2 text-xs font-medium mb-5 uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
              <BarChart3 className="w-3.5 h-3.5" />
              Aktif &mdash; {data.activePoll.title}
            </div>

            <div className="space-y-3 mb-6">
              {data.activeAnalytics.candidateResults
                .sort((a, b) => b.votes - a.votes)
                .map((cr) => {
                  const pct = data.activeAnalytics!.totalVotes > 0 ? ((cr.votes / data.activeAnalytics!.totalVotes) * 100).toFixed(1) : "0.0";
                  return (
                    <div key={cr.candidate_id} className="flex items-center gap-4">
                      <div className="w-32 flex items-center gap-2 shrink-0">
                        {cr.photo_url && <img src={cr.photo_url} alt={cr.name} className="w-7 h-7 rounded-full object-cover" />}
                        <span className="text-sm font-bold truncate" style={{ color: cr.color }}>{cr.name}</span>
                      </div>
                      <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: "var(--border-subtle)" }}>
                        <motion.div
                          className="h-full rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                          style={{ backgroundColor: cr.color }}
                        />
                      </div>
                      <span className="text-sm font-bold w-24 text-right tabular-nums" style={{ color: cr.color }}>
                        {cr.votes.toLocaleString("tr-TR")} ({pct}%)
                      </span>
                    </div>
                  );
                })}
            </div>

            <div className="text-xs" style={{ color: "var(--text-muted)" }}>Toplam: {data.activeAnalytics.totalVotes.toLocaleString("tr-TR")} oy</div>

            {data.activeAnalytics.provinceResults.length > 0 && (
              <div className="mt-6 overflow-x-auto max-h-[300px] overflow-y-auto scrollbar-thin">
                <table className="w-full text-xs">
                  <thead className="sticky top-0" style={{ background: "var(--bg-surface)" }}>
                    <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <th className="text-left py-2 px-2" style={{ color: "var(--text-tertiary)" }}>Bölge</th>
                      {data.activePoll.candidates.map((c) => (
                        <th key={c.id} className="text-right py-2 px-2" style={{ color: c.color }}>{c.name}</th>
                      ))}
                      <th className="text-right py-2 px-2" style={{ color: "var(--text-tertiary)" }}>Toplam</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.activeAnalytics.provinceResults
                      .sort((a, b) => b.total - a.total)
                      .map((pr) => {
                        const activeCountry = data.activePoll?.country || "tr";
                        const regionName = regionCache[activeCountry]?.get(pr.province_code)?.name || pr.province_code;
                        return (
                          <tr key={pr.province_code} className="hover:brightness-110" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                            <td className="py-1.5 px-2" style={{ color: "var(--text-secondary)" }}>{regionName}</td>
                            {data.activePoll!.candidates.map((c) => (
                              <td key={c.id} className="py-1.5 px-2 text-right tabular-nums" style={{ color: c.color }}>{pr.counts[c.id] || 0}</td>
                            ))}
                            <td className="py-1.5 px-2 text-right tabular-nums" style={{ color: "var(--text-muted)" }}>{pr.total}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}

            {data.activeAnalytics.irregularities.length > 0 && (
              <div className="mt-6 pt-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                <div className="flex items-center gap-2 text-xs mb-2" style={{ color: "var(--status-warn-text)" }}>
                  <AlertTriangle className="w-3 h-3" />
                  Şüpheli Aktivite ({data.activeAnalytics.irregularities.length})
                </div>
                <div className="space-y-1">
                  {data.activeAnalytics.irregularities.slice(0, 10).map((ir, i) => (
                    <div key={i} className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                      {ir.ip_hash.slice(0, 10)}... {ir.count}x [{ir.provinces}]
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Polls List */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl p-6"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
        >
          <h2 className="text-xs font-medium mb-4 uppercase tracking-wider flex items-center gap-2" style={{ color: "var(--text-tertiary)" }}>
            <Palette className="w-3.5 h-3.5" />
            Tüm Oylamalar ({data.polls.length})
          </h2>

          {data.polls.length === 0 ? (
            <p className="text-sm text-center py-12" style={{ color: "var(--text-muted)" }}>Henüz oylama yok.</p>
          ) : (
            <div className="space-y-2">
              {data.polls.map((poll) => (
                <div
                  key={poll.id}
                  className="p-4 rounded-xl transition-colors"
                  style={{
                    background: poll.status === "active" ? "var(--status-active-bg)" : "var(--bg-elevated)",
                    border: `1px solid ${poll.status === "active" ? "var(--status-active-border)" : "var(--border-subtle)"}`,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <h3 className="font-bold text-sm truncate" style={{ color: "var(--text-primary)" }}>{poll.title}</h3>
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                          style={{
                            background: poll.status === "active" ? "var(--status-active-bg)" : poll.status === "ended" ? "var(--bg-overlay)" : "var(--status-warn-bg)",
                            color: poll.status === "active" ? "var(--status-active-text)" : poll.status === "ended" ? "var(--text-muted)" : "var(--status-warn-text)",
                          }}
                        >
                          {poll.status === "active" ? "AKTİF" : poll.status === "ended" ? "BİTTİ" : "TASLAK"}
                        </span>
                        <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>{poll.vote_count} oy</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {poll.candidates.map((c) => (
                          <span key={c.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]" style={{ backgroundColor: `color-mix(in oklch, ${c.color} 10%, transparent)`, color: c.color }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.color }} />
                            {c.name}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      {poll.vote_count > 0 && (
                        <button
                          onClick={() => togglePollDetail(poll.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                          style={{ background: "var(--bg-overlay)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}
                        >
                          <Eye className="w-3 h-3" />
                          Detay
                          <ChevronDown className={`w-3 h-3 transition-transform ${expandedPoll === poll.id ? "rotate-180" : ""}`} />
                        </button>
                      )}
                      {poll.status === "draft" && (
                        <button
                          onClick={() => action({ action: "start_poll", poll_id: poll.id })}
                          disabled={loading}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40 transition-colors"
                          style={{ background: "var(--status-active-bg)", border: `1px solid var(--status-active-border)`, color: "var(--status-active-text)" }}
                        >
                          <Play className="w-3 h-3" /> Başlat
                        </button>
                      )}
                      {poll.status === "active" && (
                        <button
                          onClick={() => action({ action: "end_poll", poll_id: poll.id })}
                          disabled={loading}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40 transition-colors"
                          style={{ background: "var(--status-danger-bg)", border: `1px solid var(--status-danger-border)`, color: "var(--status-danger-text)" }}
                        >
                          <Square className="w-3 h-3" /> Bitir
                        </button>
                      )}
                      {poll.status !== "active" && (
                        confirmDelete === poll.id ? (
                          <button
                            onClick={() => { action({ action: "delete_poll", poll_id: poll.id }); setConfirmDelete(null); }}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold animate-pulse"
                            style={{ background: "var(--status-danger-text)", color: "white" }}
                          >
                            Onayla
                          </button>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(poll.id)}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ border: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* Expandable Detail Panel */}
                  <AnimatePresence>
                    {expandedPoll === poll.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="pt-4 mt-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                          {detailLoading ? (
                            <div className="flex items-center gap-2 py-8 justify-center">
                              <div className="w-4 h-4 rounded-full animate-pulse" style={{ background: "var(--text-muted)" }} />
                              <span className="text-xs" style={{ color: "var(--text-muted)" }}>Yükleniyor...</span>
                            </div>
                          ) : pollDetail ? (
                            <PollDetailDashboard
                              pollDetail={pollDetail}
                              poll={poll}
                              regionCache={regionCache}
                            />
                          ) : (
                            <p className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>Veri yüklenemedi.</p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
