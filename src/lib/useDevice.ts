"use client";
// 현장 작업자에게 필요한 브라우저 기능: GPS 공유(덮어쓰기 전용), 화면 꺼짐 방지
import { useEffect, useRef, useState } from "react";
import { getBackend } from "@/backend";
import { distanceM } from "./time";

export interface GpsState {
  on: boolean;
  lat?: number;
  lng?: number;
  accuracy?: number;
  error?: string | null;
  lastSentAt?: number;
}

/** GPS 실시간 공유 — 10m 이상 이동 또는 10초 경과 시 최신 위치 1건만 덮어씀 (이력 저장 안 함) */
export function useGpsShare(
  incidentId: string | null,
  enabled: boolean,
  meta: { name: string; siteCode: string | null; role: string | null; dispatchId: string | null }
): GpsState {
  const [st, setSt] = useState<GpsState>({ on: false });
  const lastRef = useRef<{ lat: number; lng: number; at: number } | null>(null);
  const metaRef = useRef(meta);
  metaRef.current = meta;

  useEffect(() => {
    if (!incidentId || !enabled) return;
    if (!("geolocation" in navigator)) {
      setSt({ on: false, error: "이 기기는 GPS를 지원하지 않습니다." });
      return;
    }
    const be = getBackend();
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const cur = { lat: p.coords.latitude, lng: p.coords.longitude };
        const now = Date.now();
        setSt((s) => ({ ...s, on: true, ...cur, accuracy: p.coords.accuracy, error: null }));
        const last = lastRef.current;
        if (!last || now - last.at > 10000 || distanceM(last, cur) > 10) {
          lastRef.current = { ...cur, at: now };
          be.updateLive(incidentId, { ...metaRef.current, ...cur, accuracy: p.coords.accuracy })
            .then(() => setSt((s) => ({ ...s, lastSentAt: now })))
            .catch(() => {});
        }
      },
      (e) => setSt({ on: false, error: e.code === 1 ? "위치 권한이 거부되었습니다. 브라우저 설정에서 허용해 주세요." : e.message }),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    return () => {
      navigator.geolocation.clearWatch(id);
      lastRef.current = null;
      setSt({ on: false });
    };
  }, [incidentId, enabled]);

  // 역할/지점 변경 시 즉시 반영
  useEffect(() => {
    const last = lastRef.current;
    if (incidentId && enabled && last) {
      getBackend()
        .updateLive(incidentId, { ...meta, lat: last.lat, lng: last.lng, accuracy: st.accuracy ?? 0 })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.role, meta.siteCode, meta.dispatchId]);

  return st;
}

/** 화면 꺼짐 방지 (지원 브라우저만) */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !("wakeLock" in navigator)) return;
    let lock: { release: () => Promise<void> } | null = null;
    const req = async () => {
      try {
        lock = await (navigator as unknown as { wakeLock: { request: (t: string) => Promise<typeof lock> } }).wakeLock.request("screen");
      } catch {
        /* 무시 */
      }
    };
    void req();
    const onVis = () => document.visibilityState === "visible" && void req();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      void lock?.release().catch(() => {});
    };
  }, [enabled]);
}
