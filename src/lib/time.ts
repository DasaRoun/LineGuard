// 시간 표시 도우미 — 현장 기록은 "시:분" 까지만 표시합니다.

export function hhmm(ms: number | null | undefined): string {
  if (!ms) return "--:--";
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function ymdhm(ms: number | null | undefined): string {
  if (!ms) return "";
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(
    2,
    "0"
  )} ${hhmm(ms)}`;
}

/** 두 시각 사이의 분 (소수점 버림) */
export function diffMin(from: number | null | undefined, to: number | null | undefined): number | null {
  if (!from || !to) return null;
  return Math.max(0, Math.floor((to - from) / 60000));
}

export function etaTime(departAt: number, etaMin: number | null): number | null {
  return etaMin == null ? null : departAt + etaMin * 60000;
}

/** 두 좌표 사이 거리(m) */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function fmtDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`;
}
