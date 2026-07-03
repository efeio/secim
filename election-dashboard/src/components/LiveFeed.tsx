"use client";

import { motion, AnimatePresence } from "framer-motion";
import { getCandidateColor } from "@/lib/colors";
import type { Region } from "@/lib/regions/index";

interface FeedItem {
  id: string;
  province_code: string;
  candidate_name: string;
  candidate_color: string;
  created_at: string;
}

interface LiveFeedProps {
  votes: FeedItem[];
  regionMap?: Map<string, Region>;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const then = new Date(dateStr + "Z");
  const diff = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (diff < 5) return "şimdi";
  if (diff < 60) return `${diff}sn`;
  if (diff < 3600) return `${Math.floor(diff / 60)}dk`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}sa`;
  return `${Math.floor(diff / 86400)}g`;
}

export default function LiveFeed({ votes, regionMap }: LiveFeedProps) {
  if (votes.length === 0) {
    return (
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="text-[11px] text-center py-8"
        style={{ color: "var(--text-muted)" }}
      >
        Henüz oy yok...
      </motion.p>
    );
  }

  return (
    <div className="space-y-0">
      <AnimatePresence initial={true}>
        {votes.map((vote, idx) => {
          const region = regionMap?.get(vote.province_code);
          const color = getCandidateColor(vote.candidate_name, vote.candidate_color);
          return (
            <motion.div
              key={vote.id}
              initial={{ opacity: 0, x: -16, height: 0 }}
              animate={{ opacity: 1, x: 0, height: "auto" }}
              exit={{ opacity: 0, x: 16, height: 0 }}
              transition={{
                delay: idx * 0.05,
                duration: 0.4,
                ease: [0.16, 1, 0.3, 1],
                height: { duration: 0.3 },
              }}
              className="py-2.5 overflow-hidden"
              style={{ borderBottom: "1px solid var(--border-subtle)" }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: idx * 0.05 + 0.15, type: "spring", stiffness: 400, damping: 15 }}
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: color }}
                  />
                  <span className="text-[11px] font-medium truncate" style={{ color: "var(--text-secondary)" }}>
                    {region?.name || vote.province_code}
                  </span>
                </div>
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.05 + 0.2, duration: 0.3 }}
                  className="text-[9px] tabular-nums shrink-0"
                  style={{ color: "var(--text-muted)" }}
                >
                  {timeAgo(vote.created_at)}
                </motion.span>
              </div>
              <p className="text-[10px] mt-0.5 ml-3.5" style={{ color: "var(--text-tertiary)" }}>
                <span className="font-semibold" style={{ color }}>{vote.candidate_name}</span>
                {" oyladı"}
              </p>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
