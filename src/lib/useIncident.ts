"use client";
// 장애건 데이터 실시간 구독 훅 — 화면은 이 훅 하나로 모든 데이터를 받습니다.
import { useEffect, useRef, useState } from "react";
import { getBackend, type Dispatch, type Incident, type LivePosition, type Message, type Site } from "@/backend";

export interface IncidentData {
  incident: Incident | null;
  sites: Site[];
  dispatches: Dispatch[];
  messages: Message[];
  live: LivePosition[];
  /** 브라우저 메모리에만 쌓는 이동 경로 (저장하지 않음) */
  trails: Record<string, { lat: number; lng: number }[]>;
  loading: boolean;
  error: string | null;
  uid: string | null;
}

export function useIncident(incidentId: string | null): IncidentData {
  const [incident, setIncident] = useState<Incident | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [live, setLive] = useState<LivePosition[]>([]);
  const [trails, setTrails] = useState<Record<string, { lat: number; lng: number }[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const trailRef = useRef<Record<string, { lat: number; lng: number }[]>>({});

  useEffect(() => {
    if (!incidentId) return;
    const be = getBackend();
    const offs: (() => void)[] = [];
    let cancelled = false;
    be.ensureAuth()
      .then((u) => {
        if (cancelled) return;
        setUid(u);
        offs.push(
          be.subscribeIncident(
            incidentId,
            (v) => {
              setIncident(v);
              setLoading(false);
            },
            (e) => {
              setError(
                e.message.includes("permission") ? "접근 권한이 없습니다. 접속코드로 다시 참여하세요." : e.message
              );
              setLoading(false);
            }
          )
        );
        offs.push(be.subscribeSites(incidentId, setSites));
        offs.push(be.subscribeDispatches(incidentId, setDispatches));
        offs.push(be.subscribeMessages(incidentId, setMessages));
        offs.push(
          be.subscribeLive(incidentId, (list) => {
            setLive(list);
            // 경로선: 메모리에만 누적 (최대 500점)
            const t = { ...trailRef.current };
            for (const p of list) {
              const arr = t[p.uid] ? [...t[p.uid]] : [];
              const last = arr[arr.length - 1];
              if (!last || last.lat !== p.lat || last.lng !== p.lng) arr.push({ lat: p.lat, lng: p.lng });
              t[p.uid] = arr.slice(-500);
            }
            trailRef.current = t;
            setTrails(t);
          })
        );
      })
      .catch((e: Error) => {
        setError(e.message);
        setLoading(false);
      });
    return () => {
      cancelled = true;
      offs.forEach((f) => f());
    };
  }, [incidentId]);

  return { incident, sites, dispatches, messages, live, trails, loading, error, uid };
}
