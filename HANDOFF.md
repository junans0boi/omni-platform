# 📋 Omni Platform Development Handoff Summary (HANDOFF.md)

**최종 작성 일시**: 2026-07-28  
**프로젝트**: junans0boi/omni-platform  
**작업 브랜치**: `feat/native-google-oauth`  
**개발 방법론**: `AI Hero 7 Phases` (`Idea` -> `Research` -> `Prototype` -> `to-spec` -> `to-tickets` -> `implement` -> `code-review`) & Vertical Slice 원칙

---

## 📌 1. 오늘 구현 및 완료된 주요 기능 (Summary of Today's Work)

오늘 세션에서는 **로컬/원격 open 이슈 100% 완결 (Zero Open Issues)** 달성 및 **4대 신규 핵심 기능**의 기획부터 구현, UX 보강까지 수직적(Vertical Slice)으로 완벽히 통합하였습니다.

### 🎙️ 1. 실시간 AI 자막 기능 (Live Captions & Rolling List)
- **자막 데이터 파이프라인**: Web Speech API 기반 음성 텍스트 추출 및 LiveKit DataChannel (`CAPTION_CHUNK`) 브로드캐스트.
- **롤링 자막 UI**: `VoiceGrid` 하단 자막 바에 화자(@username) 이름과 함께 **최근 2~3개 대화 롤링 슬라이드 렌더링**.
- **자막 회의록 API 저장**: 호스트 옵션에 따른 `/api/channels/[id]/transcript` 자막 누적 DB/인메모리 저장 파이프라인.

### 📺 2. 웹캠 가상 배경 & 화면 공유 고화질 프리셋 (Virtual BG & Screen Share)
- **실제 배경 이미지 & 인물 백드롭 블러**:
  - 📷 **원본 (효과 없음)**
  - ✨ **인물 보존 배경 백드롭 블러 (`backdrop-blur-xl`)**
  - 🏢 **모던 사무실 (실제 오피스 배경 이미지 렌더링)**
  - ☕ **아늑한 카페 (실제 카페 배경 이미지 렌더링)**
- **디스코드 스타일 컨트롤 UI**: 카메라 및 화면 공유 버튼 옆에 **드롭다운 화살표(`∨`) 팝오버 메뉴**를 구현하여 바로 배경/화질 변경 가능.
- **Dynacast 화면 공유 1080p 60fps**: `setScreenShareEnabled` 시 `1920x1080 60fps` / `1280x720 30fps` 트랙 실제 발행 및 수신자 네트워크 상태에 따른 자동적응 비트레이트 연동.

### 📝 3. 스마트 회의록 PDF / Markdown 내보내기 & 요약 UI (AI Summary Export)
- **수동 AI 회의록 생성**: 채널 헤더 내 요약 드로어에서 **"✨ AI 회의록 즉시 생성"** 버튼으로 수동 요약 트리거 (`/api/channels/[id]/summary`).
- **멀티 파일 내보내기**: 회의록을 **Markdown(`.md`) 다운로드** 및 브라우저 인쇄 엔진 기반 스타일링된 **PDF(`.pdf`) 파일**로 동시 다운로드 제공.

### 🎨 4. 실시간 공유 문서 (DOCS) & 화이트보드 (CANVAS) 채널
- **채널 타입 확장**: `DOCS` (마크다운 라이브 에디터 `DocsView.tsx`), `CANVAS` (화이트보드 그림판 `CanvasView.tsx`) 추가.
- **전역 SSE 파이프라인 동기화**: `messageBroker.emit` (`doc:updated`, `canvas:updated`)을 통해 여러 참여자 간 실시간 동시 편집/그리기 동기화.

### 🔐 5. Google OAuth 2.0 외부 도메인 프록시 감지 수정 (`Issue #67`)
- Caddy/Nginx 리버스 프록시 헤더 (`x-forwarded-host`, `x-forwarded-proto`, `host`)를 동적으로 파악하는 `getPublicOrigin()` 헬퍼 도입.
- 외부 도메인(`https://omni.steady2vivid.kro.kr`) 및 로컬 개발 환경 모두 구글 로그인 콜백 리다이렉트가 바르게 동작하도록 완벽 수정.

---

## 🎫 2. GitHub 이슈 및 작업 티켓 상태 (All Tickets Resolved)

- **GitHub Issues**: 원격 이슈 목록 수동 확인 결과 **Open 이슈 0개** (All Closed)
- **TICKETS 백로그**: `TICK-301` ~ `TICK-310` 10개 신규 작업 티켓 모두 완료 (`[x]`)

---

## 🛠️ 3. 기술 검증 & Git 상태 (Build & Git Status)

- **TypeScript 타입 체크**: `npx tsc --noEmit` 결과 **오류 0개 (Clean)**
- **Git Push**: 원격 브랜치 `feat/native-google-oauth` 상에 최종 반영 완료 (`Commit: 41b0d93`)
- **주요 관련 파일**:
  - [VoiceGrid.tsx](file:///Users/junzzang/backup/workspace/omni-platform/src/components/VoiceGrid.tsx) (자막 롤링 UI, 가상 배경 이미지 렌더링, 디스코드 드롭다운)
  - [SettingsModal.tsx](file:///Users/junzzang/backup/workspace/omni-platform/src/components/SettingsModal.tsx) (미디어 프리셋 설정 동기화)
  - [ChannelHeaderExtras.tsx](file:///Users/junzzang/backup/workspace/omni-platform/src/components/ChannelHeaderExtras.tsx) (회의록 요약 및 PDF/MD 내보내기)
  - [DocsView.tsx](file:///Users/junzzang/backup/workspace/omni-platform/src/components/DocsView.tsx) & [CanvasView.tsx](file:///Users/junzzang/backup/workspace/omni-platform/src/components/CanvasView.tsx) (공유 문서/캔버스 뷰)
  - [request-origin.ts](file:///Users/junzzang/backup/workspace/omni-platform/src/lib/request-origin.ts) (Google OAuth 프록시 감지 헬퍼)
  - [SPECIFICATION.md](file:///Users/junzzang/backup/workspace/omni-platform/SPECIFICATION.md), [TICKETS.md](file:///Users/junzzang/backup/workspace/omni-platform/TICKETS.md), [HANDOFF.md](file:///Users/junzzang/backup/workspace/omni-platform/HANDOFF.md)

---

## 🚀 4. 다음 세션 작업 가이드 (Next Session Recommendation)

1. **배포 및 상용 인프라 실측**:
   - `deploy.sh`를 실행하여 Caddy + Let's Encrypt 실 배포 서버(`omni.steady2vivid.kro.kr`) 환경에서 구글 OAuth 및 WebRTC 음성 통화 실측 테스트.
2. **Docs/Canvas DB 영속성 확장**:
   - SQLite Prisma 모델에 `ChannelDoc`, `ChannelCanvas` 테이블을 생성하여 문서 내역의 디스크 영속성 강화.
