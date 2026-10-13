"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
// ─────────────────────────────────────────────────────────────
// 관제 지도: 지번 검색 · 지점 마커 · 출동자 실시간 위치/이동경로 · 사진 마커 · 단선지점
// ─────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, LivePosition, Message, Site } from "@/backend";
import { kakaoKeyConfigured, loadKakao, reverseGeocode, searchPlace, type SearchResult } from "@/lib/kakao";
import { getCurrentPosition } from "@/lib/media";
import { hhmm } from "@/lib/time";

const ROLE_COLORS: Record<string, string> = {
  접속팀: "#3b82f6",
  버켓신호수: "#f97316",
  통행신호수: "#eab308",
  외선팀: "#8b5cf6",
  감시인: "#14b8a6",
  현장지원: "#64748b",
  현장지휘자: "#ef4444",
  상황실: "#ec4899",
  원격지원실: "#06b6d4",
};
export const roleColor = (r?: string | null) => (r && ROLE_COLORS[r]) || "#22c55e";

interface Props {
  sites: Site[];
  dispatches: Dispatch[];
  messages: Message[];
  live: LivePosition[];
  trails: Record<string, { lat: number; lng: number }[]>;
  myUid?: string | null;
  onPhotoClick?: (m: Message) => void;
  onAssignSite?: (siteCode: string, lat: number, lng: number, address: string) => Promise<void>;
  className?: string;
}

interface Pending {
  lat: number;
  lng: number;
  address: string;
}

