"use client";
// 선로 토폴로지 모식도: 상위국 ── A ── B ── … ── 하위국, 구간 클릭으로 단선구역(✖) 지정
import type { Dispatch, Incident, Site } from "@/backend";
import { updateIncidentMeta, type Actor } from "@/lib/actions";
import EditableField from "../common/EditableField";

export default function Topology({ actor, incident, sites, dispatches }: { actor: Actor; incident: Incident; sites: Site[]; dispatches: Dispatch[] }) {
  const nodes = [...sites].sort((a, b) => a.order - b.order);
  const toggleBreak = (after: string) =>
    updateIncidentMeta(
      actor,
      { breakAfter: incident.breakAfter === after ? null : after },
      incident.breakAfter === after ? "단선구역 표시 해제" : `단선구역 지정: ${after === "UPPER" ? "상위국" : `${after}지점`} 다음 구간`
    );

  const Link = ({ after }: { after: string }) => {
    const isBreak = incident.breakAfter === after;
    return (
      <button
        onClick={() => toggleBreak(after)}
        title="클릭하여 단선구역 지정/해제"
        className="relative flex-1 min-w-8 h-8 flex items-center group"
      >
        <div className={`h-1 w-full ${isBreak ? "bg-red-500/60 [background:repeating-linear-gradient(90deg,#ef4444_0_6px,transparent_6px_10px)]" : "bg-sky-500 group-hover:bg-sky-300"}`} />
        {isBreak && <span className="absolute left-1/2 -translate-x-1/2 text-red-500 font-black text-lg animate-pulse">✖</span>}
      </button>
    );
  };

  const count = (code: string) => dispatches.filter((d) => d.siteCode === code && d.phase !== "withdrawn").length;

  return (
    <div className="rounded-xl bg-slate-800 border border-slate-700 p-3">
      <div className="text-xs text-slate-400 mb-2">선로 토폴로지 (구간을 클릭하면 단선구역 ✖ 표시)</div>
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        <div className="shrink-0 w-32 rounded-lg bg-indigo-900/60 border border-indigo-500 p-2 text-center">
          <div className="text-[10px] text-indigo-300">상위국</div>
          <EditableField
            value={incident.upperStation}
            emptyText="국사명"
            onSave={(v) => updateIncidentMeta(actor, { upperStation: v }, `상위국: ${v}`)}
          />
        </div>
        <Link after="UPPER" />
        {nodes.map((s) => (
          <div key={s.code} className="contents">
            <div className="shrink-0 rounded-lg bg-slate-700 border border-slate-500 px-2 py-1 text-center min-w-20">
              <div className="font-black text-amber-300">{s.code}</div>
              <div className="text-[11px] truncate max-w-28">{s.name || "명칭 미입력"}</div>
              <div className="text-[10px] text-slate-400">출동 {count(s.code)}명</div>
            </div>
            <Link after={s.code} />
          </div>
        ))}
        <div className="shrink-0 w-32 rounded-lg bg-indigo-900/60 border border-indigo-500 p-2 text-center">
          <div className="text-[10px] text-indigo-300">하위국</div>
          <EditableField
            value={incident.lowerStation}
            emptyText="국사명"
            onSave={(v) => updateIncidentMeta(actor, { lowerStation: v }, `하위국: ${v}`)}
          />
        </div>
      </div>
    </div>
  );
}
