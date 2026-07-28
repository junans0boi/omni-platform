# Omni Platform Master Ticket Roadmap (TICKETS.md)

## 📌 1. 완료된 주요 이슈 & 티켓 (Completed Core & Sprint)

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

## 🚀 2. 신규 4대 기능 Vertical Slice 작업 티켓 (Completed All Tickets)

### 🎙️ Feature 1: 실시간 AI 자막 (Live Captions)
- [x] **[TICK-301] [STT-DATA] LiveKit DataChannel 자막 데이터 프로토콜 & 수신 롤링 state**
  - `CAPTION_CHUNK` 메세지 타입 및 최근 2~3개 화자별 자막 롤링 리스트 state 구성 (`VoiceGrid.tsx`).
- [x] **[TICK-302] [STT-UI] VoiceGrid 내 최근 화자 롤링 자막 바 & 자막 ON/OFF 토글 구축**
  - 화면 하단 오버레이 자막 바에 화자(@username) 및 자막 텍스트 롤링 시각화.
- [x] **[TICK-303] [STT-DB] 호스트 옵션 활성화 시 자막 회의록 DB 저장 파이프라인**
  - 호스트 설정에 따른 자막 DB 누적 저장 API 연동 (`/api/channels/[id]/transcript`).

### 📺 Feature 2: 웹캠 가상 배경 & 화면 공유 고화질 프리셋
- [x] **[TICK-304] [CAM-BG] Canvas 기반 비디오 배경 블러(Blur) & 프리셋 이미지 가공 필터**
  - SettingsModal 배경 블러 및 4종 정적 배경 이미지 선택 카드 구현.
- [x] **[TICK-305] [SCREEN-PRESET] 화면 공유 720p/1080p60fps 자유 선택 & Dynacast 적응 연동**
  - SettingsModal 및 VoiceGrid 화면 공유 비트레이트 preset 및 Dynacast 연동.

### 📝 Feature 3: 음성 채널 회의록 PDF/MD 내보내기 & 요약 UI
- [x] **[TICK-306] [SUMMARY-UI] 채널 내 수동 "AI 회의록 생성" 버튼 & 요약 드로어 퍼블리싱**
  - 유저 클릭 시 `/api/channels/[id]/summary` 데이터 바인딩 및 히스토리 표시.
- [x] **[TICK-307] [SUMMARY-EXPORT] 회의록 Markdown (.md) & 디자인된 PDF (.pdf) 다운로드**
  - 클라이언트 단 `.md` 파일 다운로드 및 스타일링된 `.pdf` 문서 다운로드 엔진 구축.

### 🎨 Feature 4: 실시간 공유 문서 DOCS & 화이트보드 CANVAS 채널
- [x] **[TICK-308] [CHANNEL-TYPE] DB 스키마 & API 라우트 채널 타입 확장 (DOCS / CANVAS)**
  - Prisma 스키마 업데이트 (`ChannelDoc`, `ChannelCanvas`) 및 엔드포인트 구축.
- [x] **[TICK-309] [DOCS-UI] 전역 SSE 동기화 기반 공동 마크다운 라이브 에디터 (DocsView)**
  - 실시간 SSE `doc:updated` 이벤트 수신 및 공동 편집기 실시간 반영.
- [x] **[TICK-310] [CANVAS-UI] 전역 SSE 동기화 기반 화이트보드 캔버스 (CanvasView)**
  - 실시간 SSE `canvas:updated` 이벤트 수신 및 화이트보드 그림판 동기화.
