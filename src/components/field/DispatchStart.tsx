"use client";
// 출동 시작 화면 — 지점 선택 → 역할·도착소요시간 → [출동]
import { useState } from "react";
import type { Dispatch, Site } from "@/backend";
import { ETA_QUICK, ROLES } from "@/lib/constants";
import { createSite, siteLabel, startDispatch } from "@/lib/actions";
import { hhmm } from "@/lib/time";
import Modal from "../common/Modal";
import { Tile } from "./Tile";

export default function DispatchStart({
  incidentId,
  uid,
  name,
  sites,
  dispatches,
  onStarted,
}: {
  incidentId: string;
  uid: string;
  name: string;
  sites: Site[];
  dispatches: Dispatch[];
  onStarted: (dispatchId: string) => void;
}) {
  const [site, setSite] = useState<Site | null>(null);
  const [role, setRole] = useState<string>("");
  const [customRole, setCustomRole] = useState("");
  const [eta, setEta] = useState<number | null>(null);
  const [etaCustom, setEtaCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const mine = dispatches.filter((d) => d.uid === uid);

  const go = async () => {
    if (!site) return;
    const r = role === "직접입력" ? customRole.trim() : role;
    const etaMin = etaCustom ? Number(etaCustom) : eta;
    if (etaCustom && (!Number.isFinite(etaMin) || (etaMin as number) < 0)) return alert("도착소요시간(분)을 숫자로 입력하세요.");
    setBusy(true);
    try {
      const id = await startDispatch(incidentId, uid, name, site, etaMin ?? null, r);
      onStarted(id);
    } catch (e) {
      alert(`출동 등록 실패: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 p-3">
      <h2 className="text-xl font-black">🚨 출동할 지점을 선택하세요</h2>
      {sites.map((s) => {
        const n = dispatches.filter((d) => d.siteCode === s.code && d.phase !== "withdrawn").length;
        return (
          <button
            key={s.code}
            onClick={() => setSite(s)}
            className="flex w-full items-center gap-3 rounded-2xl border-2 border-slate-600 bg-slate-800 p-4 text-left active:scale-[0.98]"
          >
            <span className="rounded-xl bg-amber-500 px-4 py-2 text-3xl font-black text-slate-900">{s.code}</span>
            <span className="flex-1">
              <span className="block text-lg font-bold">{s.name || "현장 장소명 미입력"}</span>
              <span className="text-sm text-slate-400">{s.address || "위치 미지정"} · 출동 {n}명</span>
            </span>
            <span className="rounded-xl bg-red-600 px-5 py-4 text-xl font-black">출동</span>
          </button>
        );
      })}

      {!adding ? (
        <button onClick={() => setAdding(true)} className="w-full rounded-2xl border-2 border-dashed border-slate-600 p-4 text-lg text-slate-300">
          + 새 지점 추가
        </button>
      ) : (
        <div className="space-y-2 rounded-2xl border border-slate-600 bg-slate-800 p-3">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="현장 장소명 입력"
            className="w-full rounded-xl border border-slate-600 bg-slate-900 p-4 text-lg"
          />
          <div className="flex gap-2">
            <button
              onClick={async () => {
                if (!newName.trim()) return alert("현장 장소명을 입력하세요.");
                await createSite({ incidentId, name }, sites, newName);
                setNewName("");
                setAdding(false);
              }}
              className="flex-1 rounded-xl bg-blue-600 p-3 text-lg font-bold"
            >
              생성
            </button>
            <button onClick={() => setAdding(false)} className="rounded-xl bg-slate-700 px-5">
              취소
            </button>
          </div>
        </div>
      )}

      {mine.length > 0 && (
        <div className="rounded-2xl border border-slate-700 p-3 text-sm text-slate-400">
          <div className="mb-1 font-bold text-slate-300">내 출동 이력</div>
          {mine.map((d) => (
            <div key={d.id}>
              {d.siteCode}지점 · {d.role} · 출동 {hhmm(d.departAt)} · 도착 {hhmm(d.arriveAt)} · {d.phase === "withdrawn" ? `철수 ${hhmm(d.withdrawnAt)}` : "진행중"}
            </div>
          ))}
        </div>
      )}

      <Modal open={!!site} onClose={() => setSite(null)} title={`${siteLabel(site)} 출동`}>
        <div className="space-y-4">
          <div>
            <div className="mb-2 font-bold">역할 선택</div>
            <div className="grid grid-cols-3 gap-2">
              {[...ROLES, "직접입력"].map((r) => (
                <Tile key={r} on={role === r} onClick={() => setRole(r)} className="text-sm">
                  {r === "직접입력" ? "✏️ 직접입력" : r}
                </Tile>
              ))}
            </div>
            {role === "직접입력" && (
              <input
                autoFocus
                value={customRole}
                onChange={(e) => setCustomRole(e.target.value)}
                placeholder="역할 입력"
                className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-900 p-3 text-lg"
              />
            )}
          </div>
          <div>
            <div className="mb-2 font-bold">도착소요시간 (분)</div>
            <div className="grid grid-cols-4 gap-2">
              {ETA_QUICK.map((m) => (
                <Tile
                  key={m}
                  on={eta === m && !etaCustom}
                  onClick={() => {
                    setEta(m);
                    setEtaCustom("");
                  }}
                >
                  {m}분
                </Tile>
              ))}
              <input
                value={etaCustom}
                onChange={(e) => setEtaCustom(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                placeholder="✏️ 분"
                className="min-h-16 rounded-xl border-2 border-slate-600 bg-slate-900 text-center text-lg font-bold"
              />
            </div>
            {(eta != null || etaCustom) && (
              <div className="mt-2 text-sm text-slate-300">
                도착 예상: <b>{hhmm(Date.now() + (etaCustom ? Number(etaCustom) : eta!) * 60000)}</b>
              </div>
            )}
          </div>
          <button disabled={busy} onClick={go} className="w-full rounded-2xl bg-red-600 p-5 text-2xl font-black disabled:opacity-50">
            {busy ? "등록 중…" : `🚗 출동 (${hhmm(Date.now())})`}
          </button>
          <p className="text-center text-xs text-slate-400">역할·도착소요시간은 출동 후에도 수정할 수 있습니다.</p>
        </div>
      </Modal>
    </div>
  );
}
