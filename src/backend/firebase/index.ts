// ─────────────────────────────────────────────────────────────
// 1차 저장소: Firebase (Firestore + Storage + 익명 인증)
// 키는 환경변수(.env.local / GitHub Secrets)로만 주입됩니다.
// ─────────────────────────────────────────────────────────────
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged, type Auth } from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  getBlob,
  type FirebaseStorage,
} from "firebase/storage";
import type { Backend, Dispatch, Incident, LivePosition, Message, Site } from "../types";
import { DEFAULT_SITE_CODES } from "@/lib/constants";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function isFirebaseConfigured() {
  return Boolean(config.apiKey && config.projectId && config.appId);
}

let app: FirebaseApp, auth: Auth, db: Firestore, storage: FirebaseStorage;

function init() {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase 설정값이 없습니다. .env.local 파일을 확인하세요.");
  }
  if (!app) {
    app = getApps()[0] ?? initializeApp(config);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
  }
}

function genCode() {
  // 6자리 숫자 접속코드 (첫 자리 0 제외 → 무전으로 불러주기 쉬움)
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(100000 + (arr[0] % 900000));
}

const iPath = (id: string) => `incidents/${id}`;
let authPromise: Promise<string> | null = null;

export const firebaseBackend: Backend = {
  async ensureAuth() {
    init();
    if (auth.currentUser) return auth.currentUser.uid;
    // 여러 화면 요소가 동시에 호출해도 익명 계정이 하나만 생성되도록 Promise 공유
    if (!authPromise) {
      authPromise = (async () => {
        // 브라우저에 남아있는 로그인 상태 복원을 기다린 뒤 확인
        const restored = await new Promise<string | null>((resolve) => {
          const off = onAuthStateChanged(auth, (u) => {
            off();
            resolve(u?.uid ?? null);
          });
        });
        if (restored) return restored;
        const cred = await signInAnonymously(auth);
        return cred.user.uid;
      })().catch((e) => {
        authPromise = null;
        throw e;
      });
    }
    return authPromise;
  },

  currentUid() {
    try {
      init();
      return auth.currentUser?.uid ?? null;
    } catch {
      return null;
    }
  },

  async createIncident({ title, ownerName }) {
    const uid = await this.ensureAuth();
    // 사용 중이 아닌 접속코드 찾기
    let code = genCode();
    for (let i = 0; i < 10; i++) {
      const snap = await getDoc(doc(db, "joinCodes", code));
      if (!snap.exists()) break;
      code = genCode();
    }
    const now = Date.now();
    const incRef = await addDoc(collection(db, "incidents"), {
      title,
      code,
      ownerUid: uid,
      createdAt: now,
      upperStation: "",
      lowerStation: "",
      breakAfter: null,
      fields: {},
      closedAt: null,
    });
    // 순서 중요: 소유자 멤버 등록 → 접속코드 등록 (보안 규칙이 이 순서를 검사)
    await setDoc(doc(db, iPath(incRef.id), "members", uid), { name: ownerName, code, joinedAt: now, hq: true });
    await setDoc(doc(db, "joinCodes", code), { incidentId: incRef.id, createdAt: now });
    // 기본 지점 A~D 생성 (장소명은 비워두고 현장/상황실에서 직접 입력)
    await Promise.all(
      DEFAULT_SITE_CODES.map((c, idx) =>
        setDoc(doc(db, iPath(incRef.id), "sites", c), {
          code: c,
          name: "",
          lat: null,
          lng: null,
          address: "",
          order: idx,
          createdAt: now,
        } satisfies Site)
      )
    );
    await addDoc(collection(db, iPath(incRef.id), "messages"), {
      type: "event",
      category: "장애등록",
      text: `장애건 등록: ${title} (접속코드 ${code})`,
      authorUid: uid,
      authorName: ownerName,
      clientAt: now,
      createdAt: serverTimestamp(),
    });
    return { incidentId: incRef.id, code };
  },

  async joinIncident(code, name) {
    const uid = await this.ensureAuth();
    const snap = await getDoc(doc(db, "joinCodes", code.trim()));
    if (!snap.exists()) throw new Error("접속코드를 찾을 수 없습니다.");
    const incidentId = snap.data().incidentId as string;
    await setDoc(
      doc(db, iPath(incidentId), "members", uid),
      { name, code: code.trim(), joinedAt: Date.now() },
      { merge: true }
    );
    return incidentId;
  },

  subscribeIncident(incidentId, cb, onError) {
    init();
    return onSnapshot(
      doc(db, iPath(incidentId)),
      (s) => cb(s.exists() ? ({ id: s.id, ...s.data() } as Incident) : null),
      (e) => onError?.(e)
    );
  },

  async updateIncident(incidentId, patch) {
    init();
    await updateDoc(doc(db, iPath(incidentId)), patch as Record<string, unknown>);
  },

  subscribeSites(incidentId, cb) {
    init();
    return onSnapshot(query(collection(db, iPath(incidentId), "sites"), orderBy("order")), (s) =>
      cb(s.docs.map((d) => d.data() as Site))
    );
  },

  async upsertSite(incidentId, site) {
    init();
    await setDoc(doc(db, iPath(incidentId), "sites", site.code), site);
  },

  async updateSite(incidentId, code, patch) {
    init();
    await updateDoc(doc(db, iPath(incidentId), "sites", code), patch as Record<string, unknown>);
  },

  subscribeDispatches(incidentId, cb) {
    init();
    return onSnapshot(query(collection(db, iPath(incidentId), "dispatches"), orderBy("departAt")), (s) =>
      cb(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Dispatch))
    );
  },

  async createDispatch(incidentId, d) {
    init();
    const r = await addDoc(collection(db, iPath(incidentId), "dispatches"), d);
    return r.id;
  },

  async updateDispatch(incidentId, dispatchId, patch) {
    init();
    await updateDoc(doc(db, iPath(incidentId), "dispatches", dispatchId), patch);
  },

  subscribeMessages(incidentId, cb) {
    init();
    return onSnapshot(query(collection(db, iPath(incidentId), "messages"), orderBy("clientAt")), (s) =>
      cb(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Message))
    );
  },

  async sendMessage(incidentId, msg, authorName) {
    const uid = await this.ensureAuth();
    // undefined 값은 Firestore가 거부하므로 제거
    const clean = Object.fromEntries(Object.entries(msg).filter(([, v]) => v !== undefined));
    await addDoc(collection(db, iPath(incidentId), "messages"), {
      ...clean,
      authorUid: uid,
      authorName,
      clientAt: Date.now(),
      createdAt: serverTimestamp(),
    });
  },

  async uploadMedia(incidentId, kind, blob, ext, onProgress) {
    await this.ensureAuth();
    const name = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const path = `${iPath(incidentId)}/${kind}/${name}`;
    const r = ref(storage, path);
    const task = uploadBytesResumable(r, blob, { contentType: blob.type || undefined });
    await new Promise<void>((resolve, reject) => {
      task.on(
        "state_changed",
        (s) => onProgress?.(Math.round((s.bytesTransferred / s.totalBytes) * 100)),
        reject,
        () => resolve()
      );
    });
    const url = await getDownloadURL(r);
    return { url, path };
  },

  async fetchMedia(path) {
    try {
      init();
      return await getBlob(ref(storage, path));
    } catch {
      return null; // 저장소 CORS 미설정 등 → 보고서에는 링크로 대체
    }
  },

  subscribeLive(incidentId, cb) {
    init();
    return onSnapshot(collection(db, iPath(incidentId), "live"), (s) =>
      cb(s.docs.map((d) => ({ uid: d.id, ...d.data() }) as LivePosition))
    );
  },

  async updateLive(incidentId, pos) {
    const uid = await this.ensureAuth();
    // 최신 위치로 '덮어쓰기'만 합니다 — 이동 경로 이력은 저장하지 않음
    await setDoc(doc(db, iPath(incidentId), "live", uid), { ...pos, updatedAt: Date.now() });
  },

  async removeLive(incidentId) {
    const uid = await this.ensureAuth();
    await deleteDoc(doc(db, iPath(incidentId), "live", uid));
  },
};