export default function MapPanel({ sites, dispatches, messages, live, trails, myUid, onPhotoClick, onAssignSite, className = "" }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const pendingOverlayRef = useRef<any>(null);
  const fittedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(kakaoKeyConfigured() ? null : "Kakao JavaScript 키가 설정되지 않았습니다.");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [assignCode, setAssignCode] = useState<string>("");
  const [show, setShow] = useState({ photos: true, trails: true, sites: true, people: true });

  const photoMsgs = useMemo(
    () => messages.filter((m) => m.lat != null && m.lng != null && (m.type === "photo" || m.type === "video" || m.isBreakPoint)),
    [messages]
  );

  // 지도 생성
  useEffect(() => {
    if (!kakaoKeyConfigured()) return;
    let ro: ResizeObserver | null = null;
    loadKakao()
      .then((kakao) => {
        if (!boxRef.current || mapRef.current) return;
        const map = new kakao.maps.Map(boxRef.current, { center: new kakao.maps.LatLng(37.5665, 126.978), level: 7 });
        map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
        map.addControl(new kakao.maps.MapTypeControl(), kakao.maps.ControlPosition.TOPRIGHT);
        mapRef.current = map;
        if (onAssignSite) {
          kakao.maps.event.addListener(map, "click", async (e: any) => {
            const lat = e.latLng.getLat();
            const lng = e.latLng.getLng();
            const address = await reverseGeocode(lat, lng);
            setPending({ lat, lng, address });
          });
        }
        ro = new ResizeObserver(() => map.relayout());
        ro.observe(boxRef.current);
        setReady(true);
      })
      .catch((e: Error) => setErr(e.message));
    return () => ro?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 데이터 → 오버레이 다시 그리기
  useEffect(() => {
    const kakao = window.kakao;
    const map = mapRef.current;
    if (!ready || !map) return;
    overlaysRef.current.forEach((o) => o.setMap(null));
    overlaysRef.current = [];
    const add = (o: any) => {
      o.setMap(map);
      overlaysRef.current.push(o);
    };
    const bounds = new kakao.maps.LatLngBounds();
    let hasPoint = false;
    const extend = (lat: number, lng: number) => {
      bounds.extend(new kakao.maps.LatLng(lat, lng));
      hasPoint = true;
    };

    // 지점 마커
    if (show.sites)
      for (const s of sites) {
        if (s.lat == null || s.lng == null) continue;
        const el = document.createElement("div");
        el.className = "lg-site";
        el.innerHTML = `<span class="lg-site-code">${s.code}</span><span class="lg-site-name">${escapeHtml(s.name || "명칭 미입력")}</span>`;
        add(new kakao.maps.CustomOverlay({ position: new kakao.maps.LatLng(s.lat, s.lng), content: el, yAnchor: 1.2, zIndex: 3 }));
        extend(s.lat, s.lng);
      }

    // 이동 경로 (메모리)
    if (show.trails)
      for (const [uid, pts] of Object.entries(trails)) {
        if (pts.length < 2) continue;
        const p = live.find((l) => l.uid === uid);
        add(
          new kakao.maps.Polyline({
            path: pts.map((x) => new kakao.maps.LatLng(x.lat, x.lng)),
            strokeWeight: 4,
            strokeColor: roleColor(p?.role),
            strokeOpacity: 0.8,
            strokeStyle: "solid",
          })
        );
      }

    // 사진 마커 / 단선지점
    if (show.photos)
      for (const m of photoMsgs) {
        const el = document.createElement("div");
        const site = sites.find((s) => s.code === m.siteCode);
        const label = m.isBreakPoint ? `단선 · ${m.siteCode ?? ""}지점${site?.name ? `(${escapeHtml(site.name)})` : ""}` : "";
        if (m.mediaUrl && m.type === "photo") {
          el.className = `lg-photo ${m.isBreakPoint ? "lg-break" : ""}`;
          el.innerHTML = `<img src="${m.mediaUrl}" alt="" />${label ? `<div class="lg-photo-label">${label}</div>` : ""}`;
        } else if (m.type === "video") {
          el.className = "lg-photo";
          el.innerHTML = `<div class="lg-video">🎬</div>`;
        } else {
          el.className = "lg-breakpin";
          el.innerHTML = `<div class="lg-x">✖</div><div class="lg-photo-label">${label}</div>`;
        }
        el.title = `${m.authorName} ${hhmm(m.clientAt)}`;
        el.onclick = () => (m.mediaUrl ? onPhotoClick?.(m) : undefined);
        add(new kakao.maps.CustomOverlay({ position: new kakao.maps.LatLng(m.lat, m.lng), content: el, yAnchor: 1, zIndex: m.isBreakPoint ? 6 : 4 }));
        extend(m.lat!, m.lng!);
      }

    // 출동자 실시간 위치
    if (show.people)
      for (const p of live) {
        const d = dispatches.find((x) => x.id === p.dispatchId);
        if (d?.phase === "withdrawn") continue;
        const el = document.createElement("div");
        el.className = `lg-person ${p.uid === myUid ? "lg-me" : ""}`;
        const age = Math.floor((Date.now() - p.updatedAt) / 60000);
        el.innerHTML = `<div class="lg-dot" style="background:${roleColor(p.role)}"></div><div class="lg-person-label">${escapeHtml(
          p.name
        )}${p.siteCode ? ` · ${p.siteCode}` : ""}${age >= 2 ? ` · ${age}분전` : ""}</div>`;
        add(new kakao.maps.CustomOverlay({ position: new kakao.maps.LatLng(p.lat, p.lng), content: el, yAnchor: 0.5, zIndex: 8 }));
        extend(p.lat, p.lng);
      }

    if (hasPoint && !fittedRef.current) {
      map.setBounds(bounds, 60, 60, 60, 60);
      fittedRef.current = true;
    }
  }, [ready, sites, dispatches, photoMsgs, live, trails, myUid, show, onPhotoClick]);

  // 선택 위치 임시 마커
  useEffect(() => {
    const kakao = window.kakao;
    if (!ready) return;
    pendingOverlayRef.current?.setMap(null);
    if (!pending) return;
    const el = document.createElement("div");
    el.className = "lg-pending";
    el.textContent = "📌";
    const o = new kakao.maps.CustomOverlay({ position: new kakao.maps.LatLng(pending.lat, pending.lng), content: el, yAnchor: 1, zIndex: 9 });
    o.setMap(mapRef.current);
    pendingOverlayRef.current = o;
  }, [pending, ready]);

  const doSearch = async () => {
    if (!q.trim()) return;
    setSearching(true);
    try {
      const r = await searchPlace(q.trim());
      setResults(r);
      if (!r.length) alert("검색 결과가 없습니다. 지번은 '동 이름 + 번지' 형태로 입력해 보세요. (예: 역삼동 737)");
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSearching(false);
    }
  };

  const pick = (r: SearchResult) => {
    const kakao = window.kakao;
    mapRef.current?.setCenter(new kakao.maps.LatLng(r.lat, r.lng));
    mapRef.current?.setLevel(3);
    setPending({ lat: r.lat, lng: r.lng, address: r.kind === "장소" ? `${r.title} (${r.address})` : r.title });
    setResults([]);
  };

  const goMyLocation = async () => {
    const p = await getCurrentPosition();
    if (!p) return alert("위치를 가져올 수 없습니다. 브라우저 위치 권한을 허용해 주세요.");
    const kakao = window.kakao;
    mapRef.current?.setCenter(new kakao.maps.LatLng(p.lat, p.lng));
    mapRef.current?.setLevel(3);
  };

  const assign = async () => {
    if (!pending || !assignCode || !onAssignSite) return;
    await onAssignSite(assignCode, pending.lat, pending.lng, pending.address);
    setPending(null);
  };

  return (
    <div className={`relative flex flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 ${className}`}>
      {/* 검색창 */}
      <div className="absolute left-2 top-2 z-10 w-[min(420px,calc(100%-90px))]">
        <div className="flex gap-1">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doSearch()}
            placeholder="지번·도로명·장소 검색 (예: 역삼동 737)"
            className="flex-1 min-w-0 rounded-lg bg-slate-900/95 border border-slate-600 px-3 py-2 text-sm"
          />
          <button onClick={doSearch} disabled={searching} className="rounded-lg bg-blue-600 px-3 text-sm font-bold">
            {searching ? "…" : "검색"}
          </button>
          <button onClick={goMyLocation} className="rounded-lg bg-slate-700 px-3 text-sm" title="내 위치로 이동">
            🎯
          </button>
        </div>
        {results.length > 0 && (
          <div className="mt-1 max-h-64 overflow-auto rounded-lg bg-slate-900/95 border border-slate-600">
            {results.map((r, i) => (
              <button key={i} onClick={() => pick(r)} className="block w-full text-left px-3 py-2 hover:bg-slate-700 border-b border-slate-800">
                <span className="mr-2 rounded bg-slate-700 px-1.5 text-[10px]">{r.kind}</span>
                <span className="text-sm">{r.title}</span>
                <div className="text-xs text-slate-400">{r.address}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 표시 옵션 */}
      <div className="absolute left-2 bottom-2 z-10 flex gap-1 text-xs">
        {(
          [
            ["sites", "지점"],
            ["people", "출동자"],
            ["trails", "경로"],
            ["photos", "사진"],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setShow((s) => ({ ...s, [k]: !s[k] }))}
            className={`rounded-md px-2 py-1 ${show[k] ? "bg-blue-600" : "bg-slate-800/90 text-slate-400"}`}
          >
            {l}
          </button>
        ))}
      </div>

      {/* 선택 위치 → 지점 지정 */}
      {pending && onAssignSite && (
        <div className="absolute right-2 bottom-2 z-10 w-72 rounded-xl bg-slate-900/95 border border-slate-600 p-3 text-sm space-y-2">
          <div className="font-bold">📌 선택한 위치</div>
          <div className="text-slate-300">{pending.address || `${pending.lat.toFixed(5)}, ${pending.lng.toFixed(5)}`}</div>
          <div className="flex gap-1">
            <select value={assignCode} onChange={(e) => setAssignCode(e.target.value)} className="flex-1 rounded-lg bg-slate-800 border border-slate-600 p-2">
              <option value="">지점 선택</option>
              {sites.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.code}지점 {s.name ? `(${s.name})` : ""}
                </option>
              ))}
            </select>
            <button onClick={assign} disabled={!assignCode} className="rounded-lg bg-blue-600 px-3 font-bold disabled:opacity-40">
              지정
            </button>
          </div>
          <button onClick={() => setPending(null)} className="w-full rounded-lg bg-slate-700 py-1">
            취소
          </button>
        </div>
      )}

      <div ref={boxRef} className="flex-1 min-h-[240px]" />
      {err && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 p-6 text-center text-sm text-amber-300">
          🗺️ {err}
          <br />
          (.env.local 의 NEXT_PUBLIC_KAKAO_JS_KEY 와 Kakao Developers 의 Web 플랫폼 도메인 등록을 확인하세요)
        </div>
      )}
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
