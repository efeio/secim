"use client";

import { useMemo } from "react";
import ColorDot from "@/components/ColorDot";
import type { Region } from "@/lib/regions/index";

interface ProvinceResult {
  province_code: string;
  leader_candidate_id: string | null;
  leader_color: string | null;
  counts: Record<string, number>;
  total: number;
}

interface CandidateInfo {
  id: string;
  name: string;
  color: string;
  color2?: string | null;
}

interface TopRegionsProps {
  provinceResults: ProvinceResult[];
  candidates: CandidateInfo[];
  regionMap: Map<string, Region>;
}

interface RegionEntry {
  code: string;
  name: string;
  pct: number;
  votes: number;
}

export default function TopRegions({ provinceResults, candidates, regionMap }: TopRegionsProps) {
  const topPerCandidate = useMemo(() => {
    return candidates.map((candidate) => {
      const regions: RegionEntry[] = [];

      for (const pr of provinceResults) {
        const votes = pr.counts[candidate.id] || 0;
        if (votes === 0 || pr.total === 0) continue;
        const pct = (votes / pr.total) * 100;
        regions.push({
          code: pr.province_code,
          name: regionMap.get(pr.province_code)?.name || pr.province_code,
          pct,
          votes,
        });
      }

      regions.sort((a, b) => b.pct - a.pct);
      return { candidate, regions: regions.slice(0, 3) };
    });
  }, [provinceResults, candidates, regionMap]);

  if (provinceResults.length === 0) {
    return (
      <p className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>
        Henüz veri yok.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {topPerCandidate.map(({ candidate, regions }) => (
        <div
          key={candidate.id}
          className="rounded-md p-2"
          style={{
            background: `color-mix(in oklch, ${candidate.color} 4%, var(--bg-elevated))`,
            border: `1px solid color-mix(in oklch, ${candidate.color} 12%, transparent)`,
          }}
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <ColorDot color={candidate.color} color2={candidate.color2} size="sm" />
            <span className="text-[10px] font-bold" style={{ color: candidate.color }}>{candidate.name}</span>
          </div>
          {regions.length === 0 ? (
            <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>Henüz oy yok</p>
          ) : (
            <div className="space-y-1">
              {regions.map((r, i) => (
                <div key={r.code} className="flex items-center gap-1.5">
                  <span
                    className="text-[8px] font-black w-3.5 h-3.5 rounded flex items-center justify-center shrink-0"
                    style={{
                      background: i === 0
                        ? `color-mix(in oklch, ${candidate.color} 20%, transparent)`
                        : "var(--border-subtle)",
                      color: i === 0 ? candidate.color : "var(--text-muted)",
                    }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-[9px] font-medium truncate flex-1 min-w-0" style={{ color: "var(--text-secondary)" }}>{r.name}</span>
                  <span className="text-[9px] font-bold tabular-nums shrink-0" style={{ color: candidate.color }}>%{r.pct.toFixed(0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
