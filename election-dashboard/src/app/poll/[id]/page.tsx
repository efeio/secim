"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { CircleOff, Radio, ArrowLeft, Play, Pause, GitCompare, ChevronDown, ChevronUp, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import TurkeyMap from "@/components/TurkeyMap";
import type { HoveredProvince } from "@/components/TurkeyMap";
import VotePanel from "@/components/VotePanel";
import TopRegions from "@/components/TopRegions";
import ColorDot from "@/components/ColorDot";
import Ticker from "@/components/Ticker";
import Clock from "@/components/Clock";
import AnimatedCount from "@/components/AnimatedCount";
import ConnectionIndicator from "@/components/ConnectionIndicator";
import { hasLocalVoteRecord } from "@/lib/fingerprint";
import { getCandidateColor } from "@/lib/colors";
import { supportedCountries } from "@/lib/maps/index";
import { SSEConnectionState } from "@/hooks/useSSE";
import type { Region } from "@/lib/regions/index";
import { provinces } from "@/lib/provinces";

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

interface PollData {
  active: boolean;
  poll: { id: string; title: string; country: string; status: string; candidates: Candidate[] } | null;
  candidateResults: CandidateResult[];
  provinceResults: ProvinceResult[];
  totalVotes: number;
}

interface MapData {
  paths: Record<string, string>;
  viewBox: string;
}

