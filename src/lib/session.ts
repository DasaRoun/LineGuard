// 브라우저에 접속 정보(장애건 ID, 이름, 현재 출동 ID)를 기억합니다. 서버에는 저장하지 않습니다.

export interface Session {
  incidentId: string;
  code: string;
  name: string;
  mode: "hq" | "field";
  dispatchId?: string | null;
}

const KEY = "lineguard.session";

export function loadSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(s: Session) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function patchSession(p: Partial<Session>) {
  const cur = loadSession();
  if (cur) saveSession({ ...cur, ...p });
}

export function clearSession() {
  localStorage.removeItem(KEY);
}

/** basePath 를 고려한 내부 링크 */
export function withBase(path: string) {
  return `${process.env.NEXT_PUBLIC_BASE_PATH || ""}${path}`;
}
