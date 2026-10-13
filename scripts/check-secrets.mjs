// 키 유출 검사 — 저장소에 들어갈 파일에 API 키 형태의 문자열이 있으면 실패합니다.
// 사용: npm run check-secrets  (GitHub Actions 빌드 전에도 자동 실행)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const IGNORE_DIRS = new Set(["node_modules", ".next", "out", ".git", ".firebase"]);
const IGNORE_FILES = new Set([".env.local", ".env", "package-lock.json", "check-secrets.mjs"]);
const PATTERNS = [
  { name: "Google/Firebase API 키", re: new RegExp("AI" + "za[0-9A-Za-z_\\-]{35}") },
  { name: "서비스 계정 비공개 키", re: new RegExp("-----BEGIN " + "PRIVATE KEY-----") },
  { name: "Kakao 키로 보이는 값", re: /KAKAO[A-Z_]*KEY\s*=\s*[0-9a-f]{32}/i },
];

const hits = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (IGNORE_DIRS.has(name) || IGNORE_FILES.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (st.size < 2_000_000) {
      const text = readFileSync(p, "utf8");
      for (const { name: n, re } of PATTERNS) if (re.test(text)) hits.push(`${p}  →  ${n}`);
    }
  }
}
walk(process.cwd());

if (hits.length) {
  console.error("❌ 키로 보이는 값이 발견되었습니다. 커밋/배포를 중단하세요:\n" + hits.join("\n"));
  process.exit(1);
}
console.log("✅ 키 유출 검사 통과");