export default function PollDetailPage() {
  const params = useParams();
  const pollId = params.id as string;

  const [data, setData] = useState<PollData | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [optimisticVote, setOptimisticVote] = useState<{ candidateId: string; provinceCode: string } | null>(null);
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [hoveredRegion, setHoveredRegion] = useState<HoveredProvince | null>(null);
  const [prevTotalVotes, setPrevTotalVotes] = useState<number>(0);
  const [momentum, setMomentum] = useState<{ candidateId: string; rate: number }[]>([]);
  const [flips, setFlips] = useState<{ code: string; from: string; to: string; fromColor: string; toColor: string }[]>([]);
  const prevLeadersRef = useRef<Map<string, string>>(new Map());

  // Feature 1: Heat Pulse (DOM-based to avoid re-renders)
  const flashTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const mapContainerRef = useRef<HTMLDivElement>(null);


  // Feature 4: What If Simulation
  const [whatIfOpen, setWhatIfOpen] = useState(false);

  // Feature 5: Time-lapse Reveal
  const [isRevealing, setIsRevealing] = useState(false);
  const [revealedProvinces, setRevealedProvinces] = useState<Set<string>>(new Set());
  const revealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Feature 6: Compare Mode
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelection, setCompareSelection] = useState<string[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/votes?poll_id=${pollId}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json);
      setOptimisticVote(null);
      if (json.poll) {
        setHasVoted(hasLocalVoteRecord(json.poll.id));
      }
    } catch {}
    finally { setIsLoading(false); }
  }, [pollId]);

  useEffect(() => {
    async function loadMap() {
      if (!data?.poll?.country) return;
      const country = data.poll.country;
      try {
        const mapMod = await import(`@/lib/maps/${country}.ts`);
        const pathsKey = Object.keys(mapMod).find((k) => k.endsWith("Paths"));
        const paths = pathsKey ? mapMod[pathsKey] : {};
        const viewBox = mapMod.SVG_VIEWBOX || "0 0 1000 1000";
        setMapData({ paths, viewBox });

        const regionMod = await import(`@/lib/regions/${country}.ts`);
        const regionKey = Object.keys(regionMod).find((k) => Array.isArray(regionMod[k]));
        setRegions(regionKey ? regionMod[regionKey] : []);
      } catch {
        setMapData(null);
        setRegions([]);
      }
    }
    loadMap();
  }, [data?.poll?.country]);

  const [connectionState, setConnectionState] = useState<SSEConnectionState>("connecting");
  const [nextRetryIn, setNextRetryIn] = useState(0);

  const fetchDataRef = useRef(fetchData);
  const throttleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef(false);
  const throttledFetchRef = useRef(() => {});

  const throttledFetch = useCallback(() => {
    if (throttleRef.current) {
      pendingRef.current = true;
      return;
    }
    fetchDataRef.current();
    throttleRef.current = setTimeout(() => {
      throttleRef.current = null;
      if (pendingRef.current) {
        pendingRef.current = false;
        fetchDataRef.current();
      }
    }, 2000);
  }, []);

  useEffect(() => {
    fetchDataRef.current = fetchData;
    throttledFetchRef.current = throttledFetch;
  });
  useEffect(() => {
    const id = setTimeout(() => {
      fetchData();
    }, 0);
    return () => clearTimeout(id);
  }, [fetchData]);

  useEffect(() => {
    let es: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let countdownInterval: ReturnType<typeof setInterval> | null = null;
    let closed = false;
    let retryCount = 0;
    let lastConnectTime = 0;

    function connect() {
      if (closed) return;

      const now = Date.now();
      if (now - lastConnectTime < 2000) {
        retryTimeout = setTimeout(connect, 3000);
        return;
      }
      lastConnectTime = now;

      setConnectionState("connecting");
      es = new EventSource("/api/events");

      es.onopen = () => {
        setConnectionState("connected");
        retryCount = 0;
        setNextRetryIn(0);
      };

      es.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "poll_changed") { fetchDataRef.current(); return; }
          if (msg.type === "new_vote" && (!msg.poll_id || msg.poll_id === pollId)) {
            throttledFetchRef.current();

            // Feature 1: Heat Pulse (DOM-based)
            if (msg.vote?.province_code && mapContainerRef.current) {
              const code = msg.vote.province_code;
              const paths = mapContainerRef.current.querySelectorAll(`[data-code="${code}"]`);
              paths.forEach((el) => {
                el.classList.remove("province-flash");
                void (el as HTMLElement).offsetWidth;
                el.classList.add("province-flash");
              });
              const existingTimeout = flashTimeoutsRef.current.get(code);
              if (existingTimeout) clearTimeout(existingTimeout);
              const timeout = setTimeout(() => {
                paths.forEach((el) => el.classList.remove("province-flash"));
                flashTimeoutsRef.current.delete(code);
              }, 800);
              flashTimeoutsRef.current.set(code, timeout);
            }

          }
        } catch {}
      };

      es.onerror = () => {
        es?.close();
        es = null;
        if (closed) return;
        setConnectionState("disconnected");
        retryCount++;

        if (retryCount > 5) {
          setNextRetryIn(0);
          return;
        }

        const delays = [2000, 4000, 8000, 16000, 30000];
        const delay = delays[Math.min(retryCount - 1, delays.length - 1)];
        let countdown = Math.ceil(delay / 1000);
        setNextRetryIn(countdown);
        countdownInterval = setInterval(() => {
          countdown--;
          setNextRetryIn(Math.max(0, countdown));
          if (countdown <= 0 && countdownInterval) clearInterval(countdownInterval);
        }, 1000);
        retryTimeout = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      closed = true;
      es?.close();
      if (retryTimeout) clearTimeout(retryTimeout);
      if (countdownInterval) clearInterval(countdownInterval);
    };
  }, [pollId]);

  const getDisplayData = useCallback(() => {
    if (!data || !optimisticVote) return data;

    const { candidateId, provinceCode } = optimisticVote;
    const updatedResults = data.candidateResults.map((cr) =>
      cr.candidate_id === candidateId ? { ...cr, votes: cr.votes + 1 } : cr
    );

    const updatedProvinceResults = data.provinceResults.map((pr) => {
      if (pr.province_code !== provinceCode) return pr;
      const newCounts = { ...pr.counts, [candidateId]: (pr.counts[candidateId] || 0) + 1 };
      const total = pr.total + 1;
      let leaderId = pr.leader_candidate_id;
      let leaderColor = pr.leader_color;
      let maxVotes = 0;
      for (const [cId, count] of Object.entries(newCounts)) {
        if (count > maxVotes) {
          maxVotes = count;
          leaderId = cId;
          leaderColor = data.poll?.candidates.find((c) => c.id === cId)?.color || null;
        }
      }
      return { ...pr, counts: newCounts, total, leader_candidate_id: leaderId, leader_color: leaderColor };
    });

    const hasProvince = updatedProvinceResults.some((pr) => pr.province_code === provinceCode);
    if (!hasProvince) {
      updatedProvinceResults.push({
        province_code: provinceCode,
        leader_candidate_id: candidateId,
        leader_color: data.poll?.candidates.find((c) => c.id === candidateId)?.color || null,
        counts: { [candidateId]: 1 },
        total: 1,
      });
    }

    return {
      ...data,
      candidateResults: updatedResults,
      provinceResults: updatedProvinceResults,
      totalVotes: data.totalVotes + 1,
    };
  }, [data, optimisticVote]);

  const prevResultsRef = useRef<CandidateResult[]>([]);
  const lastUpdateTimeRef = useRef<number>(0);

  useEffect(() => {
    lastUpdateTimeRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (!data) return;
    const now = Date.now();
    const elapsed = (now - lastUpdateTimeRef.current) / 1000;

    if (prevResultsRef.current.length > 0 && elapsed > 0) {
      const rates = data.candidateResults.map((cr) => {
        const prev = prevResultsRef.current.find((p) => p.candidate_id === cr.candidate_id);
        const diff = prev ? cr.votes - prev.votes : 0;
        return { candidateId: cr.candidate_id, rate: diff };
      }).filter((r) => r.rate !== 0);
      if (rates.length > 0) setMomentum(rates);
    }

    const currentLeaders = new Map<string, string>();
    data.provinceResults.forEach((pr) => {
      if (pr.leader_candidate_id && pr.total > 0) {
        currentLeaders.set(pr.province_code, pr.leader_candidate_id);
      }
    });

    if (prevLeadersRef.current.size > 0) {
      const newFlips: typeof flips = [];
      currentLeaders.forEach((leaderId, code) => {
        const prevLeader = prevLeadersRef.current.get(code);
        if (prevLeader && prevLeader !== leaderId) {
          const fromCandidate = data.poll?.candidates.find((c) => c.id === prevLeader);
          const toCandidate = data.poll?.candidates.find((c) => c.id === leaderId);
          if (fromCandidate && toCandidate) {
            newFlips.push({
              code,
              from: fromCandidate.name,
              to: toCandidate.name,
              fromColor: fromCandidate.color,
              toColor: toCandidate.color,
            });
          }
        }
      });
      if (newFlips.length > 0) {
        setFlips((prev) => [...newFlips, ...prev].slice(0, 5));
      }
    }

    prevLeadersRef.current = currentLeaders;
    prevResultsRef.current = data.candidateResults;
    setPrevTotalVotes(data.totalVotes);
    lastUpdateTimeRef.current = now;
  }, [data]);

  const countryInfo = useMemo(() => {
    if (!data?.poll?.country) return null;
    return supportedCountries.find((c) => c.code === data.poll!.country) || { name: data.poll.country, flag: "🌐", regionLabel: "Region", code: data.poll.country };
  }, [data]);

  const effectiveRegions: Region[] = useMemo(() => {
    if (data?.poll?.country === "tr") {
      return provinces.map((p) => ({ code: p.code, name: p.name, plate: p.plate }));
    }
    return regions;
  }, [data, regions]);

  const regionMap = useMemo(() => new Map(effectiveRegions.map((r) => [r.code, r])), [effectiveRegions]);

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-base)" }}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-3"
          style={{ color: "var(--text-tertiary)" }}
        >
          <Radio className="w-5 h-5 animate-pulse" />
          <span className="text-sm font-medium">Bağlanılıyor...</span>
        </motion.div>
      </main>
    );
  }

  if (!data?.poll) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-base)" }}>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="text-center"
        >
          <CircleOff className="w-16 h-16 mx-auto mb-6" style={{ color: "var(--text-muted)" }} />
          <h1 className="text-3xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>Oylama Bulunamadı</h1>
          <p className="text-sm max-w-xs mx-auto" style={{ color: "var(--text-tertiary)" }}>
            Bu oylama mevcut değil veya silinmiş olabilir.
          </p>
          <Link
            href="/"
            className="inline-block mt-8 text-xs font-medium underline underline-offset-4 transition-colors hover:opacity-80"
            style={{ color: "var(--text-secondary)" }}
          >
            ← Ana sayfaya dön
          </Link>
        </motion.div>
      </main>
    );
  }

  const displayData = getDisplayData()!;
  const { poll } = data;
  const { candidateResults, provinceResults, totalVotes } = displayData;

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

  function handleProvinceClick(code: string) {
    setSelectedProvince(code);
  }

  function handleVoted() {
    setHasVoted(true);
    setSelectedProvince(null);
  }

  function handleOptimisticVote(candidateId: string, provinceCode: string) {
    setOptimisticVote({ candidateId, provinceCode });
  }

  function handleRevertOptimistic() {
    setOptimisticVote(null);
  }

  // Feature 5: Time-lapse Reveal
  function startReveal() {
    const activeProvinces = provinceResults
      .filter((pr) => pr.total > 0)
      .sort((a, b) => a.total - b.total); // reveal lowest-vote provinces first for visual effect

    if (activeProvinces.length === 0) return;

    setIsRevealing(true);
    setRevealedProvinces(new Set());

    let idx = 0;
    const interval = Math.max(80, 3000 / activeProvinces.length);

    function revealNext() {
      if (idx >= activeProvinces.length) {
        // Done revealing, keep showing for a moment then reset
        revealTimeoutRef.current = setTimeout(() => {
          setIsRevealing(false);
          setRevealedProvinces(new Set());
        }, 1500);
        return;
      }
      setRevealedProvinces((prev) => new Set(prev).add(activeProvinces[idx].province_code));
      idx++;
      revealTimeoutRef.current = setTimeout(revealNext, interval);
    }

    revealNext();
  }

  function stopReveal() {
    if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
    setIsRevealing(false);
    setRevealedProvinces(new Set());
  }

  // Feature 6: Compare Mode - province click override
  function handleProvinceClickWithCompare(code: string) {
    if (compareMode) {
      setCompareSelection((prev) => {
        if (prev.includes(code)) return prev.filter((c) => c !== code);
        if (prev.length >= 2) return [prev[1], code];
        return [...prev, code];
      });
    } else {
      handleProvinceClick(code);
    }
  }

  const isTurkey = poll.country === "tr";
  const regionLabel = countryInfo?.regionLabel || "Region";

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="h-screen flex flex-col overflow-hidden font-sans md:overflow-hidden overflow-y-auto"
      style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}
    >
      {/* Top Ticker Bar */}
      <motion.div
        initial={{ opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        className="flex items-center h-[40px] shrink-0 glass"
        style={{ borderBottom: "1px solid var(--glass-border)" }}
      >
        <Link
          href="/"
          className="px-3 h-full flex items-center gap-1.5 shrink-0 hover:opacity-80 transition-opacity"
          style={{ borderRight: "1px solid var(--glass-border)" }}
        >
          <ArrowLeft className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
          <span className="text-[10px] font-medium" style={{ color: "var(--text-secondary)" }}>Tümü</span>
        </Link>
        <div
          className="px-4 h-full flex items-center gap-2.5 shrink-0"
          style={{ borderRight: "1px solid var(--glass-border)" }}
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-pulse-live absolute inline-flex h-full w-full rounded-full" style={{ background: "var(--accent-live)" }} />
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "var(--accent-live)" }} />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: "var(--accent-live)" }}>CANLI</span>
          </div>
        </div>
        <div className="flex-1 overflow-hidden h-full flex items-center">
          <Ticker provinceResults={mappedProvinceResults} candidates={mappedCandidates} regions={effectiveRegions} />
        </div>
        <div className="px-4 h-full flex items-center gap-3 shrink-0" style={{ borderLeft: "1px solid var(--glass-border)" }}>
          <ConnectionIndicator state={connectionState} nextRetryIn={nextRetryIn} />
          <Clock compact />
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Sidebar */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          className="w-full md:w-[280px] shrink-0 flex flex-col h-full overflow-y-auto scrollbar-thin glass"
          style={{ borderRight: "1px solid var(--glass-border)", borderRadius: 0 }}
        >
          {/* Title + Status row */}
          <div className="px-4 pt-3 pb-2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center justify-between mb-1">
              <h1 className="text-sm font-bold leading-tight truncate" style={{ color: "var(--text-primary)" }}>{poll.title}</h1>
              <span className="text-base shrink-0 ml-2">{countryInfo?.flag}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium tabular-nums" style={{ color: "var(--text-muted)" }}>
                <AnimatedCount value={totalVotes} className="tabular" /> oy
              </span>
            </div>
          </div>

          {/* Candidate Results - adaptive compact */}
          <div className="px-4 py-2.5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            {mappedSorted.length <= 4 ? (
              <div className="space-y-2">
                {mappedSorted.map((cr, idx) => {
                  const pct = totalVotes > 0 ? ((cr.votes / totalVotes) * 100) : 0;
                  const isLeader = idx === 0;
                  return (
                    <motion.div
                      key={cr.candidate_id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + idx * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                      className={`rounded-lg p-2.5 ${isLeader ? "leader-aura" : ""}`}
                      style={{
                        "--c": cr.color,
                        "--aura-color": `color-mix(in oklch, ${cr.color} 40%, transparent)`,
                        background: `color-mix(in oklch, ${cr.color} ${isLeader ? 8 : 4}%, var(--bg-elevated))`,
                        border: `1px solid color-mix(in oklch, ${cr.color} ${isLeader ? 30 : 14}%, transparent)`,
                      } as React.CSSProperties}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <ColorDot color={cr.color} color2={cr.color2} size="sm" />
                          <span className="text-[11px] font-semibold truncate" style={{ color: cr.color }}>{cr.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] tabular-nums" style={{ color: "var(--text-muted)" }}>
                            <AnimatedCount value={cr.votes} />
                          </span>
                          <span className="text-sm font-black tabular-nums" style={{ color: cr.color }}>
                            %{pct.toFixed(1)}
                          </span>
                        </div>
                      </div>
                      <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: "var(--border-subtle)" }}>
                        <motion.div
                          className="h-full rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.5 + idx * 0.1 }}
                          style={{ background: cr.color }}
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-0.5">
                {mappedSorted.map((cr, idx) => {
                  const pct = totalVotes > 0 ? ((cr.votes / totalVotes) * 100) : 0;
                  const isLeader = idx === 0;
                  return (
                    <motion.div
                      key={cr.candidate_id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + idx * 0.04, duration: 0.3 }}
                      className="flex items-center gap-1.5 py-1 px-1.5 rounded"
                      style={{
                        background: isLeader ? `color-mix(in oklch, ${cr.color} 6%, transparent)` : "transparent",
                      }}
                    >
                      <ColorDot color={cr.color} color2={cr.color2} size="sm" />
                      <span className="text-[10px] font-medium truncate flex-1 min-w-0" style={{ color: isLeader ? cr.color : "var(--text-secondary)" }}>{cr.name}</span>
                      <span className="text-[10px] font-black tabular-nums shrink-0" style={{ color: cr.color }}>
                        %{pct.toFixed(1)}
                      </span>
                      <span className="text-[9px] tabular-nums shrink-0 w-8 text-right" style={{ color: "var(--text-muted)" }}>
                        {cr.votes}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Stats Grid - only for few candidates */}
          {mappedSorted.length <= 4 && (
          <div className="px-4 py-2.5 grid grid-cols-2 gap-2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            {(() => {
              const totalRegions = provinceResults.filter((pr) => pr.total > 0).length;
              const voteDiff = mappedSorted.length >= 2 ? mappedSorted[0].votes - mappedSorted[1].votes : 0;
              const pctDiff = totalVotes > 0 && mappedSorted.length >= 2
                ? ((mappedSorted[0].votes - mappedSorted[1].votes) / totalVotes * 100).toFixed(1)
                : "0";
              const mostActiveRegion = provinceResults.reduce<ProvinceResult | null>(
                (max, pr) => (!max || pr.total > max.total) ? pr : max, null
              );
              const mostActiveName = mostActiveRegion ? (regionMap.get(mostActiveRegion.province_code)?.name || mostActiveRegion.province_code) : "–";

              return (
                <>
                  <div className="rounded-md p-2" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
                    <p className="text-[8px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Bölge Sayısı</p>
                    <p className="text-sm font-black tabular-nums mt-0.5" style={{ color: "var(--text-primary)" }}>{totalRegions}</p>
                  </div>
                  <div className="rounded-md p-2" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
                    <p className="text-[8px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Oy Farkı</p>
                    <p className="text-sm font-black tabular-nums mt-0.5" style={{ color: mappedSorted[0]?.color }}>
                      {voteDiff > 0 ? "+" : ""}{voteDiff.toLocaleString("tr-TR")}
                    </p>
                  </div>
                  <div className="rounded-md p-2" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
                    <p className="text-[8px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Fark (%)</p>
                    <p className="text-sm font-black tabular-nums mt-0.5" style={{ color: mappedSorted[0]?.color }}>
                      %{pctDiff}
                    </p>
                  </div>
                  <div className="rounded-md p-2" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
                    <p className="text-[8px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>En Aktif</p>
                    <p className="text-[10px] font-bold mt-0.5 truncate" style={{ color: "var(--text-primary)" }}>{mostActiveName}</p>
                  </div>
                </>
              );
            })()}
          </div>
          )}

          {/* Region dominance bar - always shown */}
          <div className="px-4 py-2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <p className="text-[8px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Bölge Hakimiyeti</p>
            <div className="flex h-2 rounded-full overflow-hidden" style={{ background: "var(--border-subtle)" }}>
              {mappedCandidates.map((c) => {
                const won = provinceResults.filter((pr) => pr.leader_candidate_id === c.id).length;
                const totalActive = provinceResults.filter((pr) => pr.total > 0).length;
                const pct = totalActive > 0 ? (won / totalActive) * 100 : 0;
                if (pct === 0) return null;
                return (
                  <div
                    key={c.id}
                    className="h-full"
                    style={{ width: `${pct}%`, background: c.color }}
                  />
                );
              })}
            </div>
            <div className="flex justify-between mt-1">
              {mappedCandidates.map((c) => {
                const won = provinceResults.filter((pr) => pr.leader_candidate_id === c.id).length;
                if (won === 0) return null;
                return (
                  <span key={c.id} className="text-[8px] font-bold tabular-nums" style={{ color: c.color }}>
                    {won}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Yakın Yarış Bölgeleri - only for few candidates */}
          {mappedSorted.length <= 4 && (
          <div className="px-4 py-2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <p className="text-[8px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Yakın Yarış</p>
            {(() => {
              const closeRaces = provinceResults
                .filter((pr) => pr.total >= 2 && mappedCandidates.length >= 2)
                .map((pr) => {
                  const sorted = [...mappedCandidates]
                    .map((c) => ({ ...c, votes: pr.counts[c.id] || 0 }))
                    .sort((a, b) => b.votes - a.votes);
                  const diff = sorted[0].votes - sorted[1].votes;
                  const diffPct = pr.total > 0 ? (diff / pr.total) * 100 : 100;
                  return { code: pr.province_code, diffPct, diff, total: pr.total, first: sorted[0], second: sorted[1] };
                })
                .filter((r) => r.diffPct > 0 && r.diffPct < 30)
                .sort((a, b) => a.diffPct - b.diffPct)
                .slice(0, 3);

              if (closeRaces.length === 0) {
                return <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>Yakın yarış yok</p>;
              }

              return (
                <div className="space-y-1.5">
                  {closeRaces.map((r) => (
                    <div key={r.code} className="flex items-center gap-1.5">
                      <span className="text-[9px] font-medium truncate flex-1 min-w-0" style={{ color: "var(--text-secondary)" }}>
                        {regionMap.get(r.code)?.name || r.code}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: r.first.color }} />
                        <span className="text-[9px] font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
                          %{r.diffPct.toFixed(1)}
                        </span>
                        <span className="text-[8px]" style={{ color: "var(--text-muted)" }}>fark</span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
          )}

          {/* Feature 4: What If Simulation */}
          <div className="px-4 py-2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <button
              onClick={() => setWhatIfOpen(!whatIfOpen)}
              className="flex items-center justify-between w-full group"
            >
              <p className="text-[8px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Ya Eğer?</p>
              {whatIfOpen ? (
                <ChevronUp className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
              ) : (
                <ChevronDown className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
              )}
            </button>
            <AnimatePresence>
              {whatIfOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <p className="text-[8px] mt-1.5 mb-2" style={{ color: "var(--text-muted)" }}>
                    Boş bölgelerin tamamı bir adaya giderse:
                  </p>
                  <div className="space-y-1.5">
                    {(() => {
                      const activeRegions = provinceResults.filter((pr) => pr.total > 0);
                      const totalRegionCount = effectiveRegions.length;
                      const emptyCount = totalRegionCount - activeRegions.length;
                      if (emptyCount === 0) {
                        return <p className="text-[8px]" style={{ color: "var(--text-muted)" }}>Tüm bölgeler aktif</p>;
                      }
                      const avgVotesPerRegion = activeRegions.length > 0 ? Math.round(totalVotes / activeRegions.length) : 1;
                      const potentialNewVotes = emptyCount * avgVotesPerRegion;

                      return mappedCandidates.map((c) => {
                        const currentVotes = candidateResults.find((cr) => cr.candidate_id === c.id)?.votes || 0;
                        const hypotheticalTotal = totalVotes + potentialNewVotes;
                        const hypotheticalVotes = currentVotes + potentialNewVotes;
                        const hypotheticalPct = hypotheticalTotal > 0 ? (hypotheticalVotes / hypotheticalTotal) * 100 : 0;
                        return (
                          <div key={c.id} className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c.color }} />
                            <span className="text-[9px] font-medium truncate flex-1" style={{ color: "var(--text-secondary)" }}>{c.name}</span>
                            <span className="text-[9px] font-bold tabular-nums shrink-0" style={{ color: c.color }}>
                              %{hypotheticalPct.toFixed(1)}
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                  {(() => {
                    const activeRegions = provinceResults.filter((pr) => pr.total > 0);
                    const totalRegionCount = effectiveRegions.length;
                    const emptyCount = totalRegionCount - activeRegions.length;
                    if (emptyCount === 0) return null;
                    const avgVotesPerRegion = activeRegions.length > 0 ? Math.round(totalVotes / activeRegions.length) : 1;
                    return (
                      <p className="text-[8px] mt-1.5" style={{ color: "var(--text-muted)" }}>
                        {emptyCount} boş bölge x ~{avgVotesPerRegion} oy = +{(emptyCount * avgVotesPerRegion).toLocaleString("tr-TR")} oy
                      </p>
                    );
                  })()}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Katılım Sıralaması - always shown, compact */}
          <div className="px-4 py-2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <p className="text-[8px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Katılım Sıralaması</p>
            {(() => {
              const sorted = [...provinceResults]
                .filter((pr) => pr.total > 0)
                .sort((a, b) => b.total - a.total);
              const top3 = sorted.slice(0, 3);
              const bottom3 = sorted.length > 3 ? sorted.slice(-3).reverse() : [];
              const maxTotal = top3[0]?.total || 1;

              return (
                <div className="space-y-2">
                  <div className="space-y-1">
                    <p className="text-[8px] font-bold uppercase" style={{ color: "var(--status-active-text)" }}>En Yüksek</p>
                    {top3.map((pr) => (
                      <div key={pr.province_code} className="flex items-center gap-1.5">
                        <span className="text-[9px] font-medium truncate flex-1 min-w-0" style={{ color: "var(--text-secondary)" }}>
                          {regionMap.get(pr.province_code)?.name || pr.province_code}
                        </span>
                        <div className="w-12 h-1.5 rounded-full overflow-hidden shrink-0" style={{ background: "var(--border-subtle)" }}>
                          <div className="h-full rounded-full" style={{ width: `${(pr.total / maxTotal) * 100}%`, background: "var(--status-active-text)" }} />
                        </div>
                        <span className="text-[9px] font-bold tabular-nums shrink-0 w-6 text-right" style={{ color: "var(--text-primary)" }}>{pr.total}</span>
                      </div>
                    ))}
                  </div>
                  {bottom3.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[8px] font-bold uppercase" style={{ color: "var(--status-warn-text)" }}>En Düşük</p>
                      {bottom3.map((pr) => (
                        <div key={pr.province_code} className="flex items-center gap-1.5">
                          <span className="text-[9px] font-medium truncate flex-1 min-w-0" style={{ color: "var(--text-secondary)" }}>
                            {regionMap.get(pr.province_code)?.name || pr.province_code}
                          </span>
                          <div className="w-12 h-1.5 rounded-full overflow-hidden shrink-0" style={{ background: "var(--border-subtle)" }}>
                            <div className="h-full rounded-full" style={{ width: `${(pr.total / maxTotal) * 100}%`, background: "var(--status-warn-text)" }} />
                          </div>
                          <span className="text-[9px] font-bold tabular-nums shrink-0 w-6 text-right" style={{ color: "var(--text-primary)" }}>{pr.total}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Province Detail Card - shown on hover */}
          <div className="px-4 py-2.5 flex-1 min-h-0 flex flex-col justify-center">
            <AnimatePresence mode="wait">
              {hoveredRegion && hoveredRegion.total > 0 ? (
                <motion.div
                  key={hoveredRegion.code}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-xl p-3"
                  style={{
                    background: "var(--bg-elevated)",
                    border: `1px solid ${hoveredRegion.leaderColor ? `color-mix(in oklch, ${hoveredRegion.leaderColor} 30%, transparent)` : "var(--border-subtle)"}`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: hoveredRegion.leaderColor || "var(--text-muted)" }} />
                    <span className="text-[13px] font-bold" style={{ color: "var(--text-primary)" }}>{hoveredRegion.name}</span>
                    <span className="text-[10px] ml-auto tabular-nums" style={{ color: "var(--text-muted)" }}>{hoveredRegion.total.toLocaleString("tr-TR")} oy</span>
                  </div>
                  <div className="space-y-1.5">
                    {hoveredRegion.counts
                      .filter((c) => c.votes > 0)
                      .sort((a, b) => b.votes - a.votes)
                      .map((c) => {
                        const pct = (c.votes / hoveredRegion.total) * 100;
                        return (
                          <div key={c.name} className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-sm shrink-0" style={{ background: c.color }} />
                            <span className="text-[10px] font-medium truncate flex-1 min-w-0" style={{ color: "var(--text-secondary)" }}>{c.name}</span>
                            <div className="w-16 h-1.5 rounded-full overflow-hidden shrink-0" style={{ background: "var(--border-subtle)" }}>
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.color }} />
                            </div>
                            <span className="text-[10px] font-bold tabular-nums w-10 text-right shrink-0" style={{ color: c.color }}>%{pct.toFixed(1)}</span>
                          </div>
                        );
                      })}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-center py-6"
                >
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Detay görmek için haritada bir bölgeye gelin</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </motion.div>

        {/* Map Area + Bottom Strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
          className="flex-1 flex flex-col overflow-hidden min-h-[50vh] md:min-h-0"
          style={{ background: "var(--bg-base)" }}
        >
          <div ref={mapContainerRef} className="flex-1 relative flex items-center justify-center overflow-hidden">
          {/* Map Legend */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-4 right-5 flex items-center gap-5 px-4 py-2.5 rounded-xl glass-elevated"
          >
            {mappedCandidates.map((c, i) => (
              <motion.span
                key={c.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.9 + i * 0.1, duration: 0.3 }}
                className="flex items-center gap-2"
              >
                <ColorDot color={c.color} color2={c.color2} size="md" />
                <span className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>{c.name}</span>
              </motion.span>
            ))}
          </motion.div>

          {isTurkey ? (
            <TurkeyMap
              provinceResults={mappedProvinceResults}
              candidates={mappedCandidates}
              onProvinceClick={handleProvinceClickWithCompare}
              onHover={setHoveredRegion}
              clickable={!hasVoted || compareMode}
              compareSelection={compareSelection}
              revealedProvinces={revealedProvinces}
              isRevealing={isRevealing}
            />
          ) : mapData ? (
            <CountryMap
              paths={mapData.paths}
              viewBox={mapData.viewBox}
              regions={regions}
              provinceResults={mappedProvinceResults}
              candidates={mappedCandidates}
              onRegionClick={handleProvinceClickWithCompare}
              onHover={setHoveredRegion}
              clickable={!hasVoted || compareMode}
              compareSelection={compareSelection}
              revealedProvinces={revealedProvinces}
              isRevealing={isRevealing}
            />
          ) : (
            <div className="flex items-center justify-center">
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>Harita yükleniyor...</span>
            </div>
          )}

          {/* Map Controls: Reveal + Compare */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.4 }}
            className="absolute top-4 left-5 flex items-center gap-2"
          >
            {/* Time-lapse Reveal Button */}
            <button
              onClick={isRevealing ? stopReveal : startReveal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all hover:scale-105"
              style={{
                background: isRevealing ? "var(--accent-live)" : "var(--bg-elevated)",
                color: isRevealing ? "white" : "var(--text-secondary)",
                border: `1px solid ${isRevealing ? "var(--accent-live)" : "var(--border-subtle)"}`,
                boxShadow: "var(--shadow-card)",
              }}
            >
              {isRevealing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              {isRevealing ? "Durdur" : "Oynat"}
            </button>

            {/* Compare Mode Button */}
            <button
              onClick={() => { setCompareMode(!compareMode); if (compareMode) setCompareSelection([]); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all hover:scale-105"
              style={{
                background: compareMode ? "oklch(0.45 0.2 260)" : "var(--bg-elevated)",
                color: compareMode ? "white" : "var(--text-secondary)",
                border: `1px solid ${compareMode ? "oklch(0.45 0.2 260)" : "var(--border-subtle)"}`,
                boxShadow: "var(--shadow-card)",
              }}
            >
              <GitCompare className="w-3 h-3" />
              {compareMode ? "Kapat" : "Karşılaştır"}
            </button>
          </motion.div>


          {/* Feature 6: Compare Panel */}
          <AnimatePresence>
            {compareMode && compareSelection.length === 2 && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-xl p-4 min-w-[340px] max-w-[480px]"
                style={{
                  background: "var(--glass-surface)",
                  backdropFilter: "blur(16px)",
                  border: "1px solid var(--glass-border)",
                  boxShadow: "var(--shadow-elevated)",
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold" style={{ color: "var(--text-primary)" }}>Bölge Karşılaştırması</span>
                  <button onClick={() => setCompareSelection([])} className="p-0.5 rounded hover:bg-black/5">
                    <X className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                  </button>
                </div>
                {(() => {
                  const [code1, code2] = compareSelection;
                  const pr1 = provinceResults.find((pr) => pr.province_code === code1);
                  const pr2 = provinceResults.find((pr) => pr.province_code === code2);
                  const name1 = regionMap.get(code1)?.name || code1;
                  const name2 = regionMap.get(code2)?.name || code2;

                  return (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[10px] font-semibold">
                        <span style={{ color: "var(--text-secondary)" }}>{name1} ({pr1?.total || 0} oy)</span>
                        <span style={{ color: "var(--text-secondary)" }}>{name2} ({pr2?.total || 0} oy)</span>
                      </div>
                      {mappedCandidates.map((c) => {
                        const v1 = pr1?.counts[c.id] || 0;
                        const v2 = pr2?.counts[c.id] || 0;
                        const pct1 = pr1 && pr1.total > 0 ? (v1 / pr1.total) * 100 : 0;
                        const pct2 = pr2 && pr2.total > 0 ? (v2 / pr2.total) * 100 : 0;
                        return (
                          <div key={c.id} className="space-y-0.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-bold tabular-nums" style={{ color: c.color }}>%{pct1.toFixed(1)}</span>
                              <span className="text-[9px] font-medium" style={{ color: c.color }}>{c.name}</span>
                              <span className="text-[9px] font-bold tabular-nums" style={{ color: c.color }}>%{pct2.toFixed(1)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border-subtle)", direction: "rtl" }}>
                                <div className="h-full rounded-full compare-bar" style={{ width: `${pct1}%`, background: c.color }} />
                              </div>
                              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border-subtle)" }}>
                                <div className="h-full rounded-full compare-bar" style={{ width: `${pct2}%`, background: c.color }} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Compare Mode Instruction */}
          <AnimatePresence>
            {compareMode && compareSelection.length < 2 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg"
                style={{
                  background: "oklch(0.45 0.2 260)",
                  color: "white",
                  boxShadow: "var(--shadow-card)",
                }}
              >
                <span className="text-[10px] font-medium">
                  {compareSelection.length === 0 ? "Karşılaştırmak için 2 bölge seçin" : "1 bölge daha seçin"}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {selectedProvince && !compareMode && (
              <VotePanel
                provinceCode={selectedProvince}
                candidates={mappedCandidates}
                pollId={poll.id}
                provinceResults={mappedProvinceResults}
                onClose={() => setSelectedProvince(null)}
                onVoted={handleVoted}
                hasVoted={hasVoted}
                onOptimisticVote={handleOptimisticVote}
                onRevertOptimistic={handleRevertOptimistic}
                regionMap={regionMap}
              />
            )}
          </AnimatePresence>
          </div>

          {/* Bottom Strip - En Güçlü Bölgeler horizontal */}
          {provinceResults.length > 0 && (
            <div
              className="shrink-0 overflow-x-auto scrollbar-thin"
              style={{ borderTop: "1px solid var(--border-subtle)", background: "var(--bg-surface)" }}
            >
              <div className="flex gap-2 py-2.5 px-4" style={{ minWidth: "100%" }}>
                {mappedCandidates.map((candidate) => {
                  const topRegions = provinceResults
                    .map((pr) => ({
                      code: pr.province_code,
                      name: regionMap.get(pr.province_code)?.name || pr.province_code,
                      pct: pr.total > 0 ? ((pr.counts[candidate.id] || 0) / pr.total) * 100 : 0,
                    }))
                    .filter((r) => r.pct > 0)
                    .sort((a, b) => b.pct - a.pct)
                    .slice(0, 3);

                  if (topRegions.length === 0) return null;

                  return (
                    <div
                      key={candidate.id}
                      className="flex-1 min-w-0 rounded-lg px-3 py-2"
                      style={{
                        background: `color-mix(in oklch, ${candidate.color} 5%, var(--bg-elevated))`,
                        border: `1px solid color-mix(in oklch, ${candidate.color} 15%, transparent)`,
                      }}
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <ColorDot color={candidate.color} color2={candidate.color2} size="sm" />
                        <span className="text-[9px] font-bold truncate" style={{ color: candidate.color }}>{candidate.name}</span>
                      </div>
                      <div className="space-y-0.5">
                        {topRegions.map((r, i) => (
                          <div key={r.code} className="flex items-center gap-1">
                            <span className="text-[8px] font-bold w-3 shrink-0" style={{ color: i === 0 ? candidate.color : "var(--text-muted)" }}>{i + 1}</span>
                            <span className="text-[9px] truncate flex-1" style={{ color: "var(--text-secondary)" }}>{r.name}</span>
                            <span className="text-[9px] font-bold tabular-nums shrink-0" style={{ color: candidate.color }}>%{r.pct.toFixed(0)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* Extra stats to fill the bar */}
                {(() => {
                  const activeRegions = provinceResults.filter((pr) => pr.total > 0).length;
                  const totalRegions = provinceResults.length;

                  return (
                    <>
                      <div className="flex-1 min-w-0 rounded-lg px-3 py-2" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
                        <p className="text-[8px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Katılım</p>
                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px]" style={{ color: "var(--text-secondary)" }}>Aktif Bölge</span>
                            <span className="text-[9px] font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{activeRegions}/{totalRegions}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[9px]" style={{ color: "var(--text-secondary)" }}>Toplam Oy</span>
                            <span className="text-[9px] font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{totalVotes.toLocaleString("tr-TR")}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[9px]" style={{ color: "var(--text-secondary)" }}>Ort/Bölge</span>
                            <span className="text-[9px] font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{activeRegions > 0 ? Math.round(totalVotes / activeRegions).toLocaleString("tr-TR") : "–"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Momentum */}
                      <div className="flex-1 min-w-0 rounded-lg px-3 py-2" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
                        <p className="text-[8px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Momentum</p>
                        {momentum.length > 0 ? (
                          <div className="space-y-0.5">
                            {momentum.sort((a, b) => b.rate - a.rate).map((m) => {
                              const c = mappedCandidates.find((mc) => mc.id === m.candidateId);
                              if (!c) return null;
                              return (
                                <div key={m.candidateId} className="flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c.color }} />
                                  <span className="text-[9px] truncate flex-1" style={{ color: "var(--text-secondary)" }}>{c.name}</span>
                                  <span className="text-[9px] font-bold tabular-nums shrink-0" style={{ color: m.rate > 0 ? c.color : "var(--text-muted)" }}>
                                    {m.rate > 0 ? "+" : ""}{m.rate}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-[8px]" style={{ color: "var(--text-muted)" }}>Bekleniyor...</p>
                        )}
                      </div>

                      {/* El Değiştiren Bölgeler */}
                      <div className="flex-1 min-w-0 rounded-lg px-3 py-2" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
                        <p className="text-[8px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>El Değiştiren</p>
                        {flips.length > 0 ? (
                          <div className="space-y-0.5">
                            {flips.slice(0, 3).map((f, i) => (
                              <div key={`${f.code}-${i}`} className="flex items-center gap-1">
                                <span className="text-[9px] truncate" style={{ color: "var(--text-secondary)" }}>{regionMap.get(f.code)?.name || f.code}</span>
                                <span className="text-[9px] font-bold shrink-0" style={{ color: f.fromColor }}>{f.from.slice(0, 3)}</span>
                                <span className="text-[8px] shrink-0" style={{ color: "var(--text-muted)" }}>→</span>
                                <span className="text-[9px] font-bold shrink-0" style={{ color: f.toColor }}>{f.to.slice(0, 3)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[8px]" style={{ color: "var(--text-muted)" }}>Henüz yok</p>
                        )}
                      </div>

                      {/* Kritik Bölgeler */}
                      {(() => {
                        const critical = provinceResults
                          .filter((pr) => pr.total > 0 && mappedCandidates.length >= 2)
                          .map((pr) => {
                            const votes = mappedCandidates.map((c) => pr.counts[c.id] || 0).sort((a, b) => b - a);
                            const margin = votes.length >= 2 ? ((votes[0] - votes[1]) / pr.total) * 100 : 100;
                            return { code: pr.province_code, margin };
                          })
                          .filter((r) => r.margin <= 5 && r.margin > 0)
                          .sort((a, b) => a.margin - b.margin)
                          .slice(0, 3);
                        return (
                          <div className="flex-1 min-w-0 rounded-lg px-3 py-2" style={{ background: "var(--bg-elevated)", border: `1px solid ${critical.length > 0 ? "oklch(0.7 0.15 25 / 0.3)" : "var(--border-subtle)"}` }}>
                            <p className="text-[8px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: critical.length > 0 ? "var(--accent-live)" : "var(--text-muted)" }}>Kritik Bölgeler</p>
                            {critical.length > 0 ? (
                              <div className="space-y-0.5">
                                {critical.map((r) => (
                                  <div key={r.code} className="flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse-live" style={{ background: "var(--accent-live)" }} />
                                    <span className="text-[9px] truncate flex-1" style={{ color: "var(--text-secondary)" }}>{regionMap.get(r.code)?.name || r.code}</span>
                                    <span className="text-[9px] font-bold tabular-nums shrink-0" style={{ color: "var(--accent-live)" }}>%{r.margin.toFixed(1)}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[8px]" style={{ color: "var(--text-muted)" }}>Yok</p>
                            )}
                          </div>
                        );
                      })()}

                      {/* Oy Farkı */}
                      {mappedSorted.length >= 2 && (
                        <div className="flex-1 min-w-0 rounded-lg px-3 py-2" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
                          <p className="text-[8px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Lider Farkı</p>
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: mappedSorted[0].color }} />
                              <span className="text-[9px] truncate flex-1" style={{ color: "var(--text-secondary)" }}>Oy Farkı</span>
                              <span className="text-[9px] font-bold tabular-nums shrink-0" style={{ color: mappedSorted[0].color }}>
                                +{(mappedSorted[0].votes - mappedSorted[1].votes).toLocaleString("tr-TR")}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: mappedSorted[0].color }} />
                              <span className="text-[9px] truncate flex-1" style={{ color: "var(--text-secondary)" }}>Puan Farkı</span>
                              <span className="text-[9px] font-bold tabular-nums shrink-0" style={{ color: mappedSorted[0].color }}>
                                %{totalVotes > 0 ? (((mappedSorted[0].votes - mappedSorted[1].votes) / totalVotes) * 100).toFixed(1) : "0"}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Tek Parti Hakimiyeti */}
                      {(() => {
                        const sweeps = mappedCandidates.map((c) => {
                          const wonRegions = provinceResults.filter((pr) => pr.leader_candidate_id === c.id).length;
                          const totalActive = provinceResults.filter((pr) => pr.total > 0).length;
                          const pct = totalActive > 0 ? (wonRegions / totalActive) * 100 : 0;
                          return { ...c, wonRegions, pct };
                        }).filter((c) => c.pct > 0).sort((a, b) => b.pct - a.pct);
                        if (sweeps.length === 0) return null;
                        return (
                          <div className="flex-1 min-w-0 rounded-lg px-3 py-2" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
                            <p className="text-[8px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Harita Payı</p>
                            <div className="space-y-0.5">
                              {sweeps.slice(0, 3).map((c) => (
                                <div key={c.id} className="flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c.color }} />
                                  <span className="text-[9px] truncate flex-1" style={{ color: "var(--text-secondary)" }}>{c.name}</span>
                                  <span className="text-[9px] font-bold tabular-nums shrink-0" style={{ color: c.color }}>%{c.pct.toFixed(0)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {/* En Az Oy Alan Bölge */}
                      {(() => {
                        const lowest = provinceResults
                          .filter((pr) => pr.total > 0)
                          .sort((a, b) => a.total - b.total)
                          .slice(0, 3);
                        if (lowest.length === 0) return null;
                        return (
                          <div className="flex-1 min-w-0 rounded-lg px-3 py-2" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
                            <p className="text-[8px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>En Az Katılım</p>
                            <div className="space-y-0.5">
                              {lowest.map((pr, i) => (
                                <div key={pr.province_code} className="flex items-center gap-1">
                                  <span className="text-[8px] font-bold w-3 shrink-0" style={{ color: "var(--text-muted)" }}>{i + 1}</span>
                                  <span className="text-[9px] truncate flex-1" style={{ color: "var(--text-secondary)" }}>{regionMap.get(pr.province_code)?.name || pr.province_code}</span>
                                  <span className="text-[9px] font-bold tabular-nums shrink-0" style={{ color: "var(--text-primary)" }}>{pr.total}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </motion.main>
  );
}
