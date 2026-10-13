"use client";
// 현장 [상태] 탭 — 출동/도착, 역할, 현장 상태, 메모, 철수
import type { Dispatch, Site } from "@/backend";
import { ROLES, STATUS_DANGER, STATUS_NORMAL } from "@/lib/constants";
import { arrive, setEta, setMemo, setRole, siteLabel, toggleStatus, withdraw, type Actor } from "@/lib/actions";
import { diffMin, distanceM, etaTime, fmtDistance, hhmm } from "@/lib/time";
import type { GpsState } from "@/lib/useDevice";
import EditableField from "../common/EditableField";
import { Section, Tile } from "./Tile";

export default function StatusTab({
  actor,
  d,
  site,
  now,
  gps,
  run,
}: {
  actor: Actor;
  d: Dispatch;
  site?: Site;
  now: number;
  gps: GpsState;
  run: (p: Promise<unknown>) => void;
}) {
  const eta = etaTime(d.departAt, d.etaMin);
  const late = d.phase === "moving" && eta != null && now > eta;
  const isCustomRole = d.role && !(ROLES as readonly string[]).includes(d.role);
  const dist = gps.lat != null && site?.lat != null ? distanceM({ lat: gps.lat, lng: gps.lng! }, { lat: site.lat, lng: site.lng! }) : null;

  return (
    <div className="space-y-3">
      <Section title={`🚗 ${siteLabel(site, d.siteCode)}`}>
        <div className="grid grid-cols-3 gap-2 text-center tabular-nums">
          <div className="rounded-xl bg-slate-800 p-2">
            <div className="text-xs text-slate-400">출동</div>
            <div className="text-2xl font-black">{hhmm(d.departAt)}</div>
          </div>
          <div className={`rounded-xl bg-slate-800 p-2 ${late ? "ring-2 ring-red-500" : ""}`}>
            <div className="text-xs text-slate-400">도착예상</div>
            <div className={`text-2xl font-black ${late ? "text-red-400" : ""}`}>{eta ? hhmm(eta) : "--:--"}</div>
          </div>
          <div className="rounded-xl bg-slate-800 p-2">
            <div className="text-xs text-slate-400">도착</div>
            <div className="text-2xl font-black text-emerald-400">{hhmm(d.arriveAt)}</div>
          </div>
        </div>
        <div className="mt-2 rounded-xl bg-slate-800 p-2">
          <EditableField
            label="도착소요시간"
            value={d.etaMin != null ? String(d.etaMin) : ""}
            suffix="분"
            inputMode="numeric"
            big
            onSave={async (v) => {
              const n = Number(v);
              if (!Number.isFinite(n) || n < 0) throw new Error("숫자(분)를 입력하세요");
              await setEta(actor, Math.round(n));
            }}
          />
        </div>
        <div className="mt-2 text-center text-sm text-slate-300">
          {d.phase === "moving" && (
            <>
              🚗 이동중 {diffMin(d.departAt, now)}분 경과{dist != null && ` · 지점까지 ${fmtDistance(dist)}`}
            </>
          )}
          {d.phase === "arrived" && <>✅ 현장 작업 {diffMin(d.arriveAt, now)}분 경과 (이동 {diffMin(d.departAt, d.arriveAt)}분)</>}
        </div>
        {d.phase === "moving" && (
          <button onClick={() => run(arrive(actor))} className="mt-3 w-full rounded-2xl bg-emerald-600 p-5 text-2xl font-black active:scale-95">
            📍 현장 도착 ({hhmm(now)})
          </button>
        )}
      </Section>

      <Section title="👷 역할">
        <div className="grid grid-cols-3 gap-2">
          {ROLES.map((r) => (
            <Tile key={r} on={d.role === r} onClick={() => run(setRole(actor, r))} className="text-sm">
              {r}
            </Tile>
          ))}
        </div>
        <div className="mt-2 rounded-xl bg-slate-800 p-2">
          <EditableField label="✏️ 직접입력 역할" value={isCustomRole ? d.role : ""} big emptyText="직접입력" onSave={(v) => (v ? setRole(actor, v) : undefined)} />
        </div>
      </Section>

      <Section title="📋 현장 상태">
        <div className="grid grid-cols-2 gap-2">
          {STATUS_NORMAL.map((s) => (
            <Tile key={s} on={d.statuses.includes(s)} tone="amber" onClick={() => run(toggleStatus(actor, s))}>
              {s}
            </Tile>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {STATUS_DANGER.map((s) => (
            <Tile
              key={s}
              on={d.statuses.includes(s)}
              tone="red"
              onClick={() => {
                if (s === "작업중지권발행" && !d.statuses.includes(s) && !confirm("작업중지권을 발행합니다. 상황실 전체에 경보가 울립니다.")) return;
                run(toggleStatus(actor, s));
              }}
              className={s === "작업중지권발행" ? "col-span-2" : ""}
            >
              ⚠ {s}
            </Tile>
          ))}
        </div>
      </Section>

      <Section title="📝 메모">
        <EditableField value={d.memo} big multiline emptyText="메모 없음" onSave={(v) => setMemo(actor, v)} />
      </Section>

      <button
        onClick={() => confirm("현장에서 철수합니다. 계속할까요?") && run(withdraw(actor))}
        className="w-full rounded-2xl border-2 border-slate-500 bg-slate-800 p-4 text-lg font-bold"
      >
        🏁 철수
      </button>
    </div>
  );
}
