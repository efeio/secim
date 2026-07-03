"use client";

import { motion, AnimatePresence } from "framer-motion";
import { SSEConnectionState } from "@/hooks/useSSE";

interface ConnectionIndicatorProps {
  state: SSEConnectionState;
  nextRetryIn: number;
}

export default function ConnectionIndicator({ state, nextRetryIn }: ConnectionIndicatorProps) {
  const colors: Record<SSEConnectionState, string> = {
    connected: "oklch(0.65 0.2 145)",
    connecting: "oklch(0.7 0.15 80)",
    disconnected: "oklch(0.6 0.2 25)",
  };

  return (
    <div className="flex items-center gap-1.5" title={
      state === "connected" ? "Bağlı" :
      state === "connecting" ? "Bağlanılıyor..." :
      `Bağlantı kesildi (${nextRetryIn}s)`
    }>
      <motion.span
        animate={{
          background: colors[state],
          scale: state === "connecting" ? [1, 1.4, 1] : 1,
        }}
        transition={state === "connecting" ? { scale: { repeat: Infinity, duration: 1 } } : { duration: 0.3 }}
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: colors[state] }}
      />
      <AnimatePresence>
        {state === "disconnected" && nextRetryIn > 0 && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.2 }}
            className="text-[9px] tabular-nums overflow-hidden"
            style={{ color: colors.disconnected }}
          >
            {nextRetryIn}s
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
