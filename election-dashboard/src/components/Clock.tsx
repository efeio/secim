"use client";

import { useEffect, useState } from "react";

interface ClockProps {
  compact?: boolean;
}

export default function Clock({ compact }: ClockProps) {
  const [time, setTime] = useState<string>("");
  const [date, setDate] = useState<string>("");

  useEffect(() => {
    function update() {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      );
      setDate(
        now.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", weekday: "long" })
      );
    }
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  if (compact) {
    return (
      <span className="text-[11px] font-mono font-semibold tabular-nums" style={{ color: "var(--text-secondary)" }}>
        {time}
      </span>
    );
  }

  return (
    <div>
      <div className="text-[9px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>Türkiye Saati</div>
      <div className="text-[9px] mt-0.5" style={{ color: "var(--text-muted)" }}>{date}</div>
      <div className="text-2xl font-mono font-bold tabular-nums tracking-tight leading-none mt-1" style={{ color: "var(--text-primary)" }}>
        {time}
      </div>
    </div>
  );
}
