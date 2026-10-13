"use client";
// 출동자 카드 — 출동/도착시간, 역할, 상태, 작업진행, 상황실 지시 램프
// 상황실: 우클릭(터치는 길게 누르기) → 이동요청 / 철수 / 대기요청 / 인원추가출동중
import { useRef, useState } from "react";
import type { Dispatch, LivePosition, Site } from "@/backend";
import { ORDERS, STATUS_DANGER, WORK_STEPS, type OrderKey } from "@/lib/constants";
import { clearOrder, setOrder, type Actor } from "@/lib/actions";
import { diffMin, distanceM, etaTime, fmtDistance, hhmm } from "@/lib/time";
import { roleColor } from "../map/MapPanel";

export function OrderLamps({ d, size = "sm" }: { d: Dispatch; size?: "sm" | "lg" }) {
  return (
    <div className="flex gap-1">
      {ORDERS.map((o) => {
        const st = d.orders?.[o.key];
        return (
          <div
            key={o.key}
            title={st ? `${o.key} (${st.ack ? `확인 ${hhmm(st.ackAt)}` : "미확인"})` : o.key}
            className={`flex items-center gap-1 rounded-md border px-1.5 ${size === "lg" ? "py-1 text-sm" : "py-0.5 text-[10px]"} ${
              st ? "border-transparent text-white" : "border-slate-600 text-slate-500"
            } ${st && !st.ack ? "animate-[lamp_0.8s_steps(2)_infinite]" : ""}`}
            style={st ? { background: o.color, boxShadow: `0 0 10px ${o.color}` } : undefined}
          >
            <span className={`inline-block rounded-full ${size === "lg" ? "h-2.5 w-2.5" : "h-2 w-2"}`} style={{ background: st ? "#fff" : "#334155" }} />
            {o.key}
          </div>
        );
      })}
    </div>
  );
}

