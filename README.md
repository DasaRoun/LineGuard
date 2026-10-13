# LineGuard — 통신 선로 단선장애 긴급복구 협업 관제

현장 작업자(모바일)와 상황실(PC)이 **출동·도착, 역할·상태, 작업 단계, PTT 무전, 사진 채증, 지도 관제, 엑셀 보고서**를 실시간으로 공유하는 웹앱입니다.

- 상황실: `/hq/?i=장애건ID` — 지점·출동자 현황, 지도, 선로 모식도, 사진 갤러리, 채팅·무전, 연동 입력창, 📊 복구보고서(엑셀)
- 현장: `/field/?i=장애건ID` — 출동 → 도착, 역할/상태, 단선지점·OTDR·단선/절체작업·함체확인, 하단 PTT·사진
- 참여: 시작 화면에서 **접속코드 6자리 + 이름**

> ⚠️ **가상(샘플) 데이터는 없습니다.** 모든 값은 실제 입력·실제 GPS·실제 카메라에서만 생성됩니다.

---

## 1. 최초 설정 (1회)

### 1-1. Firebase 콘솔
1. 프로젝트 생성 → **웹 앱 추가** → 표시되는 설정값(apiKey 등)을 메모
2. **Authentication** → 로그인 방법 → **익명(Anonymous) 사용 설정**
3. Authentication → 설정 → **승인된 도메인**에 `dasaroun.github.io` 추가 (`localhost`는 기본 포함)
4. **Firestore Database** 생성 (위치: `asia-northeast3` 서울 권장) → 규칙 탭에 [`firestore.rules`](firestore.rules) 내용 붙여넣고 게시
5. **Storage** 시작 (Blaze 요금제 필요) → 규칙 탭에 [`storage.rules`](storage.rules) 붙여넣고 게시
6. (보고서 사진 삽입용) Google Cloud 콘솔 → Cloud Shell 에서:
   ```bash
   # cors.json 내용을 Cloud Shell 에 만든 뒤
   gsutil cors set cors.json gs://<버킷이름>
   ```
7. (권장) Google Cloud 콘솔 → API 및 서비스 → 사용자 인증 정보 → Browser key → **HTTP 리퍼러 제한**:
   `https://dasaroun.github.io/*`, `http://localhost:3000/*`
8. (권장) 결제 → 예산 및 알림 설정

### 1-2. Kakao Developers
1. 애플리케이션 추가 → **앱 키 > JavaScript 키** 복사
2. 앱 설정 → 플랫폼 → **Web 사이트 도메인**에 `https://dasaroun.github.io`, `http://localhost:3000` 등록
3. 제품 설정 → **카카오맵** 사용 설정(활성화)

### 1-3. 키 입력 (로컬)
```powershell
copy .env.example .env.local
notepad .env.local   # 값 입력 후 저장
```
`.env.local` 은 `.gitignore` 에 등록되어 **GitHub 에 올라가지 않습니다.**

### 1-4. 키 입력 (GitHub 자동 배포)
GitHub 저장소 → **Settings → Secrets and variables → Actions → New repository secret** 에 `.env.example` 의 이름 그대로 등록:
`NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`,
`NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`, `NEXT_PUBLIC_KAKAO_JS_KEY`

그리고 **Settings → Pages → Source: GitHub Actions** 선택.
이후 `main` 브랜치에 push 하면 `https://dasaroun.github.io/LineGuard/` 로 자동 배포됩니다.

---

## 2. 실행

```powershell
npm.cmd install
npm.cmd run dev        # http://localhost:3000
npm.cmd run build      # 정적 파일 → out/
npm.cmd run check-secrets   # 키 유출 검사
```
> PowerShell 실행 정책 때문에 `npm` 대신 `npm.cmd` 를 사용합니다.
> 휴대폰에서 GPS·카메라·마이크는 **HTTPS** 에서만 동작합니다 → 현장 테스트는 GitHub Pages 주소로 하세요.

---

## 3. 사용 흐름

1. 상황실: 시작 화면 → **새 장애 등록** → 접속코드 발급, A~D 지점 자동 생성
2. 상황실: 지점 명칭 ✏️ 입력, 지도에서 지번 검색/클릭 → **지점 위치 지정**, 접속코드 📋 복사해 현장 전달
3. 현장: 접속코드 + 이름 → **출동할 지점의 [출동]** → 역할·도착소요시간(분) 선택 → 출동
4. 현장: GPS 허용 → 상황실 지도에 실시간 위치/이동경로 표시 · 도착 시 **[현장 도착]**
5. 현장: 작업 탭에서 단선지점 사진(지도에 사진 마커), OTDR, 단선/절체 5단계, 함체확인
6. 상황실: 출동자 카드 **우클릭** → 이동요청/철수/대기요청/인원추가출동중 → 카드 램프 점멸 → 현장 [확인] 시 점등
7. 상황실: **📊 복구보고서** → 엑셀(7개 시트, 사진 포함) 다운로드

---

## 4. 폴더 구조

```
src/
├─ app/                 page.tsx(시작) · hq/(상황실) · field/(현장)
├─ backend/             ★ 저장소 교체 지점
│  ├─ types.ts          공통 인터페이스
│  ├─ index.ts          NEXT_PUBLIC_BACKEND 로 구현체 선택
│  └─ firebase/         1차 구현 (Firestore/Storage/익명인증)
├─ components/          map · dispatch · comms · field · shared · common
└─ lib/                 actions(동작+이력기록) · report(엑셀) · audio(PTT음/STT/TTS) · kakao · ...
docs/노트북서버_전환가이드.md   2차(노트북 서버) 전환 시 수정 목록
```

## 5. 보안 요약
- 키는 `.env.local`(로컬) / GitHub Secrets(배포)에만 존재, 저장소에는 빈 `.env.example`만
- 빌드 전 `check-secrets` 자동 검사
- Firestore/Storage 규칙: 접속코드로 참여한 사람만 해당 장애건 접근, 이력(메시지)·사진은 수정/삭제 불가
- Kakao 키는 등록 도메인에서만, Firebase 키는 HTTP 리퍼러 제한으로 타 사이트 사용 차단
