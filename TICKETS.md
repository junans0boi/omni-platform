# Omni Platform Master Ticket Roadmap (TICKETS.md)

## 📌 1. 완료된 주요 이슈 & 티켓 (Completed Sprint A/B & Core)

- [x] **[TICK-100] 음성 채널 모드별 UI 분기 (GENERAL/MEETING/LECTURE)**
  - GENERAL 모드에서 발언신청/목록 패널 숨김 처리.
- [x] **[TICK-101] 모바일/태블릿 사이드바 UX 개선**
  - Backdrop Overlay, X 닫기 버튼, 채널 클릭 및 ESC 닫기 로직.
- [x] **[TICK-102] LiveKit DataChannel 실시간 발언권 연동 (Floor Control)**
  - `FLOOR_REQUEST`, `FLOOR_GRANT`, `FLOOR_REVOKE` 손들기/마이크 제어.
- [x] **[TICK-103] VoiceGrid 및 SettingsModal i18n 번역 적용**
  - catalogs.ts 한/영 번역 키 추가 및 useI18n t() 적용.
- [x] **[TICK-104] 마이크 프로필 getUserMedia constraints 반영**
  - isolation(노이즈 억제 ON) / studio(RAW) 오디오 프로필 실제 적용.
- [x] **[TICK-105] Caddy Web Server 배포 통합**
  - deploy.sh Nginx -> Caddy + Let's Encrypt 자동 HTTPS.
- [x] **[TICK-106] 전체화면 버튼 Lucide 아이콘 교체**
  - 이모지 -> Maximize2 / Minimize2 교체.
- [x] **[TICK-67] Google OAuth 2.0 프록시 동적 Origin 감지**
  - Reverse Proxy (Caddy) 환경 외부 접속 콜백 리다이렉트 문제 해결.
- [x] **[TICK-15] 전역 SSE 파이프라인 (/api/events/stream)**
  - 단일 이벤트 스트림 발행 및 클라이언트 동기화.

---

## 🚀 2. 차기 로드맵 티켓 (Future Sprint Backlog)

### 🔹 Sprint C: 미디어 & 화면 공유 보강
- [ ] **[TICK-201] 음성 채널 노이즈 캔슬링 (RNNoise/WebRTC DSP Node)**
  - 브라우저 Wasm 기반 알고리즘 노이즈 필터 선택 옵션 추가.
- [ ] **[TICK-202] 화면 공유 고화질(1080p 60fps) & 프레임레이트 조절 옵션**
  - LiveKit screen share publication quality presetUI 구성.

### 🔹 Sprint D: AI & 회의록 기능 확장
- [ ] **[TICK-301] 실시간 Whisper Web Worker 기반 텍스트 자막(Caption) UI**
  - 스트리밍 음성을 클라이언트 캔버스 자막 오버레이로 출력.
- [ ] **[TICK-302] 회의록 PDF/Markdown 내보내기 기능**
  - 요약된 회의록 데이터를 로컬 문서로 내보내기.
