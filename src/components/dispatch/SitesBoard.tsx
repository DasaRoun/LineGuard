"use client";
// 지점별 출동자 현황판 — 지점 명칭 직접입력, 지점 추가(E, F, G …)
import { useState } from "react";
import type { Dispatch, LivePosition, Site } from "@/backend";
import { createSite, renameSite, type Actor } from "@/lib/actions";
import { nextSiteCode } from "@/lib/constants";
import EditableField from "../common/EditableField";
import DispatchCard from "./DispatchCard";

export default function SitesBoard({
  actor,
  sites,
  dispatches,
  live,
  now,
  canOrder,
}: {
  actor: Actor;
  sites: Site[];
  dispatches: Dispatch[];
  live: LivePosition[];
  now: number;
  canOrder: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [showWithdrawn, setShowWithdrawn] = useState(false);
  const nextCode = nextSiteCode(sites.map((s) => s.code));

  const add = async () => {
    if (!newName.trim()) return alert("지점명(현장 장소명)을 입력하세요.");
    await createSite(actor, sites, newName);
    setNewName("");
    setAdding(false);
  };

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-xs text-slate-400">
        <input type="checkbox" checked={showWithdrawn} onChange={(e) => setShowWithdrawn(e.target.checked)} />
        철수 인원 표시
      </label>
      {sites.map((s) => {
        const list = dispatches.filter((d) => d.siteCode === s.code && (showWithdrawn || d.phase !== "withdrawn"));
        const active = dispatches.filter((d) => d.siteCode === s.code && d.phase !== "withdrawn");
        return (
          <div key={s.code} className="rounded-xl border border-slate-700 bg-slate-900/60 p-2">
            <div className="flex items-start gap-2 mb-2">
              <div className="rounded-lg bg-amber-500 px-2.5 py-1 text-lg font-black text-slate-900">{s.code}</div>
              <div className="flex-1 min-w-0">
                <EditableField value={s.name} emptyText="현장 장소명 미입력" placeholder="예) 역삼동 맨홀 #12" onSave={(v) => renameSite(actor, s, v)} />
                <div className="text-[11px] text-slate-400 truncate">
                  {s.address ? `📍 ${s.address}` : s.lat != null ? `📍 ${s.lat.toFixed(5)}, ${s.lng?.toFixed(5)}` : "위치 미지정 (지도에서 검색/클릭 후 지정)"}
                </div>
              </div>
              <div className="text-xs text-slate-300 whitespace-nowrap">
                출동 <b className="text-base">{active.length}</b>명
              </div>
            </div>
            <div className="space-y-2">
              {list.length === 0 && <div className="text-xs text-slate-500 px-1">출동 인원 없음</div>}
              {list.map((d) => (
                <DispatchCard
                  key={d.id}
                  d={d}
                  actor={actor}
                  site={s}
                  sites={sites}
                  live={live.find((l) => l.dispatchId === d.id)}
                  now={now}
                  canOrder={canOrder}
                />
              ))}
            </div>
          </div>
        );
      })}

      {!adding ? (
        <button onClick={() => setAdding(true)} className="w-full rounded-xl border-2 border-dashed border-slate-600 py-3 text-slate-300 hover:bg-slate-800">
          + {nextCode}지점 추가
        </button>
      ) : (
        <div className="rounded-xl border border-slate-600 bg-slate-800 p-3 space-y-2">
          <div className="text-sm font-bold">{nextCode}지점 생성 — 현장 장소명 입력</div>
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="예) 양재동 전주 #345"
            className="w-full rounded-lg bg-slate-900 border border-slate-600 p-2"
          />
          <div className="flex gap-2">
            <button onClick={add} className="flex-1 rounded-lg bg-blue-600 py-2 font-bold">
              생성
            </button>
            <button onClick={() => setAdding(false)} className="rounded-lg bg-slate-700 px-4">
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
