"use client";

import { useMemo, useState } from "react";
import { provinces, provinceMap } from "@/lib/provinces";
import { turkeyPaths, SVG_VIEWBOX } from "@/lib/maps/tr";
import { getCandidateColor, getMapFillColor } from "@/lib/colors";

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

export interface HoveredProvince {
  code: string;
  name: string;
  counts: { name: string; color: string; votes: number }[];
  total: number;
  leaderColor: string | null;
}

interface TurkeyMapProps {
  provinceResults: ProvinceResult[];
  candidates: CandidateInfo[];
  onProvinceClick?: (code: string) => void;
  onHover?: (data: HoveredProvince | null) => void;
  clickable?: boolean;
  flashingProvinces?: Set<string>;
  compareSelection?: string[];
  revealedProvinces?: Set<string>;
  isRevealing?: boolean;
}

const plateToCode = new Map(provinces.map((p) => [p.plate, p.code]));

export default function TurkeyMap({ provinceResults, candidates, onProvinceClick, onHover, clickable, flashingProvinces, compareSelection, revealedProvinces, isRevealing }: TurkeyMapProps) {
  const [hovered, setHovered] = useState<{
    code: string;
    province: string;
    counts: { name: string; color: string; votes: number }[];
    total: number;
    leaderColor: string | null;
    leaderName: string | null;
  } | null>(null);

  const resultMap = useMemo(
    () => new Map(provinceResults.map((r) => [r.province_code, r])),
    [provinceResults]
  );

  function getLeaderColor(code: string): string | null {
    const data = resultMap.get(code);
    if (!data || !data.leader_color || data.total === 0) return null;
    const leaderName = candidates.find((c) => c.id === data.leader_candidate_id)?.name || "";
    return getMapFillColor(getCandidateColor(leaderName, data.leader_color));
  }

  function hasVotes(code: string): boolean {
    const data = resultMap.get(code);
    return !!data && data.total > 0;
  }

  function handleMouseEnter(_e: React.MouseEvent, code: string) {
    const data = resultMap.get(code);
    const province = provinceMap.get(code);

    const counts = candidates.map((c) => ({
      name: c.name,
      color: c.color,
      votes: data?.counts[c.id] || 0,
    }));

    const leader = data?.leader_candidate_id
      ? candidates.find((c) => c.id === data.leader_candidate_id)
      : null;

    const hoverData = {
      code,
      province: province?.name || code,
      counts,
      total: data?.total || 0,
      leaderColor: leader ? getCandidateColor(leader.name, leader.color) : null,
      leaderName: leader?.name || null,
    };

    setHovered(hoverData);
    onHover?.({ code, name: hoverData.province, counts, total: hoverData.total, leaderColor: hoverData.leaderColor });
  }

  function handleMouseLeave() {
    setHovered(null);
    onHover?.(null);
  }

  return (
    <div className="w-full flex flex-col items-center">
      <svg
        viewBox={SVG_VIEWBOX}
        className="w-[95%] h-auto max-h-[65vh]"
        xmlns="http://www.w3.org/2000/svg"
      >
        {Object.entries(turkeyPaths).map(([plateStr, d]) => {
          const plate = parseInt(plateStr);
          const code = plateToCode.get(plate);
          if (!code) return null;

          const leaderColor = getLeaderColor(code);
          const isHovered = hovered?.code === code;

          const isFlashing = flashingProvinces?.has(code);
          const isCompareSelected = compareSelection?.includes(code);
          const isHiddenByReveal = isRevealing && revealedProvinces && !revealedProvinces.has(code);

          return (
            <path
              key={plate}
              d={d}
              data-code={code}
              className={`province-path ${clickable ? "cursor-pointer" : "cursor-default"} ${isFlashing ? "province-flash" : ""}`}
              fill={isHiddenByReveal ? "var(--map-empty)" : (leaderColor || "var(--map-empty)")}
              opacity={isHovered ? 0.85 : 1}
              stroke={isCompareSelected ? "var(--accent-live)" : "var(--map-stroke)"}
              strokeWidth={isCompareSelected ? 2.5 : 0.8}
              onMouseEnter={(e) => handleMouseEnter(e, code)}
              onMouseLeave={handleMouseLeave}
              onClick={() => clickable && onProvinceClick?.(code)}
            />
          );
        })}
      </svg>

    </div>
  );
}
