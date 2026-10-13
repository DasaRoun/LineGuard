"use client";
// 현장 [작업] 탭 — 단선지점 · OTDR · 단선작업 · 절체작업 · 함체확인
import type { Dispatch, Site } from "@/backend";
import { CLOSURE_RESULTS, CLOSURE_SIDES, OTDR_SIGNAL, OTDR_SOURCE, WORK_SIGNAL, WORK_STEPS } from "@/lib/constants";
import {
  confirmBreakWithPhoto,
  registerMyLocationAsBreak,
  setOtdr,
  setWorkSignal,
  toggleClosure,
  toggleWorkStep,
  uploadPhotoOrVideo,
  type Actor,
} from "@/lib/actions";
import { hhmm } from "@/lib/time";
import EditableField from "../common/EditableField";
import CaptureButton from "./CaptureButton";
import { Section, Tile } from "./Tile";

export default function WorkTab({
  actor,
  d,
  site,
  run,
  onProgress,
}: {
  actor: Actor;
  d: Dispatch;
  site?: Site;
  run: (p: Promise<unknown>) => void;
  onProgress: (p: number | null) => void;
}) {
  const upload = (p: Promise<unknown>) => {
    onProgress(0);
    run(p.finally(() => onProgress(null)));
  };

  const Work = ({ kind, title }: { kind: "cutWork" | "switchWork"; title: string }) => {
    const w = d[kind] ?? { signal: null, steps: {} };
    const done = WORK_STEPS.filter((s) => w.steps?.[s]).length;
    return (
      <Section title={title} right={<span className="text-sm text-slate-400">{done}/5</span>}>
        <div className="grid grid-cols-2 gap-2">
          {WORK_SIGNAL.map((s) => (
            <Tile key={s} on={w.signal === s} tone={s.includes("정상") ? "green" : "red"} onClick={() => run(setWorkSignal(actor, kind, s))}>
              {s}
            </Tile>
          ))}
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-700">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(done / 5) * 100}%` }} />
        </div>
        <div className="mt-2 grid grid-cols-1 gap-2">
          {WORK_STEPS.map((s, i) => {
            const at = w.steps?.[s];
            return (
              <Tile
                key={s}
                on={!!at}
                tone={s === "복구완료" ? "green" : "blue"}
                onClick={() => {
                  if (at && !confirm(`'${s}' 기록(${hhmm(at)})을 취소할까요?`)) return;
                  run(toggleWorkStep(actor, kind, s));
                }}
                className="flex items-center justify-between text-left"
              >
                <span className="flex w-full items-center justify-between">
                  <span>
                    {i + 1}. {s}
                  </span>
                  <span className="tabular-nums">{at ? `✔ ${hhmm(at)}` : ""}</span>
                </span>
              </Tile>
            );
          })}
        </div>
      </Section>
    );
  };

  return (
    <div className="space-y-3">
      <Section title="📍 단선지점" right={d.breakConfirmedAt ? <span className="text-sm text-red-300">확인 {hhmm(d.breakConfirmedAt)}</span> : null}>
        <div className="grid grid-cols-1 gap-2">
          <CaptureButton
            onFile={(f) => upload(confirmBreakWithPhoto(actor, f, site, (p) => onProgress(p)))}
            className="min-h-20 rounded-2xl border-2 border-red-300 bg-red-600 p-4 text-xl font-black active:scale-95"
          >
            📷 단선지점 확인완료 (사진촬영)
          </CaptureButton>
          <button
            onClick={() => run(registerMyLocationAsBreak(actor, site))}
            className="min-h-16 rounded-2xl border-2 border-slate-500 bg-slate-800 p-3 text-lg font-bold active:scale-95"
          >
            📍 내 위치를 단선지점으로 등록
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-400">촬영 위치(GPS)에 사진이 지도 마커로 표시됩니다. 표시명: {site ? `${site.code}지점 ${site.name}` : d.siteCode}</p>
      </Section>

      <Section title="📈 OTDR 측정">
        <CaptureButton
          onFile={(f) => upload(uploadPhotoOrVideo(actor, f, { caption: "OTDR 측정화면", category: "OTDR", onProgress: (p) => onProgress(p) }))}
          className="mb-2 w-full min-h-16 rounded-2xl border-2 border-blue-300 bg-blue-700 p-3 text-lg font-bold active:scale-95"
        >
          📷 OTDR 측정화면 촬영
        </CaptureButton>
        <div className="mb-2 rounded-xl bg-slate-800 p-2">
          <EditableField
            label="긍장 (단선 추정 거리)"
            value={d.otdr?.lengthM ?? ""}
            suffix="m"
            inputMode="decimal"
            big
            onSave={(v) => setOtdr(actor, { lengthM: v }, `OTDR 긍장 ${v}m`)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {OTDR_SOURCE.map((s) => (
            <Tile key={s} on={d.otdr?.source === s} tone={s.includes("정상") ? "green" : "red"} onClick={() => run(setOtdr(actor, { source: s }, `OTDR ${s}`))}>
              {s}
            </Tile>
          ))}
          {OTDR_SIGNAL.map((s) => (
            <Tile key={s} on={d.otdr?.signal === s} tone={s.includes("정상") ? "green" : "red"} onClick={() => run(setOtdr(actor, { signal: s }, `OTDR ${s}`))}>
              {s}
            </Tile>
          ))}
        </div>
      </Section>

      <Work kind="cutWork" title="🔧 단선작업" />
      <Work kind="switchWork" title="🔀 절체작업" />

      <Section title="📦 함체 확인">
        {CLOSURE_SIDES.map((side) => (
          <div key={side} className="mb-2">
            <div className="mb-1 font-bold text-amber-300">{side}지점 확인</div>
            <div className="grid grid-cols-3 gap-2">
              {CLOSURE_RESULTS.map((r) => (
                <Tile key={r} on={(d.closure?.[side] ?? []).includes(r)} tone="orange" onClick={() => run(toggleClosure(actor, side, r))} className="text-sm">
                  {r}
                </Tile>
              ))}
            </div>
          </div>
        ))}
      </Section>
    </div>
  );
}
