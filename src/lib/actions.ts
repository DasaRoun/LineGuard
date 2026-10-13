"use client";
// ─────────────────────────────────────────────────────────────
// 현장/상황실 동작 모음 — 모든 동작은 (1) 현재 상태 갱신 + (2) 이력 메시지 기록
// 이력 메시지가 보고서(엑셀)의 원천 데이터가 됩니다.
// ─────────────────────────────────────────────────────────────
import { getBackend, type Dispatch, type NewMessage, type Site } from "@/backend";
import type { OrderKey, SharedFieldKey } from "./constants";
import { SHARED_FIELDS, nextSiteCode } from "./constants";
import { hhmm } from "./time";
import { compressImage, extOf, getCurrentPosition } from "./media";

export interface Actor {
  incidentId: string;
  name: string;
  dispatch?: Dispatch | null;
}

const be = () => getBackend();

function log(a: Actor, category: string, text: string, extra: Partial<NewMessage> = {}) {
  return be().sendMessage(
    a.incidentId,
    {
      type: "event",
      category,
      text,
      role: a.dispatch?.role ?? (extra.role as string | undefined) ?? null,
      siteCode: a.dispatch?.siteCode ?? null,
      dispatchId: a.dispatch?.id ?? null,
      ...extra,
    },
    a.name
  );
}

export const siteLabel = (s?: Site | null, code?: string | null) =>
  s ? `${s.code}지점${s.name ? `(${s.name})` : ""}` : code ? `${code}지점` : "";

// ── 지점 ──
export async function createSite(a: Actor, existing: Site[], name: string) {
  const code = nextSiteCode(existing.map((s) => s.code));
  const site: Site = {
    code,
    name: name.trim(),
    lat: null,
    lng: null,
    address: "",
    order: existing.length ? Math.max(...existing.map((s) => s.order)) + 1 : 0,
    createdAt: Date.now(),
  };
  await be().upsertSite(a.incidentId, site);
  await log(a, "지점", `${code}지점 생성: ${site.name || "(명칭 미입력)"}`, { siteCode: code });
}

export async function renameSite(a: Actor, site: Site, name: string) {
  await be().updateSite(a.incidentId, site.code, { name: name.trim() });
  await log(a, "지점", `${site.code}지점 명칭 입력: ${name.trim()}`, { siteCode: site.code });
}

