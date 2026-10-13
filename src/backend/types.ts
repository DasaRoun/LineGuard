// ─────────────────────────────────────────────────────────────
// 저장소(백엔드) 공통 약속 — 화면 코드는 이 인터페이스만 사용합니다.
// Firebase(1차) → 노트북 서버(2차)로 바꿀 때 이 파일은 그대로 두고
// src/backend/local/ 에 같은 함수들을 구현하면 됩니다.
// ─────────────────────────────────────────────────────────────
import type { OrderKey, SharedFieldKey } from "@/lib/constants";

export type Unsubscribe = () => void;

export interface Incident {
  id: string;
  title: string;
  code: string; // 6자리 접속코드
  ownerUid: string;
  createdAt: number;
  upperStation: string; // 상위국
  lowerStation: string; // 하위국
  breakAfter: string | null; // 토폴로지에서 단선구역이 위치한 구간 (해당 지점 코드 '다음' 구간, "UPPER"는 상위국 다음)
  fields: Partial<Record<SharedFieldKey, string>>;
  closedAt?: number | null;
}

export interface Site {
  code: string; // A, B, C ...
  name: string; // 현장 장소명 (직접입력)
  lat: number | null;
  lng: number | null;
  address?: string;
  order: number;
  createdAt: number;
}

export interface WorkProgress {
  signal: string | null; // 광신호 정상 / 광신호 없음
  steps: Record<string, number>; // 단계명 → 완료 시각(ms)
}

export interface OrderState {
  at: number;
  by: string;
  ack: boolean;
  ackAt?: number | null;
  target?: string | null; // 이동요청 목적지 등 메모
}

export interface Dispatch {
  id: string;
  uid: string;
  name: string;
  siteCode: string;
  role: string; // 역할 (직접입력 포함)
  departAt: number; // 출동 시각
  etaMin: number | null; // 도착소요시간(분)
  arriveAt: number | null; // 도착 시각
  phase: "moving" | "arrived" | "withdrawn";
  withdrawnAt?: number | null;
  statuses: string[];
  breakConfirmedAt?: number | null;
  otdr: { lengthM: string; source: string | null; signal: string | null; at?: number | null };
  cutWork: WorkProgress; // 단선작업
  switchWork: WorkProgress; // 절체작업
  closure: Record<string, string[]>; // 함체확인 A/B → 결과들
  orders: Partial<Record<OrderKey, OrderState>>;
  memo: string;
}

export type MessageType = "chat" | "voice" | "photo" | "video" | "event";

export interface Message {
  id: string;
  type: MessageType;
  category: string; // 출동, 도착, 역할, 상태, 단선지점, OTDR, 단선작업, 절체작업, 함체, 지시, 연동, 지점, 채팅, 무전, 사진 ...
  text: string;
  authorUid: string;
  authorName: string;
  role?: string | null;
  siteCode?: string | null;
  dispatchId?: string | null;
  mediaUrl?: string | null;
  mediaPath?: string | null;
  lat?: number | null;
  lng?: number | null;
  sttText?: string | null;
  isBreakPoint?: boolean; // 단선지점 마커 여부
  data?: Record<string, unknown> | null;
  clientAt: number;
}

export interface LivePosition {
  uid: string;
  name: string;
  siteCode: string | null;
  role: string | null;
  dispatchId: string | null;
  lat: number;
  lng: number;
  accuracy: number;
  updatedAt: number;
}

export type NewMessage = Omit<Message, "id" | "clientAt" | "authorUid" | "authorName"> & {
  authorName?: string;
};

export interface Backend {
  /** 익명 로그인 후 사용자 uid 반환 */
  ensureAuth(): Promise<string>;
  currentUid(): string | null;

  createIncident(input: { title: string; ownerName: string }): Promise<{ incidentId: string; code: string }>;
  joinIncident(code: string, name: string): Promise<string>;

  subscribeIncident(incidentId: string, cb: (v: Incident | null) => void, onError?: (e: Error) => void): Unsubscribe;
  updateIncident(incidentId: string, patch: Partial<Omit<Incident, "id">> | Record<string, unknown>): Promise<void>;

  subscribeSites(incidentId: string, cb: (v: Site[]) => void): Unsubscribe;
  upsertSite(incidentId: string, site: Site): Promise<void>;
  updateSite(incidentId: string, code: string, patch: Partial<Site>): Promise<void>;

  subscribeDispatches(incidentId: string, cb: (v: Dispatch[]) => void): Unsubscribe;
  createDispatch(incidentId: string, d: Omit<Dispatch, "id">): Promise<string>;
  /** 중첩 필드는 "orders.철수" 처럼 점 표기 경로 사용 가능 */
  updateDispatch(incidentId: string, dispatchId: string, patch: Record<string, unknown>): Promise<void>;

  subscribeMessages(incidentId: string, cb: (v: Message[]) => void): Unsubscribe;
  sendMessage(incidentId: string, msg: NewMessage, authorName: string): Promise<void>;

  uploadMedia(
    incidentId: string,
    kind: "photos" | "videos" | "voices",
    blob: Blob,
    ext: string,
    onProgress?: (pct: number) => void
  ): Promise<{ url: string; path: string }>;
  /** 보고서용: 저장된 파일을 Blob으로 받기 (실패 시 null) */
  fetchMedia(path: string): Promise<Blob | null>;

  subscribeLive(incidentId: string, cb: (v: LivePosition[]) => void): Unsubscribe;
  updateLive(incidentId: string, pos: Omit<LivePosition, "uid" | "updatedAt">): Promise<void>;
  removeLive(incidentId: string): Promise<void>;
}
