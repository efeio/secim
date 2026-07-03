"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { supportedCountries } from "@/lib/maps/index";
import type { Region } from "@/lib/regions/index";

interface Candidate {
  id: string;
  name: string;
  color: string;
}

interface PollSummary {
  id: string;
  title: string;
  country: string;
  totalVotes: number;
  candidates: { candidate_id: string; name: string; color: string; votes: number }[];
  leader: { name: string; color: string; pct: string } | null;
}

export default function SpamPage() {
  const [polls, setPolls] = useState<PollSummary[]>([]);
  const [selectedPollId, setSelectedPollId] = useState<string>("");
  const [selectedProvince, setSelectedProvince] = useState<string>("");
  const [selectedCandidate, setSelectedCandidate] = useState<string>("");
  const [count, setCount] = useState(0);
  const [spamming, setSpamming] = useState(false);
  const [speed, setSpeed] = useState(50);
  const [mode, setMode] = useState<"targeted" | "random">("random");
  const [vps, setVps] = useState(0);
  const [recentProvinces, setRecentProvinces] = useState<string[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const countRef = useRef(0);
  const vpsRef = useRef(0);
  const vpsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [regions, setRegions] = useState<Region[]>([]);
  const regionsRef = useRef<Region[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/polls");
        if (res.ok) {
          const data: PollSummary[] = await res.json();
          setPolls(data);
          if (data.length > 0) {
            setSelectedPollId(data[0].id);
            if (data[0].candidates.length > 0) {
              setSelectedCandidate(data[0].candidates[0].candidate_id);
            }
          }
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    vpsIntervalRef.current = setInterval(() => {
      setVps(vpsRef.current);
      vpsRef.current = 0;
    }, 1000);
    return () => { if (vpsIntervalRef.current) clearInterval(vpsIntervalRef.current); };
  }, []);

  useEffect(() => {
    if (!selectedPollId) return;
    const poll = polls.find((p) => p.id === selectedPollId);
    if (!poll) return;
    const country = poll.country || "tr";
    import(`@/lib/regions/${country}.ts`).then((mod) => {
      const key = Object.keys(mod).find((k) => Array.isArray(mod[k]));
      const loaded = key ? mod[key] : [];
      setRegions(loaded);
      regionsRef.current = loaded;
    }).catch(() => {
      setRegions([]);
      regionsRef.current = [];
    });
  }, [selectedPollId, polls]);

  const selectedPoll = polls.find((p) => p.id === selectedPollId);
  const candidates: Candidate[] = selectedPoll
    ? selectedPoll.candidates.map((c) => ({ id: c.candidate_id, name: c.name, color: c.color }))
    : [];

  function handlePollChange(pollId: string) {
    if (spamming) return;
    setSelectedPollId(pollId);
    setSelectedCandidate("");
    setCount(0);
    countRef.current = 0;
    const poll = polls.find((p) => p.id === pollId);
    if (poll && poll.candidates.length > 0) {
      setSelectedCandidate(poll.candidates[0].candidate_id);
    }
  }

  const sendTargetedVote = useCallback(() => {
    if (!selectedProvince || !selectedCandidate || !selectedPollId) return;
    fetch("/api/spam", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        poll_id: selectedPollId,
        candidate_id: selectedCandidate,
        province_code: selectedProvince,
      }),
    }).then(() => {
      countRef.current++;
      vpsRef.current++;
      setCount(countRef.current);
    });
  }, [selectedProvince, selectedCandidate, selectedPollId]);

  const sendRandomVote = useCallback(() => {
    if (!selectedPollId || candidates.length === 0 || regionsRef.current.length === 0) return;
    const regs = regionsRef.current;
    const randomRegion = regs[Math.floor(Math.random() * regs.length)];
    const randomCandidate = candidates[Math.floor(Math.random() * candidates.length)].id;

    fetch("/api/spam", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        poll_id: selectedPollId,
        candidate_id: randomCandidate,
        province_code: randomRegion.code,
      }),
    }).then(() => {
      countRef.current++;
      vpsRef.current++;
      setCount(countRef.current);
      setRecentProvinces((prev) => [randomRegion.name, ...prev].slice(0, 5));
    });
  }, [selectedPollId, candidates]);

  function startSpam() {
    setSpamming(true);
    const fn = mode === "random" ? sendRandomVote : sendTargetedVote;
    intervalRef.current = setInterval(fn, speed);
  }

  function stopSpam() {
    setSpamming(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  function updateSpeed(newSpeed: number) {
    setSpeed(newSpeed);
    if (spamming && intervalRef.current) {
      clearInterval(intervalRef.current);
      const fn = mode === "random" ? sendRandomVote : sendTargetedVote;
      intervalRef.current = setInterval(fn, newSpeed);
    }
  }

  function getCountryFlag(code: string) {
    return supportedCountries.find((c) => c.code === code)?.flag || "🌐";
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white px-6" style={{ background: "var(--bg-base)" }}>
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-t-white rounded-full animate-spin" style={{ borderColor: "var(--border-default)" }} />
          <span style={{ color: "var(--text-tertiary)" }}>Yükleniyor...</span>
        </div>
      </div>
    );
  }

  if (error || polls.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white px-6" style={{ background: "var(--bg-base)" }}>
        <div className="text-center">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {error || "Aktif oylama bulunamadı."}
          </p>
        </div>
      </div>
    );
  }

  const canTargeted = selectedProvince && selectedCandidate;

  return (
    <div className="min-h-screen text-white flex flex-col" style={{ background: "var(--bg-base)" }}>
      {/* Stats Header */}
      <div className="sticky top-0 z-10 bg-[#0d0d10]/95 backdrop-blur-sm border-b border-gray-800/50">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold truncate">{selectedPoll?.title || "Oylama Seç"}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              {spamming && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
              <span className="text-[11px] text-gray-500">{spamming ? "Aktif" : "Bekliyor"}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-green-400 font-mono text-2xl font-black tabular-nums leading-none">
              {count.toLocaleString("tr-TR")}
            </div>
            {spamming && (
              <span className="text-[11px] text-gray-500 font-mono">{vps} oy/sn</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-4 space-y-4 overflow-y-auto pb-32">
        {/* Poll Selector */}
        {polls.length > 1 && (
          <div className="bg-[#111113] border border-gray-800/40 rounded-xl p-4">
            <label className="text-[11px] text-gray-500 uppercase tracking-wider block mb-2">Oylama Seç</label>
            <div className="space-y-1.5">
              {polls.map((poll) => (
                <button
                  key={poll.id}
                  onClick={() => handlePollChange(poll.id)}
                  disabled={spamming}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-all ${
                    selectedPollId === poll.id
                      ? "ring-2 ring-white/60 bg-white/5"
                      : "bg-[#1a1a1f] opacity-50 hover:opacity-80"
                  } ${spamming ? "pointer-events-none" : ""}`}
                >
                  <span className="text-lg">{getCountryFlag(poll.country)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{poll.title}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {poll.totalVotes.toLocaleString("tr-TR")} oy
                      {poll.leader && (
                        <span style={{ color: poll.leader.color }}> • {poll.leader.name} %{poll.leader.pct}</span>
                      )}
                    </p>
                  </div>
                  {selectedPollId === poll.id && (
                    <span className="w-2 h-2 rounded-full bg-green-400" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mode Toggle */}
        <div className="grid grid-cols-2 gap-1.5 bg-[#111113] p-1 rounded-xl border border-gray-800/40">
          <button
            onClick={() => { if (!spamming) setMode("random"); }}
            className={`py-2.5 rounded-lg text-sm font-semibold transition-all ${
              mode === "random"
                ? "bg-purple-600/90 text-white shadow-md"
                : "text-gray-500"
            }`}
          >
            Rastgele
          </button>
          <button
            onClick={() => { if (!spamming) setMode("targeted"); }}
            className={`py-2.5 rounded-lg text-sm font-semibold transition-all ${
              mode === "targeted"
                ? "bg-blue-600/90 text-white shadow-md"
                : "text-gray-500"
            }`}
          >
            Hedefli
          </button>
        </div>

        {/* Targeted Mode Options */}
        {mode === "targeted" && (
          <div className="space-y-3 bg-[#111113] border border-gray-800/40 rounded-xl p-4">
            <div>
              <label className="text-[11px] text-gray-500 uppercase tracking-wider block mb-1.5">Şehir</label>
              <select
                value={selectedProvince}
                onChange={(e) => setSelectedProvince(e.target.value)}
                className="w-full bg-[#1a1a1f] border border-gray-700/60 rounded-lg px-3 py-3 text-sm"
              >
                <option value="">Bölge seç...</option>
                {regions.map((r) => (
                  <option key={r.code} value={r.code}>{r.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-gray-500 uppercase tracking-wider block mb-1.5">Aday</label>
              <div className="grid grid-cols-2 gap-2">
                {candidates.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCandidate(c.id)}
                    className={`px-3 py-3 rounded-lg text-xs font-bold transition-all ${
                      selectedCandidate === c.id
                        ? "ring-2 ring-white/80 scale-[1.02]"
                        : "opacity-40"
                    }`}
                    style={{ backgroundColor: c.color + "20", color: c.color }}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Random Mode - Live Activity */}
        {mode === "random" && spamming && recentProvinces.length > 0 && (
          <div className="bg-[#111113] border border-gray-800/40 rounded-xl p-4">
            <label className="text-[11px] text-gray-500 uppercase tracking-wider block mb-2">Son Oylar</label>
            <div className="flex flex-wrap gap-1.5">
              {recentProvinces.map((name, i) => (
                <span
                  key={`${name}-${i}`}
                  className="text-xs px-2 py-1 rounded-md bg-gray-800/60 text-gray-300"
                  style={{ opacity: 1 - i * 0.15 }}
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Speed Control */}
        <div className="bg-[#111113] border border-gray-800/40 rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <label className="text-[11px] text-gray-500 uppercase tracking-wider">Hız</label>
            <span className="text-xs font-mono text-gray-400">{speed}ms</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {[20, 50, 100, 200, 500].map((s) => (
              <button
                key={s}
                onClick={() => updateSpeed(s)}
                className={`py-2.5 rounded-lg text-xs font-mono transition-all ${
                  speed === s
                    ? "bg-white text-black font-bold"
                    : "bg-[#1a1a1f] text-gray-500 active:bg-gray-700"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Fixed Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0d0d10]/95 backdrop-blur-sm border-t border-gray-800/50 p-4 pb-8 space-y-2">
        {!spamming ? (
          <>
            {mode === "targeted" ? (
              <button
                onClick={startSpam}
                disabled={!canTargeted}
                className="w-full py-5 rounded-2xl bg-gradient-to-b from-blue-500 to-blue-700 active:scale-[0.97] font-black text-lg transition-all disabled:opacity-30 shadow-lg shadow-blue-900/30"
              >
                SPAM BAŞLAT
              </button>
            ) : (
              <button
                onClick={startSpam}
                disabled={!selectedPollId || regions.length === 0}
                className="w-full py-5 rounded-2xl bg-gradient-to-b from-purple-500 to-purple-700 active:scale-[0.97] font-black text-lg transition-all disabled:opacity-30 shadow-lg shadow-purple-900/30"
              >
                {regions.length === 0 && selectedPollId ? "Bölgeler yükleniyor..." : "RANDOM SPAM"}
              </button>
            )}
          </>
        ) : (
          <button
            onClick={stopSpam}
            className="w-full py-5 rounded-2xl bg-gradient-to-b from-red-500 to-red-700 active:scale-[0.97] font-black text-lg transition-all shadow-lg shadow-red-900/30"
          >
            DURDUR ({count})
          </button>
        )}
      </div>
    </div>
  );
}
