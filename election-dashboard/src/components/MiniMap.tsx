"use client";

import { useEffect, useState, useMemo } from "react";
import { getCandidateColor } from "@/lib/colors";

interface PollCandidate {
  candidate_id: string;
  name: string;
  color: string;
  color2?: string | null;
  votes: number;
}

interface MiniMapProps {
  country: string;
  candidates: PollCandidate[];
  leader: { name: string; color: string } | null;
}

interface MapModule {
  paths: Record<string, string>;
  viewBox: string;
}

export default function MiniMap({ country, candidates, leader }: MiniMapProps) {
  const [mapMod, setMapMod] = useState<MapModule | null>(null);

  useEffect(() => {
    import(`@/lib/maps/${country}.ts`)
      .then((mod) => {
        const pathsKey = Object.keys(mod).find((k) => k.endsWith("Paths"));
        const paths = pathsKey ? mod[pathsKey] : {};
        const viewBox = mod.SVG_VIEWBOX || "0 0 1000 1000";
        setMapMod({ paths, viewBox });
      })
      .catch(() => {});
  }, [country]);

  const fillColor = useMemo(() => {
    if (!leader) return "var(--border-subtle)";
    return getCandidateColor(leader.name, leader.color);
  }, [leader]);

  if (!mapMod) return null;

  return (
    <svg
      viewBox={mapMod.viewBox}
      className="w-full h-full"
      xmlns="http://www.w3.org/2000/svg"
    >
      {Object.entries(mapMod.paths).map(([id, d]) => (
        <path
          key={id}
          d={d}
          fill={fillColor}
          fillOpacity={0.15}
          stroke={fillColor}
          strokeOpacity={0.3}
          strokeWidth="0.5"
        />
      ))}
    </svg>
  );
}