export default function DispatchCard({
  d,
  actor,
  site,
  sites,
  live,
  now,
  canOrder,
}: {
  d: Dispatch;
  actor: Actor;
  site?: Site;
  sites: Site[];
  live?: LivePosition;
  now: number;
  canOrder: boolean;
}) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const eta = etaTime(d.departAt, d.etaMin);
  const late = d.phase === "moving" && eta && now > eta;
  const danger = d.statuses.filter((s) => (STATUS_DANGER as readonly string[]).includes(s));
  const normal = d.statuses.filter((s) => !(STATUS_DANGER as readonly string[]).includes(s));
  const dist = live && site?.lat != null && site.lng != null ? distanceM(live, { lat: site.lat, lng: site.lng! }) : null;

  const openMenu = (x: number, y: number) => canOrder && setMenu({ x: Math.min(x, window.innerWidth - 220), y: Math.min(y, window.innerHeight - 260) });

  const doOrder = async (key: OrderKey) => {
    setMenu(null);
    if (d.orders?.[key]) return clearOrder(actor, d, key);
    let note: string | undefined;
    if (key === "이동요청") {
      const opts = sites.filter((s) => s.code !== d.siteCode).map((s) => `${s.code}${s.name ? `(${s.name})` : ""}`);
      note = prompt(`이동할 위치/지점을 입력하세요 (선택사항)\n지점: ${opts.join(", ")}`) ?? undefined;
    }
    await setOrder(actor, d, key, note || undefined);
  };

  const stepsDone = (w: Dispatch["cutWork"]) => WORK_STEPS.filter((s) => w.steps?.[s]).length;

  return (
    <>
      <div
        onContextMenu={(e) => {
          if (!canOrder) return;
          e.preventDefault();
          openMenu(e.clientX, e.clientY);
        }}
        onTouchStart={(e) => {
          const t = e.touches[0];
          pressTimer.current = setTimeout(() => openMenu(t.clientX, t.clientY), 600);
        }}
        onTouchEnd={() => pressTimer.current && clearTimeout(pressTimer.current)}
        onTouchMove={() => pressTimer.current && clearTimeout(pressTimer.current)}
        className={`rounded-xl border p-2 text-sm select-none ${
          d.phase === "withdrawn" ? "border-slate-700 bg-slate-800/40 opacity-60" : danger.length ? "border-red-500 bg-red-950/40" : "border-slate-600 bg-slate-800"
        } ${canOrder ? "cursor-context-menu" : ""}`}
        title={canOrder ? "우클릭: 지시 메뉴" : undefined}
      >
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full shrink-0" style={{ background: roleColor(d.role) }} />
          <b className="text-base">{d.name}</b>
          <span className="rounded bg-slate-700 px-1.5 text-xs">{d.role || "역할 미선택"}</span>
          <span className="ml-auto text-xs">
            {d.phase === "moving" && <span className={late ? "text-red-400 font-bold" : "text-amber-300"}>🚗 이동중 {diffMin(d.departAt, now)}분</span>}
            {d.phase === "arrived" && <span className="text-emerald-400">✅ 현장 {diffMin(d.arriveAt, now)}분</span>}
            {d.phase === "withdrawn" && <span className="text-slate-400">철수 {hhmm(d.withdrawnAt)}</span>}
          </span>
        </div>

        <div className="mt-1 grid grid-cols-3 gap-1 text-xs tabular-nums">
          <div className="rounded bg-slate-900/60 px-1.5 py-0.5">
            출동 <b>{hhmm(d.departAt)}</b>
          </div>
          <div className={`rounded bg-slate-900/60 px-1.5 py-0.5 ${late ? "text-red-400" : ""}`}>
            예상 <b>{eta ? hhmm(eta) : "--:--"}</b>
            {d.etaMin != null && <span className="text-slate-400"> ({d.etaMin}분)</span>}
          </div>
          <div className="rounded bg-slate-900/60 px-1.5 py-0.5">
            도착 <b>{hhmm(d.arriveAt)}</b>
          </div>
        </div>
        {d.phase === "moving" && dist != null && <div className="mt-1 text-xs text-slate-400">지점까지 {fmtDistance(dist)}</div>}

        {(danger.length > 0 || normal.length > 0) && (
          <div className="mt-1 flex flex-wrap gap-1">
            {danger.map((s) => (
              <span key={s} className="rounded bg-red-600 px-1.5 text-xs font-bold animate-pulse">
                ⚠ {s}
              </span>
            ))}
            {normal.map((s) => (
              <span key={s} className="rounded bg-slate-600 px-1.5 text-xs">
                {s}
              </span>
            ))}
          </div>
        )}

        <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-slate-300">
          {d.breakConfirmedAt && <span className="rounded bg-red-900/70 px-1.5">📍단선확인 {hhmm(d.breakConfirmedAt)}</span>}
          {(d.otdr?.lengthM || d.otdr?.signal || d.otdr?.source) && (
            <span className="rounded bg-slate-700 px-1.5">
              OTDR {d.otdr.lengthM ? `${d.otdr.lengthM}m` : ""} {d.otdr.source ?? ""} {d.otdr.signal ?? ""}
            </span>
          )}
          {(d.cutWork?.signal || stepsDone(d.cutWork) > 0) && (
            <span className="rounded bg-slate-700 px-1.5">
              단선작업 {stepsDone(d.cutWork)}/5 {d.cutWork.signal ?? ""}
            </span>
          )}
          {(d.switchWork?.signal || stepsDone(d.switchWork) > 0) && (
            <span className="rounded bg-slate-700 px-1.5">
              절체작업 {stepsDone(d.switchWork)}/5 {d.switchWork.signal ?? ""}
            </span>
          )}
          {Object.entries(d.closure ?? {}).map(([side, rs]) =>
            rs.length ? (
              <span key={side} className="rounded bg-orange-900/70 px-1.5">
                함체{side}: {rs.join(", ")}
              </span>
            ) : null
          )}
        </div>
        {d.memo && <div className="mt-1 text-xs text-slate-300">📝 {d.memo}</div>}

        <div className="mt-1.5">
          <OrderLamps d={d} />
        </div>
      </div>

      {menu && (
        <div className="fixed inset-0 z-[900]" onClick={() => setMenu(null)} onContextMenu={(e) => { e.preventDefault(); setMenu(null); }}>
          <div className="absolute w-52 rounded-xl border border-slate-600 bg-slate-900 p-1 shadow-2xl" style={{ left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()}>
            <div className="px-3 py-1.5 text-xs text-slate-400">
              {d.name} ({d.siteCode}지점) 지시
            </div>
            {ORDERS.map((o) => {
              const on = !!d.orders?.[o.key];
              return (
                <button key={o.key} onClick={() => doOrder(o.key)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-700">
                  <span className="h-3 w-3 rounded-full" style={{ background: o.color }} />
                  <span className="flex-1">{o.key}</span>
                  {on && <span className="text-xs text-slate-400">해제</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
