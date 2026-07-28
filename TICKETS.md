# Omni Platform Master Ticket Roadmap (TICKETS.md)

## 📌 1. 완료된 주요 이슈 & 티켓 (Completed Core & Phase 4)

- [x] **[TICK-100] 음성 채널 모드별 UI 분기 (GENERAL/MEETING/LECTURE)**
- [x] **[TICK-101] 모바일/태블릿 사이드바 UX 개선**
- [x] **[TICK-102] LiveKit DataChannel 실시간 발언권 연동 (Floor Control)**
- [x] **[TICK-103] VoiceGrid 및 SettingsModal i18n 번역 적용**
- [x] **[TICK-104] 마이크 프로필 getUserMedia constraints 반영**
- [x] **[TICK-105] Caddy Web Server 배포 통합**
- [x] **[TICK-106] 전체화면 버튼 Lucide 아이콘 교체**
- [x] **[TICK-67] Google OAuth 2.0 프록시 동적 Origin 감지**
- [x] **[TICK-15] 전역 SSE 파이프라인 (/api/events/stream)**

---

## 🚀 2. 신규 4대 핵심 기능 Vertical Slice 티켓 맵 (New Feature Tickets)

### 🎙️ Feature 1: 실시간 AI 자막 기능 (Realtime Live Captions)
- [ ] **[TICK-201] [STT-DATA] LiveKit DataChannel 자막 데이터 프로토콜 설계**
  - `CAPTION_CHUNK` 메세지 타입 및 디코더/인코더 작성 (`VoiceGrid.tsx`).
- [ ] **[TICK-202] [STT-UI] VoiceGrid 내 자막 오버레이 바 및 자막 ON/OFF 토글 구축**
  - Web Speech API 수신 텍스트 실시간 자막 UI 렌더링 및 화자 이름 표시.

### 📺 Feature 2: 웹캠 가상 배경 & 화면 공유 고화질 프리셋
- [ ] **[TICK-203] [CAM-BG] Canvas 기반 비디오 트랙 블러(Blur) 가상 배경 필터**
  - Canvas 2D processing 훅 작성 및 SettingsModal 카메라 프리뷰 적용.
- [ ] **[TICK-204] [SCREEN-PRESET] 화면 공유 해상도(720p/1080p) & 프레임레이트 선택UI**
  - SettingsModal 및 VoiceGrid 화면 공유 시 인코딩 preset 연동.

### 📝 Feature 3: 음성 채널 회의록 PDF/MD 내보내기 & 요약 히스토리 UI
- [ ] **[TICK-205] [SUMMARY-UI] 채널 헤더 내 회의록 요약 드로어 (SummaryDrawer) 퍼블리싱**
  - `/api/channels/[id]/summary` 데이터 바인딩 및 히스토리 카드 표시.
- [ ] **[TICK-206] [SUMMARY-EXPORT] 회의록 Markdown (.md) 및 PDF 다운로드 기능**
  - Blob 파일 생성기 작성 및 클라이언트 단 즉시 다운로드 버튼 구축.

### 🎨 Feature 4: 실시간 공유 문서 (DOCS) & 캔버스 (CANVAS) 채널
- [ ] **[TICK-207] [CHANNEL-TYPE] DB 스키마 & API 라우트 채널 타입 확장 (DOCS / CANVAS)**
  - Prisma 스키마 업데이트 (`ChannelDoc`, `ChannelCanvas`) 및 `/api/channels/[id]/doc`, `/api/channels/[id]/canvas` 생성.
- [ ] **[TICK-208] [DOCS-UI] 실시간 마크다운 동시 편집기 컴포넌트 (DocsView)**
  - 대시보드 내 DOCS 타입 채널 클릭 시 실시간 마크다운 에디터 & 프리뷰 렌더링.
- [ ] **[TICK-209] [CANVAS-UI] 실시간 화이트보드 캔버스 컴포넌트 (CanvasView)**
  - 대시보드 내 CANVAS 타입 채널 클릭 시 HTML5 Canvas 그리기 툴킷 & 실시간 stroke 동기화.
