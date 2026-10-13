"use client";
import { useEffect, useState } from "react";

/** 주기적으로 현재 시각을 갱신 (경과시간 표시용) */
export function useNow(intervalMs = 15000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
