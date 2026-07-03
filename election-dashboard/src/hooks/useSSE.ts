"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type SSEConnectionState = "connecting" | "connected" | "disconnected";

interface UseSSEOptions {
  url: string;
  onMessage: (event: MessageEvent) => void;
  onReconnect?: () => void;
}

export function useSSE({ url, onMessage, onReconnect }: UseSSEOptions) {
  const [connectionState, setConnectionState] = useState<SSEConnectionState>("connecting");
  const [retryCount, setRetryCount] = useState(0);
  const [nextRetryIn, setNextRetryIn] = useState(0);
  const esRef = useRef<EventSource | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onMessageRef = useRef(onMessage);
  const onReconnectRef = useRef(onReconnect);

  onMessageRef.current = onMessage;
  onReconnectRef.current = onReconnect;

  const connect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
    }

    setConnectionState("connecting");
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => {
      setConnectionState("connected");
      setRetryCount(0);
      setNextRetryIn(0);
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };

    es.onmessage = (event) => {
      onMessageRef.current(event);
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
      setConnectionState("disconnected");

      setRetryCount((prev) => {
        const next = prev + 1;
        const delays = [1000, 2000, 4000, 8000, 16000, 30000];
        const delay = delays[Math.min(next - 1, delays.length - 1)];

        setNextRetryIn(Math.ceil(delay / 1000));
        countdownRef.current = setInterval(() => {
          setNextRetryIn((s) => {
            if (s <= 1) {
              if (countdownRef.current) clearInterval(countdownRef.current);
              return 0;
            }
            return s - 1;
          });
        }, 1000);

        retryTimeoutRef.current = setTimeout(() => {
          onReconnectRef.current?.();
          connect();
        }, delay);

        return next;
      });
    };
  }, [url]);

  useEffect(() => {
    connect();
    return () => {
      if (esRef.current) esRef.current.close();
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [connect]);

  return { connectionState, retryCount, nextRetryIn };
}
