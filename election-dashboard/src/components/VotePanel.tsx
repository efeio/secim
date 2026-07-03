"use client";

import { useState, useCallback } from "react";
import { X, Check, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import ColorDot from "@/components/ColorDot";
import { getDeviceToken, setLocalVoteRecord } from "@/lib/fingerprint";
import type { Region } from "@/lib/regions/index";
import { Turnstile } from "@marsidev/react-turnstile";

async function solvePoW(challenge: string, difficulty: number): Promise<number> {
  const prefix = "0".repeat(difficulty);
  let nonce = 0;
  const encoder = new TextEncoder();
  while (true) {
    const data = encoder.encode(challenge + nonce.toString());
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    if (hashHex.startsWith(prefix)) {
      return nonce;
    }
    nonce++;
    if (nonce % 5000 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
}


function CandidateAvatar({ name, color, photoUrl }: { name: string; color: string; photoUrl: string | null }) {
  const [imgError, setImgError] = useState(false);

  if (photoUrl && !imgError) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className="w-10 h-10 rounded-full object-cover shrink-0"
        style={{ border: `2px solid ${color}40` }}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
      style={{ background: `color-mix(in oklch, ${color} 15%, transparent)`, border: `2px solid ${color}40` }}
    >
      <span className="text-base font-bold" style={{ color }}>{name[0]}</span>
    </div>
  );
}

interface Candidate {
  id: string;
  name: string;
  color: string;
  color2: string | null;
  photo_url: string | null;
}

interface ProvinceResult {
  province_code: string;
  leader_candidate_id: string | null;
  leader_color: string | null;
  counts: Record<string, number>;
  total: number;
}

interface VotePanelProps {
  provinceCode: string;
  candidates: Candidate[];
  pollId: string;
  provinceResults: ProvinceResult[];
  onClose: () => void;
  onVoted: () => void;
  hasVoted: boolean;
  onOptimisticVote?: (candidateId: string, provinceCode: string) => void;
  onRevertOptimistic?: () => void;
  regionMap?: Map<string, Region>;
}

export default function VotePanel({ provinceCode, candidates, pollId, provinceResults, onClose, onVoted, hasVoted, onOptimisticVote, onRevertOptimistic, regionMap }: VotePanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const fireConfetti = useCallback((color: string) => {
    const colors = [color, "#ffffff", color];
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 }, colors, zIndex: 9999 });
    setTimeout(() => {
      confetti({ particleCount: 40, spread: 100, origin: { y: 0.5, x: 0.3 }, colors, zIndex: 9999 });
      confetti({ particleCount: 40, spread: 100, origin: { y: 0.5, x: 0.7 }, colors, zIndex: 9999 });
    }, 150);
  }, []);

  const region = regionMap?.get(provinceCode);
  const result = provinceResults.find((r) => r.province_code === provinceCode);
  const totalProvince = result?.total || 0;

  async function handleVote(candidateId: string) {
    setLoading(true);
    setError("");
    onOptimisticVote?.(candidateId, provinceCode);

    try {
      const deviceToken = await getDeviceToken();

      let challenge = "";
      let difficulty = 5;
      let nonce: number | undefined;

      try {
        const challengeRes = await fetch("/api/pow-challenge");
        if (!challengeRes.ok) {
          throw new Error("Güvenlik kodu alınamadı.");
        }
        const challengeData = await challengeRes.json();
        challenge = challengeData.challenge;
        difficulty = challengeData.difficulty;
      } catch (err) {
        console.error("PoW challenge fetch error:", err);
        setError("Güvenlik doğrulaması başlatılamadı. Lütfen tekrar deneyin.");
        onRevertOptimistic?.();
        setLoading(false);
        return;
      }

      if (challenge) {
        nonce = await solvePoW(challenge, difficulty);
      }

      const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
      if (siteKey && !turnstileToken) {
        setError("Lütfen robot doğrulaması kutucuğunu işaretleyin.");
        onRevertOptimistic?.();
        setLoading(false);
        return;
      }

      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate_id: candidateId,
          province_code: provinceCode,
          poll_id: pollId,
          device_token: deviceToken,
          pow_challenge: challenge,
          pow_nonce: nonce,
          turnstile_token: turnstileToken || "skipped",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Oy verme başarısız.");
        onRevertOptimistic?.();
        return;
      }

      setSuccess(true);
      setLocalVoteRecord(pollId);
      const votedCandidate = candidates.find((c) => c.id === candidateId);
      if (votedCandidate) fireConfetti(votedCandidate.color);
      setTimeout(() => onVoted(), 1500);
    } catch {
      setError("Bağlantı hatası.");
      onRevertOptimistic?.();
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 flex items-center justify-center z-10"
      style={{ background: "oklch(0.05 0.006 260 / 0.8)", backdropFilter: "blur(12px)" }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: -20 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl p-6 shadow-2xl scrollbar-thin"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
      >
        {success ? (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="text-center py-6"
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 250, damping: 15, delay: 0.1 }}
              className="w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center"
              style={{ background: "oklch(0.35 0.12 145 / 0.3)", border: "1px solid oklch(0.5 0.15 145 / 0.4)" }}
            >
              <Check className="w-7 h-7" style={{ color: "oklch(0.7 0.18 145)" }} />
            </motion.div>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="font-bold text-lg"
              style={{ color: "oklch(0.7 0.18 145)" }}
            >
              Oyunuz Kaydedildi!
            </motion.p>
          </motion.div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-xl" style={{ color: "var(--text-primary)" }}>{region?.name || provinceCode}</h3>
                <p className="text-[11px] mt-0.5 tabular" style={{ color: "var(--text-muted)" }}>
                  {totalProvince > 0 ? `${totalProvince.toLocaleString("tr-TR")} oy kullanıldı` : "Henüz oy yok"}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg transition-colors"
                style={{ color: "var(--text-tertiary)", background: "var(--bg-overlay)" }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div
                className="mb-4 p-3 rounded-lg text-sm"
                style={{ background: "oklch(0.2 0.06 25 / 0.4)", border: "1px solid oklch(0.4 0.12 25 / 0.4)", color: "oklch(0.7 0.15 25)" }}
              >
                {error}
              </div>
            )}

            {/* Province Results */}
            {totalProvince > 0 && (
              <div className="mb-5">
                <div className="flex h-2.5 rounded-full overflow-hidden mb-3" style={{ background: "var(--border-subtle)" }}>
                  {candidates.map((c) => {
                    const count = result?.counts[c.id] || 0;
                    const pct = totalProvince > 0 ? (count / totalProvince) * 100 : 0;
                    if (pct === 0) return null;
                    return (
                      <motion.div
                        key={c.id}
                        className="h-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                        style={{ backgroundColor: c.color }}
                      />
                    );
                  })}
                </div>
                {candidates.length <= 4 ? (
                  <div className="flex justify-between">
                    {candidates.map((c) => {
                      const count = result?.counts[c.id] || 0;
                      const pct = totalProvince > 0 ? ((count / totalProvince) * 100).toFixed(1) : "0.0";
                      return (
                        <span key={c.id} className="flex items-center gap-1.5 text-[11px]">
                          <ColorDot color={c.color} color2={c.color2} size="sm" shape="circle" />
                          <span className="font-semibold tabular" style={{ color: c.color }}>{pct}%</span>
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    {[...candidates]
                      .map((c) => ({ ...c, count: result?.counts[c.id] || 0 }))
                      .sort((a, b) => b.count - a.count)
                      .map((c) => {
                        const pct = totalProvince > 0 ? ((c.count / totalProvince) * 100).toFixed(1) : "0.0";
                        return (
                          <div key={c.id} className="flex items-center gap-1.5">
                            <ColorDot color={c.color} color2={c.color2} size="sm" shape="circle" />
                            <span className="text-[10px] font-medium truncate flex-1" style={{ color: "var(--text-secondary)" }}>{c.name}</span>
                            <span className="text-[10px] font-bold tabular shrink-0" style={{ color: c.color }}>{pct}%</span>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}

            {/* Turnstile Widget */}
            {!hasVoted && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
              <div className="mb-4 flex justify-center scale-90 sm:scale-100">
                <Turnstile
                  siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
                  onSuccess={(token) => setTurnstileToken(token)}
                  onError={() => setError("Turnstile doğrulaması başlatılamadı.")}
                  onExpire={() => setTurnstileToken(null)}
                />
              </div>
            )}

            {/* Vote Buttons */}
            {!hasVoted && (
              <div className={candidates.length > 4 ? "grid grid-cols-2 gap-2" : "space-y-2"}>
                {candidates.map((c, idx) => (
                  <motion.button
                    key={c.id}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 0.1 + idx * 0.05, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    whileHover={{ scale: 1.03, transition: { duration: 0.2 } }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleVote(c.id)}
                    disabled={loading}
                    className={`vote-btn flex items-center gap-2 rounded-xl disabled:opacity-50 text-left group ${candidates.length > 4 ? "p-2.5 flex-col" : "w-full p-3.5"}`}
                    style={{
                      background: "var(--bg-overlay)",
                      border: `1px solid var(--border-default)`,
                    }}
                  >
                    {candidates.length > 4 ? (
                      <>
                        <ColorDot color={c.color} color2={c.color2} size="lg" />
                        <span className="text-[11px] font-semibold text-center leading-tight" style={{ color: c.color }}>{c.name}</span>
                      </>
                    ) : (
                      <>
                        <CandidateAvatar name={c.name} color={c.color} photoUrl={c.photo_url} />
                        <span className="font-semibold flex-1" style={{ color: c.color }}>{c.name}</span>
                        {loading ? (
                          <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--text-muted)" }} />
                        ) : (
                          <span className="text-xs font-medium transition-colors" style={{ color: "var(--text-muted)" }}>Oy Ver</span>
                        )}
                      </>
                    )}
                  </motion.button>
                ))}
              </div>
            )}

            {hasVoted && (
              <p className="text-center text-sm py-4" style={{ color: "var(--text-tertiary)" }}>
                Bu oylamada zaten oy kullandınız.
              </p>
            )}
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
