"use client";

import { useState, useMemo } from "react";
import { getCandidateColor, getMapFillColor } from "@/lib/colors";
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

export interface HoveredRegion {
  code: string;
  name: string;
  counts: { name: string; color: string; votes: number }[];
  total: number;
  leaderColor: string | null;
}

interface CountryMapProps {
  paths: Record<string, string>;
  viewBox: string;
  regions: Region[];
  provinceResults: ProvinceResult[];
  candidates: CandidateInfo[];
  onRegionClick?: (code: string) => void;
  onHover?: (data: HoveredRegion | null) => void;
  clickable?: boolean;
  flashingProvinces?: Set<string>;
  compareSelection?: string[];
  revealedProvinces?: Set<string>;
  isRevealing?: boolean;
}

function getMapSizeClass(viewBox: string): string {
  const parts = viewBox.split(" ").map(Number);
  const w = parts[2] || 1000;
  const h = parts[3] || 1000;
  const ratio = w / h;

  if (ratio > 2) return "w-[98%] h-auto max-h-[70vh]";
  if (ratio > 1.5) return "w-[95%] h-auto max-h-[65vh]";
  if (ratio > 1) return "w-[85%] h-auto max-h-[60vh]";
  return "w-auto h-[70vh] max-w-[85%]";
}

export default function CountryMap({
  paths,
  viewBox,
  regions,
  provinceResults,
  candidates,
  onRegionClick,
  onHover,
  clickable,
  flashingProvinces,
  compareSelection,
  revealedProvinces,
  isRevealing,
}: CountryMapProps) {
  const [hovered, setHovered] = useState<{
    code: string;
    name: string;
    counts: { name: string; color: string; votes: number }[];
    total: number;
    leaderColor: string | null;
  } | null>(null);


  const resultMap = useMemo(
    () => new Map(provinceResults.map((r) => [r.province_code, r])),
    [provinceResults]
  );

  const regionMap = useMemo(
    () => new Map(regions.map((r) => [r.code, r])),
    [regions]
  );

  const idToCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of regions) {
      map.set(r.code, r.code);
      map.set(r.code.toUpperCase(), r.code);
    }
    return map;
  }, [regions]);

  const sizeClass = useMemo(() => getMapSizeClass(viewBox), [viewBox]);

  function getLeaderColor(code: string): string | null {
    const data = resultMap.get(code);
    if (!data || !data.leader_color || data.total === 0) return null;
    const leaderName = candidates.find((c) => c.id === data.leader_candidate_id)?.name || "";
    return getMapFillColor(getCandidateColor(leaderName, data.leader_color));
  }


  function handleMouseEnter(pathId: string) {
    const code = idToCode.get(pathId) || idToCode.get(pathId.toLowerCase()) || pathId.toLowerCase();
    const data = resultMap.get(code);
    const region = regionMap.get(code);

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
      name: region?.name || pathId,
      counts,
      total: data?.total || 0,
      leaderColor: leader ? getCandidateColor(leader.name, leader.color) : null,
    };

    setHovered(hoverData);
    onHover?.(hoverData);
  }

  function handleMouseLeave() {
    setHovered(null);
    onHover?.(null);
  }

  return (
    <div className="w-full flex flex-col items-center">
      <svg
        viewBox={viewBox}
        className={sizeClass}
        xmlns="http://www.w3.org/2000/svg"
      >
        {Object.entries(paths).map(([pathId, d]) => {
          const code = idToCode.get(pathId) || idToCode.get(pathId.toLowerCase()) || pathId.toLowerCase();
          const leaderColor = getLeaderColor(code);
          const isHovered = hovered?.code === code;

          const isFlashing = flashingProvinces?.has(code);
          const isCompareSelected = compareSelection?.includes(code);
          const isHiddenByReveal = isRevealing && revealedProvinces && !revealedProvinces.has(code);

          return (
            <path
              key={pathId}
              d={d}
              data-code={code}
              className={`province-path ${clickable ? "cursor-pointer" : "cursor-default"} ${isFlashing ? "province-flash" : ""}`}
              fill={isHiddenByReveal ? "var(--map-empty)" : (leaderColor || "var(--map-empty)")}
              opacity={isHovered ? 0.85 : 1}
              stroke={isCompareSelected ? "var(--accent-live)" : "var(--map-stroke)"}
              strokeWidth={isCompareSelected ? 2.5 : 0.8}
              onMouseEnter={() => handleMouseEnter(pathId)}
              onMouseLeave={handleMouseLeave}
              onClick={() => clickable && onRegionClick?.(code)}
            />
          );
        })}
      </svg>

    </div>
  );
}
