"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

interface AnimatedCountProps {
  value: number;
  duration?: number;
  className?: string;
}

export default function AnimatedCount({ value, duration = 800, className }: AnimatedCountProps) {
  const [display, setDisplay] = useState(value);
  const [flash, setFlash] = useState(false);
  const prevRef = useRef(value);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    prevRef.current = value;

    if (from === to) return;

    setFlash(true);
    const flashTimer = setTimeout(() => setFlash(false), 400);

    const start = performance.now();
    function step(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      }
    }
    frameRef.current = requestAnimationFrame(step);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      clearTimeout(flashTimer);
    };
  }, [value, duration]);

  return (
    <motion.span
      animate={flash ? { scale: [1, 1.08, 1] } : {}}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={`mono-nums inline-block ${className || ""}`}
      style={flash ? { color: "var(--accent-live)" } : undefined}
    >
      {display.toLocaleString("tr-TR")}
    </motion.span>
  );
}
