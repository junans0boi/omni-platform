# Omni Platform System Specification (SPECIFICATION)

## 📌 1. 개요 (Overview)
Omni Platform은 디스코드(Discord) 스타일의 차세대 실시간 커뮤니케이션 플랫폼으로, 실시간 음성/화상 통화(LiveKit integration), 메시징, 1:1 DM 및 친구 관리, 다국어(i18n), 커스텀 RBAC 권한, Caddy 기반 HTTPS 자동화 배포, 그리고 **4대 신규 확장 기능 (실시간 AI 자막, 웹캠 가상 배경/화질 설정, 회의록 PDF/MD 내보내기, 실시간 공유 문서/캔버스 채널)**을 지원합니다.

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

## 🏗️ 3. 핵심 시스템 아키텍처 (Core System Architecture)

```mermaid
graph TD
    Client[Web Client - Next.js] -->|HTTPS / WSS| Caddy[Caddy Reverse Proxy]
    Caddy -->|Port 3000| NextApp[Next.js App Server]
    NextApp -->|Prisma ORM| SQLite[(SQLite Database)]
    NextApp -->|SSE Pipeline| Events[/api/events/stream]
    Client -->|WebRTC / DataChannel| LiveKit[LiveKit Media Server]
    
    subgraph Advanced Features
        Client -->|Web Speech API| LiveCaptions[Live Captions Overlay]
        Client -->|Canvas Processing| VirtualBg[Virtual Background Filter]
        NextApp -->|PDF / MD Generation| SummaryExport[Summary Export Engine]
        NextApp -->|Docs & Canvas API| ChannelExtensions[DOCS & CANVAS Channels]
    end
```

---

## 📑 4. 상세 기능 명세 (Detailed Specifications)

### 4.1 실시간 AI 자막 기능 (Live Captions)
- **음성 인식 캡처**: 브라우저 native Web Speech API (`webkitSpeechRecognition`) 활용.
- **실시간 패킷 브로드캐스트**: 인식된 자막 텍스트를 LiveKit DataChannel(`CAPTION_CHUNK`)을 통해 해당 채널 모든 참여자에게 전송.
- **자막 렌더링**: VoiceGrid 하단 오버레이 바에 화자 이름(`@username`) 및 텍스트 시각화.

### 4.2 웹캠 가상 배경 & 화면 공유 프레셋 (Virtual Background & Quality Presets)
- **비디오 배경 가공**: Canvas 2D `filter = "blur(8px)"` 처리를 통한 가상 배경 블러(Blur) 적용.
- **화면 공유 프리셋**: 720p(30fps), 1080p(60fps) 등 화면 공유 인코딩 비트레이트 및 resolution 옵션 선제 지정.

### 4.3 회의록 PDF / Markdown 내보내기 & 요약 히스토리 UI
- **히스토리 조회 & 생성**: `/api/channels/[id]/summary` API 통신.
- **문서 내보내기**: 마크다운(`.md`) 파일 다운로드 (Blob 인코딩) 및 HTML to PDF 파싱 기능 제공.

### 4.4 실시간 공유 문서/캔버스 채널 (DOCS & CANVAS Channels)
- **채널 타입 확장**: `DOCS` (마크다운 공동 에디터), `CANVAS` (화이트보드 그림판).
- **데이터 영속성**: `ChannelDoc` 및 `ChannelCanvas` 테이블을 통한 문서 내역 저장 및 실시간 동기화.
