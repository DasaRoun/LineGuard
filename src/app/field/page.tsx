"use client";
// 현장 작업자 모바일 화면
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Message } from "@/backend";
import { useIncident } from "@/lib/useIncident";
import { useNow } from "@/lib/useNow";
import { useGpsShare, useWakeLock } from "@/lib/useDevice";
import { loadSession, patchSession } from "@/lib/session";
import { ackOrder, locateSite, siteLabel, uploadPhotoOrVideo, type Actor } from "@/lib/actions";
import { ORDERS, type OrderKey } from "@/lib/constants";
import { playNotice, speak, unlockAudio } from "@/lib/audio";
import { hhmm } from "@/lib/time";
import MapPanel from "@/components/map/MapPanel";
import ChatPanel from "@/components/comms/ChatPanel";
import PttButton from "@/components/comms/PttButton";
import SharedFieldsPanel from "@/components/shared/SharedFieldsPanel";
import MediaViewer from "@/components/common/MediaViewer";
import Modal from "@/components/common/Modal";
import DispatchStart from "@/components/field/DispatchStart";
import StatusTab from "@/components/field/StatusTab";
import WorkTab from "@/components/field/WorkTab";
import CaptureButton from "@/components/field/CaptureButton";

type Tab = "status" | "work" | "map" | "chat" | "fields";

