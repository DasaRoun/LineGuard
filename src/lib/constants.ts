// ─────────────────────────────────────────────
// 현장 업무 용어 상수 (버튼/선택지 정의)
// ─────────────────────────────────────────────

/** 역할 목록 — 마지막 "직접입력"은 연필 입력창으로 처리 */
export const ROLES = [
  "접속팀",
  "버켓신호수",
  "통행신호수",
  "외선팀",
  "감시인",
  "현장지원",
  "현장지휘자",
  "상황실",
  "원격지원실",
] as const;

/** 신호수 역할 (보고서 안전점검 시트 분류용) */
export const SIGNAL_ROLES = ["버켓신호수", "통행신호수"];

/** 현장 상태 — 일반 */
export const STATUS_NORMAL = [
  "위험개소확인중",
  "단선지점확인중",
  "복구자재수급중",
  "DB확인중",
  "지원대기중",
] as const;

/** 현장 상태 — 경고(적색 표시) */
export const STATUS_DANGER = ["화재진입불가", "침수진입불가", "한전작업중", "작업중지권발행"] as const;

export const ALL_STATUSES = [...STATUS_NORMAL, ...STATUS_DANGER];

/** OTDR 판정 */
export const OTDR_SOURCE = ["광소스 정상", "광신호 미검출"] as const;
export const OTDR_SIGNAL = ["광신호 정상", "광신호 없음"] as const;

/** 단선작업/절체작업 공통 */
export const WORK_SIGNAL = ["광신호 정상", "광신호 없음"] as const;
export const WORK_STEPS = ["안전조치완료", "광케이블 포설", "피복탈피 시작", "광융착 진행", "복구완료"] as const;

/** 함체 확인 */
export const CLOSURE_SIDES = ["A", "B"] as const;
export const CLOSURE_RESULTS = ["코어 당겨짐", "광케이블 이탈", "함체 위치확인불가"] as const;

/** 상황실 지시 (출동자 우클릭 메뉴) */
export const ORDERS = [
  { key: "이동요청", color: "#3b82f6" },
  { key: "철수", color: "#ef4444" },
  { key: "대기요청", color: "#eab308" },
  { key: "인원추가출동중", color: "#22c55e" },
] as const;
export type OrderKey = (typeof ORDERS)[number]["key"];

/** 연동 입력창 */
export const SHARED_FIELDS = [
  { key: "coreId", label: "코어 ID", placeholder: "예) 144C 중 37~48번" },
  { key: "breakPoint", label: "단선지점", placeholder: "예) ○○동 123-4 앞 맨홀 #12" },
  { key: "breakCause", label: "단선원인", placeholder: "예) 굴착공사 중 절단" },
  { key: "cableRequest", label: "시공사 추가 케이블 요청", placeholder: "예) SM 144C 200m 1롤 요청" },
] as const;
export type SharedFieldKey = (typeof SHARED_FIELDS)[number]["key"];

/** 단선원인 자주 쓰는 항목 (선택 후 수정 가능) */
export const CAUSE_CHIPS = ["굴착공사", "차량충돌", "화재", "설치류", "강풍/낙하물", "노후", "도난"];

/** 도착소요시간 빠른 선택(분) */
export const ETA_QUICK = [5, 10, 15, 20, 30, 40, 60];

/** 기본 지점 코드 */
export const DEFAULT_SITE_CODES = ["A", "B", "C", "D"];

/** 다음 지점 코드: A..Z, 그 다음 AA, AB ... */
export function nextSiteCode(existing: string[]): string {
  const toNum = (c: string) => c.split("").reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0);
  const toCode = (n: number) => {
    let s = "";
    while (n > 0) {
      const r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  };
  const max = existing.reduce((m, c) => Math.max(m, toNum(c)), 0);
  return toCode(max + 1);
}
