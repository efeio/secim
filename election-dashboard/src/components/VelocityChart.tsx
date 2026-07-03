"use client";

import { useEffect, useState } from "react";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";

interface VelocityChartProps {
  pollId: string;
}

interface DataPoint {
  minute: string;
  count: number;
}

export default function VelocityChart({ pollId }: VelocityChartProps) {
  const [data, setData] = useState<DataPoint[]>([]);

  useEffect(() => {
    if (!pollId) return;
    fetch(`/api/analytics/velocity?poll_id=${pollId}`)
      .then((r) => r.json())
      .then((d) => setData(d.data || []))
      .catch(() => {});
  }, [pollId]);

  if (data.length < 2) return null;

  return (
    <div className="h-[60px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="velocityGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.65 0.25 25)" stopOpacity={0.4} />
              <stop offset="100%" stopColor="oklch(0.65 0.25 25)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip
            contentStyle={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-default)",
              borderRadius: "8px",
              fontSize: "11px",
              color: "var(--text-primary)",
            }}
            labelStyle={{ display: "none" }}
            formatter={(value) => [`${value} oy/dk`, ""]}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="oklch(0.65 0.25 25)"
            strokeWidth={1.5}
            fill="url(#velocityGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
