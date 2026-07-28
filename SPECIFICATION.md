# Omni Platform System Specification & PRD (SPECIFICATION.md)

## 📌 1. 제품 개요 (Product Overview)
Omni Platform은 디스코드(Discord) 스타일의 차세대 실시간 커뮤니케이션 플랫폼으로, 실시간 음성/화상 통화(LiveKit integration), 메시징, 1:1 DM 및 친구 관리, 다국어(i18n), 커스텀 RBAC 권한, Caddy 기반 HTTPS 자동화 배포, 그리고 **4대 신규 확장 기능 (실시간 AI 자막, 웹캠 가상 배경/화질 프리셋, 회의록 PDF/MD 내보내기, 실시간 공유 문서/캔버스 채널)**을 지원합니다.

---

## 🛠️ 2. 기술 스택 (Technology Stack)
- **Frontend Framework**: Next.js 15 (App Router, React 19)
- **State Management**: Zustand (전역 영속성 및 미읽음 배지 관리)
- **Styling**: Vanilla CSS / Tailwind CSS (다크 모드 및 커스텀 테마 트랜스미션/나이트 시그널 지원)
- **Database & ORM**: SQLite (Prisma ORM)
- **Realtime Media / Voice**: LiveKit Client SDK (`livekit-client` v2.x) & Web Speech API
- **Realtime Pipeline**: Server-Sent Events (SSE) + EventEmitter (`/api/events/stream`) & LiveKit DataChannel
- **Reverse Proxy & TLS**: Caddy Server (Let's Encrypt 자동 HTTPS & WebSocket Proxy)

---

## 🏗️ 3. 핵심 아키텍처 (Architecture Diagram)

```mermaid
graph TD
    Client[Web Client - Next.js] -->|HTTPS / WSS| Caddy[Caddy Reverse Proxy]
    Caddy -->|Port 3000| NextApp[Next.js App Server]
    NextApp -->|Prisma ORM| SQLite[(SQLite Database)]
    NextApp -->|SSE Pipeline| Events[/api/events/stream]
    Client -->|WebRTC / DataChannel| LiveKit[LiveKit Media Server]
    
    subgraph Advanced Features Pipeline
        Client -->|Web Speech API| LiveCaptions[Live Captions Rolling Overlay]
        Client -->|Canvas Processing| VirtualBg[Virtual Background & Presets]
        NextApp -->|Gemini AI / Markdown & PDF| SummaryExport[Summary Export Engine]
        NextApp -->|SSE MessageBroker| ChannelExtensions[DOCS & CANVAS Realtime Sync]
    end
```

---

## 📑 4. 4대 신규 기능 상세 PRD 명세 (Product Requirements Document)

### 4.1 🎙️ 실시간 AI 자막 기능 (Realtime Live Captions)
- **데이터 흐름**: Web Speech API로 발화 음성을 실시간 텍스트 추출 -> LiveKit DataChannel (`CAPTION_CHUNK`)로 참여자 전체 브로드캐스트.
- **저장 정책**: **호스트 선택형 (옵션 C)** — 호스트가 저장 옵션을 활성화했을 때만 회의록 DB에 기록.
- **언어 정책**: **원문 그대로 표시 (옵션 B)** — 발화자의 언어를 자동 감지하여 원문 텍스트 렌더링.
- **UI 렌더링**: **최근 롤링 리스트 (옵션 B)** — VoiceGrid 하단 자막 바에 화자(@username) 이름과 함께 최근 2~3개 자막을 위로 밀어올리며 시각화.

### 4.2 📺 웹캠 가상 배경 & 화면 공유 고화질 프리셋 (Virtual Background & Quality)
- **가상 배경 지원**: **블러 + 프리셋 이미지 (옵션 B)** — Canvas 2D 기반 배경 블러(Blur) 및 기본 제공 4~5종 정적 이미지 배경 제공.
- **화면 공유 품질**: **자유 선택 + Dynacast 자동 적응 (옵션 A + C)** — 유저가 720p 30fps ~ 1080p 60fps 프리셋을 자유 선택 가능하며, 수신자의 네트워크 상태에 따라 Dynacast 비트레이트 자동 하향 적용.

### 4.3 📝 음성 채널 스마트 회의록 PDF/MD 내보내기 & 요약 히스토리 UI
- **트리거 방식**: **수동 버튼 클릭 (옵션 B)** — 채널 내 "AI 회의록 생성" 버튼을 사용자가 클릭 시 `/api/channels/[id]/summary` 호출로 생성.
- **파일 내보내기**: **Markdown + PDF 멀티 (옵션 B)** — 마크다운(`.md`) 파일 클라이언트 다운로드 및 스타일링된 `.pdf` 문서를 동시에 다운로드 기능 제공.

### 4.4 🎨 실시간 공유 문서 DOCS & 화이트보드 CANVAS 채널
- **채널 확장**: `DOCS` (마크다운 라이브 에디터), `CANVAS` (화이트보드 그림판) 채널 지원.
- **동시 편집 동기화**: **실시간 SSE 연동 (옵션 B)** — 단일 전역 SSE 파이프라인(`messageBroker` & `/api/events/stream`)을 통해 누군가 수정/그리기 시 상대방 UI에 즉시 동기화.
