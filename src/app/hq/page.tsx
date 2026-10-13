"use client";
// 상황실(HQ) 관제 대시보드
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getBackend, type Message } from "@/backend";
import { useIncident } from "@/lib/useIncident";
import { useNow } from "@/lib/useNow";
import { loadSession } from "@/lib/session";
import { locateSite, updateIncidentMeta, type Actor } from "@/lib/actions";
import { playAlarm, unlockAudio } from "@/lib/audio";
import { generateReport } from "@/lib/report";
import { hhmm } from "@/lib/time";
import MapPanel from "@/components/map/MapPanel";
import SitesBoard from "@/components/dispatch/SitesBoard";
import ChatPanel from "@/components/comms/ChatPanel";
import PttButton from "@/components/comms/PttButton";
import SharedFieldsPanel from "@/components/shared/SharedFieldsPanel";
import Topology from "@/components/shared/Topology";
import EditableField from "@/components/common/EditableField";
import MediaViewer from "@/components/common/MediaViewer";

function HQ() {
  const router = useRouter();
  const incidentId = useSearchParams().get("i");
  const session = typeof window !== "undefined" ? loadSession() : null;
  const data = useIncident(incidentId);
  const { incident, sites, dispatches, messages, live, trails, uid, error, loading } = data;
  const now = useNow(15000);
  const [viewer, setViewer] = useState<Message | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<"chat" | "fields">("chat");
  const alarmed = useRef(new Set<string>());

  const name = session?.incidentId === incidentId ? session.name : "상황실";
  const actor: Actor = useMemo(() => ({ incidentId: incidentId ?? "", name }), [incidentId, name]);

  // 작업중지권 발행 경보
  const stopWork = dispatches.filter((d) => d.phase !== "withdrawn" && d.statuses.includes("작업중지권발행"));
  const danger = dispatches.filter((d) => d.phase !== "withdrawn" && d.statuses.some((s) => ["화재진입불가", "침수진입불가", "한전작업중"].includes(s)));
  useEffect(() => {
    for (const d of stopWork) {
      if (!alarmed.current.has(d.id)) {
        alarmed.current.add(d.id);
        playAlarm();
      }
    }
    for (const id of [...alarmed.current]) if (!stopWork.find((d) => d.id === id)) alarmed.current.delete(id);
  }, [stopWork]);

  const photos = useMemo(() => messages.filter((m) => (m.type === "photo" || m.type === "video") && m.mediaUrl).reverse(), [messages]);
  const onPhotoClick = useCallback((m: Message) => setViewer(m), []);

  const onAssignSite = useCallback(
    async (code: string, lat: number, lng: number, address: string) => {
      const s = sites.find((x) => x.code === code);
      if (s) await locateSite(actor, s, lat, lng, address);
    },
    [sites, actor]
  );

  const report = async () => {
    if (!incident) return;
    setReporting("준비 중…");
    try {
      const r = await generateReport(getBackend(), incident, sites, dispatches, messages, setReporting);
      if (r.photoFailed > 0)
        alert(`보고서를 저장했습니다.\n사진 ${r.photoFailed}장은 이미지 삽입에 실패하여 링크로 대체했습니다.\n(Storage CORS 설정 필요 — README 참고)`);
    } catch (e) {
      alert(`보고서 생성 실패: ${(e as Error).message}`);
    } finally {
      setReporting(null);
    }
  };

  const copyInvite = async () => {
    if (!incident) return;
    const url = `${location.origin}${process.env.NEXT_PUBLIC_BASE_PATH || ""}/?code=${incident.code}`;
    const text = `[LineGuard] ${incident.title}\n접속코드: ${incident.code}\n${url}`;
    try {
      await navigator.clipboard.writeText(text);
      alert("초대 문구를 복사했습니다. 문자/메신저에 붙여넣기 하세요.");
    } catch {
      prompt("아래 내용을 복사하세요", text);
    }
  };

  if (!incidentId) return <Center>장애건 ID가 없습니다.</Center>;
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
  if (loading || !incident) return <Center>불러오는 중…</Center>;

  const activeCount = dispatches.filter((d) => d.phase !== "withdrawn").length;
  const movingCount = dispatches.filter((d) => d.phase === "moving").length;

  return (
    <div className="flex h-dvh flex-col" onPointerDown={unlockAudio}>
      {/* 상단 바 */}
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-700 bg-slate-900 px-4 py-2">
        <button onClick={() => router.push("/")} className="text-xl font-black">
          <span className="text-sky-400">Line</span>Guard
        </button>
        <div className="min-w-48 max-w-md flex-1">
          <EditableField value={incident.title} onSave={(v) => updateIncidentMeta(actor, { title: v }, `장애건명 변경: ${v}`)} />
        </div>
        <button onClick={copyInvite} className="rounded-lg bg-slate-800 border border-slate-600 px-3 py-1.5 text-sm" title="초대 문구 복사">
          접속코드 <b className="text-lg tracking-widest text-amber-300">{incident.code}</b> 📋
        </button>
        <div className="text-sm text-slate-300">
          출동 <b>{activeCount}</b>명 · 이동중 <b className="text-amber-300">{movingCount}</b> · 현장 <b className="text-emerald-400">{activeCount - movingCount}</b>
        </div>
        <span className="flex-1" />
        <span className="text-sm text-slate-400">{name}</span>
        <button onClick={report} disabled={!!reporting} className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 font-bold disabled:opacity-60">
          {reporting ? `📊 ${reporting}` : "📊 복구보고서"}
        </button>
      </header>

      {stopWork.length > 0 && (
        <div className="animate-pulse bg-red-700 px-4 py-2 text-center text-lg font-black">
          ⛔ 작업중지권 발행 — {stopWork.map((d) => `${d.name}(${d.siteCode}지점)`).join(", ")}
        </div>
      )}
      {danger.length > 0 && (
        <div className="bg-orange-800 px-4 py-1 text-center text-sm font-bold">
          ⚠ {danger.map((d) => `${d.name}(${d.siteCode}): ${d.statuses.filter((s) => ["화재진입불가", "침수진입불가", "한전작업중"].includes(s)).join("/")}`).join(" · ")}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 p-2 lg:grid-cols-[360px_1fr_380px]">
        {/* 좌: 지점·출동자 */}
        <aside className="min-h-0 overflow-y-auto pr-1">
          <SitesBoard actor={actor} sites={sites} dispatches={dispatches} live={live} now={now} canOrder />
        </aside>

        {/* 중: 지도 + 모식도 + 갤러리 */}
        <section className="flex min-h-0 flex-col gap-2">
          <MapPanel
            className="min-h-[360px] flex-[3]"
            sites={sites}
            dispatches={dispatches}
            messages={messages}
            live={live}
            trails={trails}
            myUid={uid}
            onPhotoClick={onPhotoClick}
            onAssignSite={onAssignSite}
          />
          <Topology actor={actor} incident={incident} sites={sites} dispatches={dispatches} />
          <div className="min-h-[120px] flex-1 overflow-hidden rounded-xl border border-slate-700 bg-slate-800 p-2">
            <div className="mb-1 text-xs text-slate-400">현장 채증 사진/영상 ({photos.length})</div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {photos.length === 0 && <div className="text-sm text-slate-500">아직 업로드된 사진이 없습니다.</div>}
              {photos.map((m) => (
                <button key={m.id} onClick={() => setViewer(m)} className="relative shrink-0">
                  {m.type === "photo" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.mediaUrl!} alt="" loading="lazy" className={`h-24 w-32 rounded-lg object-cover ${m.isBreakPoint ? "ring-4 ring-red-500" : ""}`} />
                  ) : (
                    <div className="flex h-24 w-32 items-center justify-center rounded-lg bg-slate-900 text-3xl">🎬</div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 rounded-b-lg bg-black/70 px-1 text-[10px]">
                    {m.siteCode ?? ""} · {m.authorName} · {hhmm(m.clientAt)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 우: 채팅 / 연동 입력창 */}
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-800">
          <div className="grid grid-cols-2 border-b border-slate-700 text-sm">
            <button onClick={() => setRightTab("chat")} className={`py-2 ${rightTab === "chat" ? "bg-slate-700 font-bold" : ""}`}>
              💬 채팅·무전
            </button>
            <button onClick={() => setRightTab("fields")} className={`py-2 ${rightTab === "fields" ? "bg-slate-700 font-bold" : ""}`}>
              🔗 연동 입력창
            </button>
          </div>
          {rightTab === "chat" ? (
            <ChatPanel actor={actor} messages={messages} myUid={uid} onMediaClick={setViewer} className="flex-1" />
          ) : (
            <div className="flex-1 overflow-y-auto p-2">
              <SharedFieldsPanel actor={actor} incident={incident} />
            </div>
          )}
          <div className="border-t border-slate-700 p-2">
            <PttButton actor={actor} size="small" hotkey />
          </div>
        </aside>
      </div>

      <MediaViewer msg={viewer} onClose={() => setViewer(null)} />
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex h-dvh items-center justify-center p-6 text-slate-300">{children}</div>;
}

export default function HQPage() {
  return (
    <Suspense fallback={<Center>불러오는 중…</Center>}>
      <HQ />
    </Suspense>
  );
}