export async function locateSite(a: Actor, site: Site, lat: number, lng: number, address: string) {
  await be().updateSite(a.incidentId, site.code, { lat, lng, address });
  await log(a, "지점", `${siteLabel(site)} 위치 지정: ${address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`}`, {
    siteCode: site.code,
    lat,
    lng,
  });
}

// ── 출동/도착 ──
export async function startDispatch(
  incidentId: string,
  uid: string,
  name: string,
  site: Site,
  etaMin: number | null,
  role: string
) {
  const now = Date.now();
  const d: Omit<Dispatch, "id"> = {
    uid,
    name,
    siteCode: site.code,
    role,
    departAt: now,
    etaMin,
    arriveAt: null,
    phase: "moving",
    withdrawnAt: null,
    statuses: [],
    breakConfirmedAt: null,
    otdr: { lengthM: "", source: null, signal: null, at: null },
    cutWork: { signal: null, steps: {} },
    switchWork: { signal: null, steps: {} },
    closure: {},
    orders: {},
    memo: "",
  };
  const id = await be().createDispatch(incidentId, d);
  const eta = etaMin != null ? ` · 도착소요 ${etaMin}분(예상 ${hhmm(now + etaMin * 60000)})` : "";
  await be().sendMessage(
    incidentId,
    {
      type: "event",
      category: "출동",
      text: `${siteLabel(site)} 출동 ${hhmm(now)}${eta}`,
      role,
      siteCode: site.code,
      dispatchId: id,
      data: { etaMin },
    },
    name
  );
  return id;
}

export async function setEta(a: Actor, etaMin: number) {
  const d = a.dispatch!;
  await be().updateDispatch(a.incidentId, d.id, { etaMin });
  await log(a, "출동", `도착소요 ${etaMin}분 (예상 ${hhmm(d.departAt + etaMin * 60000)})`, { data: { etaMin } });
}

export async function arrive(a: Actor) {
  const d = a.dispatch!;
  const now = Date.now();
  const pos = await getCurrentPosition(5000);
  await be().updateDispatch(a.incidentId, d.id, { arriveAt: now, phase: "arrived" });
  const mins = Math.floor((now - d.departAt) / 60000);
  await log(a, "도착", `현장 도착 ${hhmm(now)} (이동 ${mins}분)`, { lat: pos?.lat ?? null, lng: pos?.lng ?? null });
}

export async function withdraw(a: Actor) {
  const now = Date.now();
  await be().updateDispatch(a.incidentId, a.dispatch!.id, { phase: "withdrawn", withdrawnAt: now });
  await log(a, "철수", `현장 철수 ${hhmm(now)}`);
}

export async function setRole(a: Actor, role: string) {
  await be().updateDispatch(a.incidentId, a.dispatch!.id, { role });
  await log(a, "역할", `역할: ${role}`, { role });
}

export async function toggleStatus(a: Actor, status: string) {
  const d = a.dispatch!;
  const on = !d.statuses.includes(status);
  const statuses = on ? [...d.statuses, status] : d.statuses.filter((s) => s !== status);
  await be().updateDispatch(a.incidentId, d.id, { statuses });
  await log(a, "상태", `${status} ${on ? "설정" : "해제"}`, { data: { status, on } });
}

export async function setMemo(a: Actor, memo: string) {
  await be().updateDispatch(a.incidentId, a.dispatch!.id, { memo });
  await log(a, "메모", `메모: ${memo}`);
}

// ── 사진/동영상 ──
export async function uploadPhotoOrVideo(
  a: Actor,
  file: File,
  opts: { caption?: string; category?: string; isBreakPoint?: boolean; onProgress?: (p: number) => void } = {}
) {
  const isVideo = file.type.startsWith("video/");
  const [blob, pos] = await Promise.all([isVideo ? Promise.resolve(file as Blob) : compressImage(file), getCurrentPosition(8000)]);
  const { url, path } = await be().uploadMedia(
    a.incidentId,
    isVideo ? "videos" : "photos",
    blob,
    extOf(blob, isVideo ? "mp4" : "jpg"),
    opts.onProgress
  );
  await be().sendMessage(
    a.incidentId,
    {
      type: isVideo ? "video" : "photo",
      category: opts.category ?? (isVideo ? "동영상" : "사진"),
      text: opts.caption ?? "",
      role: a.dispatch?.role ?? null,
      siteCode: a.dispatch?.siteCode ?? null,
      dispatchId: a.dispatch?.id ?? null,
      mediaUrl: url,
      mediaPath: path,
      lat: pos?.lat ?? null,
      lng: pos?.lng ?? null,
      isBreakPoint: Boolean(opts.isBreakPoint),
    },
    a.name
  );
  return { url, pos };
}

/** 단선지점 확인완료 + 사진 → 지도에 사진 마커(단선지점) */
export async function confirmBreakWithPhoto(a: Actor, file: File, site: Site | undefined, onProgress?: (p: number) => void) {
  const r = await uploadPhotoOrVideo(a, file, {
    caption: `단선지점 확인완료 — ${siteLabel(site, a.dispatch?.siteCode)}`,
    category: "단선지점",
    isBreakPoint: true,
    onProgress,
  });
  await be().updateDispatch(a.incidentId, a.dispatch!.id, { breakConfirmedAt: Date.now() });
  return r;
}

/** 내 위치를 단선지점으로 등록 (사진 없이) */
export async function registerMyLocationAsBreak(a: Actor, site: Site | undefined) {
  const pos = await getCurrentPosition(10000);
  if (!pos) throw new Error("위치를 가져올 수 없습니다. GPS 권한을 허용해 주세요.");
  await log(a, "단선지점", `내 위치를 단선지점으로 등록 — ${siteLabel(site, a.dispatch?.siteCode)} (오차 ±${Math.round(pos.accuracy)}m)`, {
    lat: pos.lat,
    lng: pos.lng,
    isBreakPoint: true,
  });
  if (a.dispatch && !a.dispatch.breakConfirmedAt)
    await be().updateDispatch(a.incidentId, a.dispatch.id, { breakConfirmedAt: Date.now() });
}

// ── OTDR ──
export async function setOtdr(a: Actor, patch: Partial<Dispatch["otdr"]>, text: string) {
  const d = a.dispatch!;
  await be().updateDispatch(a.incidentId, d.id, { otdr: { ...d.otdr, ...patch, at: Date.now() } });
  await log(a, "OTDR", text, { data: patch as Record<string, unknown> });
}

// ── 단선작업 / 절체작업 ──
export async function setWorkSignal(a: Actor, kind: "cutWork" | "switchWork", signal: string) {
  const d = a.dispatch!;
  await be().updateDispatch(a.incidentId, d.id, { [`${kind}.signal`]: signal });
  await log(a, kind === "cutWork" ? "단선작업" : "절체작업", signal, { data: { signal } });
}

export async function toggleWorkStep(a: Actor, kind: "cutWork" | "switchWork", step: string) {
  const d = a.dispatch!;
  const done = d[kind].steps[step];
  const steps = { ...d[kind].steps };
  if (done) delete steps[step];
  else steps[step] = Date.now();
  await be().updateDispatch(a.incidentId, d.id, { [`${kind}.steps`]: steps });
  await log(a, kind === "cutWork" ? "단선작업" : "절체작업", `${step} ${done ? "취소" : hhmm(Date.now())}`, {
    data: { step, done: !done },
  });
}

// ── 함체 확인 ──
export async function toggleClosure(a: Actor, side: string, result: string) {
  const d = a.dispatch!;
  const cur = d.closure[side] ?? [];
  const on = !cur.includes(result);
  const next = on ? [...cur, result] : cur.filter((r) => r !== result);
  await be().updateDispatch(a.incidentId, d.id, { [`closure.${side}`]: next });
  await log(a, "함체", `함체확인 ${side}지점: ${result} ${on ? "확인" : "해제"}`, { data: { side, result, on } });
}

// ── 상황실 지시 (램프) ──
export async function setOrder(a: Actor, target: Dispatch, order: OrderKey, note?: string) {
  await be().updateDispatch(a.incidentId, target.id, {
    [`orders.${order}`]: { at: Date.now(), by: a.name, ack: false, ackAt: null, target: note ?? null },
  });
  await be().sendMessage(
    a.incidentId,
    {
      type: "event",
      category: "지시",
      text: `[상황실 지시] ${target.name}(${target.siteCode}지점) → ${order}${note ? ` : ${note}` : ""}`,
      siteCode: target.siteCode,
      dispatchId: target.id,
      data: { order, phase: "발령", note: note ?? null },
    },
    a.name
  );
}

export async function clearOrder(a: Actor, target: Dispatch, order: OrderKey) {
  const orders = { ...target.orders };
  delete orders[order];
  await be().updateDispatch(a.incidentId, target.id, { orders });
  await be().sendMessage(
    a.incidentId,
    {
      type: "event",
      category: "지시",
      text: `[상황실 지시 해제] ${target.name} → ${order}`,
      siteCode: target.siteCode,
      dispatchId: target.id,
      data: { order, phase: "해제" },
    },
    a.name
  );
}

export async function ackOrder(a: Actor, order: OrderKey) {
  const now = Date.now();
  await be().updateDispatch(a.incidentId, a.dispatch!.id, {
    [`orders.${order}.ack`]: true,
    [`orders.${order}.ackAt`]: now,
  });
  await log(a, "지시", `${order} 지시 확인 ${hhmm(now)}`, { data: { order, phase: "확인" } });
}

// ── 연동 입력창 ──
export async function updateSharedField(a: Actor, key: SharedFieldKey, value: string) {
  await be().updateIncident(a.incidentId, { [`fields.${key}`]: value });
  const label = SHARED_FIELDS.find((f) => f.key === key)?.label ?? key;
  await log(a, "연동", `${label}: ${value}`, { data: { key, value } });
}

export async function updateIncidentMeta(a: Actor, patch: Record<string, unknown>, text: string) {
  await be().updateIncident(a.incidentId, patch);
  await log(a, "장애정보", text);
}

// ── 채팅 ──
export async function sendChat(a: Actor, text: string) {
  await be().sendMessage(
    a.incidentId,
    {
      type: "chat",
      category: "채팅",
      text,
      role: a.dispatch?.role ?? null,
      siteCode: a.dispatch?.siteCode ?? null,
      dispatchId: a.dispatch?.id ?? null,
    },
    a.name
  );
}

export async function sendVoice(a: Actor, blob: Blob, sttText: string, durationSec: number) {
  const { url, path } = await be().uploadMedia(a.incidentId, "voices", blob, extOf(blob, "webm"));
  await be().sendMessage(
    a.incidentId,
    {
      type: "voice",
      category: "무전",
      text: sttText || "",
      sttText: sttText || null,
      role: a.dispatch?.role ?? null,
      siteCode: a.dispatch?.siteCode ?? null,
      dispatchId: a.dispatch?.id ?? null,
      mediaUrl: url,
      mediaPath: path,
      data: { durationSec },
    },
    a.name
  );
}
