// 무전 효과음(Web Audio 합성), 음성인식(STT), 음성낭독(TTS)

let ctx: AudioContext | null = null;
function ac() {
  if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, dur: number, vol = 0.15, type: OscillatorType = "sine") {
  const a = ac();
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, a.currentTime + start);
  g.gain.linearRampToValueAtTime(vol, a.currentTime + start + 0.005);
  g.gain.linearRampToValueAtTime(0, a.currentTime + start + dur);
  o.connect(g).connect(a.destination);
  o.start(a.currentTime + start);
  o.stop(a.currentTime + start + dur + 0.02);
}

/** 송신 시작음 (칩) */
export function playChirp() {
  tone(1200, 0, 0.06, 0.12, "square");
  tone(1800, 0.07, 0.06, 0.12, "square");
}

/** 송신 종료음 (로저 비프) */
export function playRoger() {
  tone(1600, 0, 0.08, 0.15);
  tone(1000, 0.09, 0.12, 0.15);
}

/** 경보음 (작업중지권 등) */
export function playAlarm() {
  for (let i = 0; i < 3; i++) {
    tone(880, i * 0.4, 0.18, 0.2, "sawtooth");
    tone(660, i * 0.4 + 0.2, 0.18, 0.2, "sawtooth");
  }
}

/** 지시 수신음 */
export function playNotice() {
  tone(988, 0, 0.12, 0.18);
  tone(1319, 0.14, 0.2, 0.18);
}

/** 브라우저 오디오 잠금 해제 (첫 터치 시 호출) */
export function unlockAudio() {
  try {
    ac();
  } catch {
    /* 무시 */
  }
}

// ── TTS ──
export function speak(text: string) {
  if (!("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ko-KR";
  u.rate = 1.05;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

// ── STT (Web Speech API: Chrome/Edge/안드로이드 크롬 지원) ──
type SR = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

export function sttSupported() {
  return typeof window !== "undefined" && Boolean((window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition);
}

/** 음성인식 시작 → stop() 호출 시 최종 텍스트 반환 */
export function startStt(): { stop: () => Promise<string> } | null {
  const W = window as unknown as Record<string, new () => SR>;
  const Ctor = W.SpeechRecognition || W.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = "ko-KR";
  rec.continuous = true;
  rec.interimResults = true;
  let finalText = "";
  let interim = "";
  let ended = false;
  let endResolve: (() => void) | null = null;
  rec.onresult = (e) => {
    interim = "";
    finalText = "";
    for (let i = 0; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
  };
  rec.onerror = () => {};
  rec.onend = () => {
    ended = true;
    endResolve?.();
  };
  try {
    rec.start();
  } catch {
    return null;
  }
  return {
    stop: () =>
      new Promise<string>((resolve) => {
        const done = () => resolve((finalText + " " + interim).trim());
        if (ended) return done();
        endResolve = done;
        try {
          rec.stop();
        } catch {
          done();
        }
        setTimeout(done, 1500); // 응답 없을 때 대비
      }),
  };
}
