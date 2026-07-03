"use client";

import ColorDot from "@/components/ColorDot";
import type { Region } from "@/lib/regions/index";

interface ProvinceResult {
  province_code: string;
  counts: Record<string, number>;
  total: number;
}

interface CandidateInfo {
  id: string;
  name: string;
  color: string;
  color2?: string | null;
}

interface TickerProps {
  provinceResults: ProvinceResult[];
  candidates: CandidateInfo[];
  regions: Region[];
}

export default function Ticker({ provinceResults, candidates, regions }: TickerProps) {
  if (candidates.length === 0) return null;

  const resultsMap = new Map(provinceResults.map((r) => [r.province_code, r]));

  const items = regions
    .map((p) => {
      const result = resultsMap.get(p.code);
      return {
        code: p.code,
        name: p.name,
        counts: result?.counts || {},
        total: result?.total || 0,
      };
    })
    .filter((r) => r.total > 0);

  if (items.length === 0) return null;

  const doubled = [...items, ...items];

  return (
    <div className="flex animate-scroll whitespace-nowrap items-center h-full">
      {doubled.map((r, i) => {
        const percs = candidates.map((c) => {
          const count = r.counts[c.id] || 0;
          return r.total > 0 ? Math.round((count / r.total) * 100) : 0;
        });

        return (
          <span
            key={`${r.code}-${i}`}
            className="ticker-item inline-flex items-center gap-2.5 px-4 text-[11px]"
            style={{ borderRight: "1px solid var(--border-subtle)" }}
          >
            <span
              className="font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              {r.name}
            </span>
            {r.total > 0 && (
              <span className="inline-flex items-center gap-2">
                {candidates.map((c, ci) => (
                  <span key={c.id} className="inline-flex items-center gap-1">
                    <ColorDot color={c.color} color2={c.color2} size="sm" shape="circle" />
                    <span className="font-mono font-bold tabular-nums" style={{ color: c.color }}>
                      %{percs[ci]}
                    </span>
                  </span>
                ))}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