function Field() {
  const router = useRouter();
  const incidentId = useSearchParams().get("i");
  const [session, setSession] = useState(() => (typeof window !== "undefined" ? loadSession() : null));
  const data = useIncident(incidentId);
  const { incident, sites, dispatches, messages, live, trails, uid, error, loading } = data;
  const now = useNow(15000);
  const [tab, setTab] = useState<Tab>("status");
  const [viewer, setViewer] = useState<Message | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [mediaSheet, setMediaSheet] = useState(false);
  const seenOrders = useRef(new Set<string>());
  const firstLoad = useRef(true);

  const name = session?.incidentId === incidentId ? session.name : "";
  const myDispatch = useMemo(
    () => dispatches.find((d) => d.id === session?.dispatchId && d.uid === uid && d.phase !== "withdrawn") ?? null,
    [dispatches, session?.dispatchId, uid]
  );
  const site = sites.find((s) => s.code === myDispatch?.siteCode);
  const actor: Actor = useMemo(() => ({ incidentId: incidentId ?? "", name, dispatch: myDispatch }), [incidentId, name, myDispatch]);

  const gps = useGpsShare(incidentId, !!myDispatch, {
    name,
    siteCode: myDispatch?.siteCode ?? null,
    role: myDispatch?.role ?? null,
    dispatchId: myDispatch?.id ?? null,
  });
  useWakeLock(!!myDispatch);

  // 철수/출동종료 시 위치 삭제
  const prevDispatch = useRef<string | null>(null);
  useEffect(() => {
    if (prevDispatch.current && !myDispatch && incidentId) {
      import("@/backend").then(({ getBackend }) => getBackend().removeLive(incidentId).catch(() => {}));
    }
    prevDispatch.current = myDispatch?.id ?? null;
  }, [myDispatch, incidentId]);

  // 상황실 지시 수신 → 알림음 + 진동 + 음성낭독
  useEffect(() => {
    if (!myDispatch) return;
    for (const [k, v] of Object.entries(myDispatch.orders ?? {})) {
      if (!v) continue;
      const key = `${k}:${v.at}`;
      if (seenOrders.current.has(key)) continue;
      seenOrders.current.add(key);
      if (firstLoad.current || v.ack) continue;
      playNotice();
      navigator.vibrate?.([300, 100, 300, 100, 300]);
      speak(`상황실 지시. ${k}${v.target ? `. ${v.target}` : ""}`);
    }
    firstLoad.current = false;
  }, [myDispatch]);

  const run = useCallback((p: Promise<unknown>) => {
    p.catch((e: Error) => alert(`처리 실패: ${e.message}`));
  }, []);

  const onPhotoClick = useCallback((m: Message) => setViewer(m), []);
  const onAssignSite = useCallback(
    async (code: string, lat: number, lng: number, address: string) => {
      const s = sites.find((x) => x.code === code);
      if (s) await locateSite(actor, s, lat, lng, address);
    },
    [sites, actor]
  );

  if (!incidentId) return <Center>장애건 ID가 없습니다.</Center>;
  if (!name)
    return (
      <Center>
        <button onClick={() => router.push("/")} className="rounded-xl bg-blue-600 px-6 py-4 text-lg font-bold">
          접속코드로 참여하기
        </button>
      </Center>
    );
  if (error)
    return (
      <Center>
        <div className="space-y-3 text-center">
          <div className="text-red-400">{error}</div>
          <button onClick={() => router.push("/")} className="rounded-lg bg-slate-700 px-4 py-2">
            처음으로
          </button>
        </div>
      </Center>
    );
  if (loading || !incident || !uid) return <Center>불러오는 중…</Center>;

  const pendingOrders = myDispatch ? (Object.entries(myDispatch.orders ?? {}) as [OrderKey, NonNullable<(typeof myDispatch.orders)[OrderKey]>][]).filter(([, v]) => v && !v.ack) : [];
  const activeOrders = myDispatch ? (Object.entries(myDispatch.orders ?? {}) as [OrderKey, NonNullable<(typeof myDispatch.orders)[OrderKey]>][]).filter(([, v]) => v && v.ack) : [];

  // ── 출동 전 ──
  if (!myDispatch)
    return (
      <div className="mx-auto max-w-xl pb-6" onPointerDown={unlockAudio}>
        <Header title={incident.title} name={name} onHome={() => router.push("/")} />
        <DispatchStart
          incidentId={incidentId}
          uid={uid}
          name={name}
          sites={sites}
          dispatches={dispatches}
          onStarted={(id) => {
            patchSession({ dispatchId: id });
            setSession(loadSession());
            setTab("status");
          }}
        />
      </div>
    );

  // ── 출동 후 ──
  return (
    <div className="mx-auto flex h-dvh max-w-xl flex-col" onPointerDown={unlockAudio}>
      <header className="border-b border-slate-700 bg-slate-900 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-amber-500 px-2 text-xl font-black text-slate-900">{myDispatch.siteCode}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-bold">{siteLabel(site, myDispatch.siteCode)}</div>
            <div className="text-xs text-slate-400">
              {name} · {myDispatch.role || "역할 미선택"} ·{" "}
              {myDispatch.phase === "moving" ? <span className="text-amber-300">이동중 (출동 {hhmm(myDispatch.departAt)})</span> : <span className="text-emerald-400">도착 {hhmm(myDispatch.arriveAt)}</span>}
            </div>
          </div>
          <div className={`text-xs ${gps.on ? "text-emerald-400" : "text-slate-500"}`} title={gps.error ?? ""}>
            {gps.on ? `GPS ±${Math.round(gps.accuracy ?? 0)}m` : gps.error ? "GPS 꺼짐" : "GPS…"}
          </div>
        </div>
        {gps.error && <div className="mt-1 text-xs text-amber-300">⚠ {gps.error}</div>}
        {activeOrders.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {activeOrders.map(([k, v]) => (
              <span key={k} className="rounded px-2 py-0.5 text-xs font-bold" style={{ background: ORDERS.find((o) => o.key === k)?.color }}>
                ● {k}
                {v.target ? `: ${v.target}` : ""}
              </span>
            ))}
          </div>
        )}
      </header>

      {/* 미확인 지시 — 전체 화면 경고 */}
      {pendingOrders.length > 0 && (
        <div className="fixed inset-0 z-[950] flex flex-col items-center justify-center gap-4 bg-black/85 p-6">
          {pendingOrders.map(([k, v]) => {
            const color = ORDERS.find((o) => o.key === k)?.color;
            return (
              <div key={k} className="w-full max-w-md rounded-3xl border-4 p-6 text-center animate-pulse" style={{ borderColor: color, background: `${color}33` }}>
                <div className="text-sm text-slate-300">상황실 지시 · {hhmm(v.at)} · {v.by}</div>
                <div className="my-2 text-4xl font-black" style={{ color }}>
                  {k}
                </div>
                {v.target && <div className="mb-2 text-xl">{v.target}</div>}
                <button onClick={() => run(ackOrder(actor, k))} className="w-full rounded-2xl p-5 text-2xl font-black text-white" style={{ background: color }}>
                  확인
                </button>
              </div>
            );
          })}
        </div>
      )}

      <nav className="grid grid-cols-5 border-b border-slate-700 bg-slate-900 text-sm">
        {(
          [
            ["status", "상태"],
            ["work", "작업"],
            ["map", "지도"],
            ["chat", "채팅"],
            ["fields", "연동"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`py-3 font-bold ${tab === k ? "border-b-4 border-blue-500 bg-slate-800 text-white" : "text-slate-400"}`}>
            {l}
          </button>
        ))}
      </nav>

      <main className="min-h-0 flex-1 overflow-y-auto">
        {tab === "status" && (
          <div className="p-3">
            <StatusTab actor={actor} d={myDispatch} site={site} now={now} gps={gps} run={run} />
          </div>
        )}
        {tab === "work" && (
          <div className="p-3">
            <WorkTab actor={actor} d={myDispatch} site={site} run={run} onProgress={setProgress} />
          </div>
        )}
        {tab === "map" && (
          <div className="h-full p-2">
            <MapPanel
              className="h-full"
              sites={sites}
              dispatches={dispatches}
              messages={messages}
              live={live}
              trails={trails}
              myUid={uid}
              onPhotoClick={onPhotoClick}
              onAssignSite={onAssignSite}
            />
          </div>
        )}
        {tab === "chat" && <ChatPanel actor={actor} messages={messages} myUid={uid} onMediaClick={setViewer} big className="h-full" />}
        {tab === "fields" && (
          <div className="p-3">
            <SharedFieldsPanel actor={actor} incident={incident} big />
          </div>
        )}
      </main>

      {/* 하단 고정: 사진 + PTT */}
      <footer className="flex gap-2 border-t border-slate-700 bg-slate-900 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <button onClick={() => setMediaSheet(true)} className="h-24 w-24 shrink-0 rounded-2xl bg-sky-700 text-4xl active:scale-95" aria-label="사진·동영상">
          📷
        </button>
        <div className="flex-1">
          <PttButton actor={actor} />
        </div>
      </footer>

      <Modal open={mediaSheet} onClose={() => setMediaSheet(false)} title="현장 채증">
        <div className="grid gap-2">
          {(
            [
              ["📷 사진 촬영", "image/*", "environment"],
              ["🎬 동영상 촬영", "video/*", "environment"],
              ["🖼️ 앨범에서 선택", "image/*,video/*", null],
            ] as const
          ).map(([label, accept, capture]) => (
            <CaptureButton
              key={label}
              accept={accept}
              capture={capture}
              onFile={(f) => {
                setMediaSheet(false);
                setProgress(0);
                run(uploadPhotoOrVideo(actor, f, { onProgress: setProgress }).finally(() => setProgress(null)));
              }}
              className="min-h-16 rounded-2xl bg-slate-700 p-4 text-xl font-bold"
            >
              {label}
            </CaptureButton>
          ))}
        </div>
      </Modal>

      {progress != null && (
        <div className="fixed inset-x-0 top-0 z-[999] bg-blue-700 px-3 py-2 text-center font-bold">
          ⬆ 업로드 중 {progress}%
          <div className="mt-1 h-1.5 rounded bg-blue-950">
            <div className="h-full rounded bg-white" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <MediaViewer msg={viewer} onClose={() => setViewer(null)} />
    </div>
  );
}

function Header({ title, name, onHome }: { title: string; name: string; onHome: () => void }) {
  return (
    <header className="flex items-center gap-2 border-b border-slate-700 bg-slate-900 px-3 py-3">
      <button onClick={onHome} className="text-lg font-black">
        <span className="text-sky-400">Line</span>Guard
      </button>
      <div className="min-w-0 flex-1 truncate text-sm text-slate-300">{title}</div>
      <div className="text-sm">{name}</div>
    </header>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex h-dvh items-center justify-center p-6 text-slate-300">{children}</div>;
}

export default function FieldPage() {
  return (
    <Suspense fallback={<Center>불러오는 중…</Center>}>
      <Field />
    </Suspense>
  );
}
