# Omni Platform System Specification (SPECIFICATION)

## 📌 1. 개요 (Overview)
Omni Platform은 디스코드(Discord) 스타일의 차세대 실시간 커뮤니케이션 플랫폼으로, 실시간 음성/화상 통화(LiveKit integration), 메시징, 1:1 DM 및 친구 관리, 다국어(i18n), 커스텀 RBAC 권한, Caddy 기반 HTTPS 자동화 배포를 지원합니다.

---

## 🛠️ 2. 기술 스택 (Technology Stack)
- **Frontend Framework**: Next.js 15 (App Router, React 19)
- **State Management**: Zustand (전역 영속성 및 미읽음 배지 관리)
- **Styling**: Vanilla CSS / Tailwind CSS (다크 모드 및 커스텀 테마 트랜스미션/나이트 시그널 지원)
- **Database & ORM**: SQLite (Prisma ORM)
- **Realtime Media / Voice**: LiveKit Client SDK (`livekit-client` v2.x)
- **Realtime Pipeline**: Server-Sent Events (SSE) + EventEmitter (`/api/events/stream`)
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
```

---

## 📑 4. 상세 기능 명세 (Detailed Specifications)

### 4.1 음성/화상 채널 및 발언권 제어 (Voice & Stage Channels)
- **채널 모드 (Channel Modes)**:
  - `GENERAL` (자유 소통): 제한 없는 다자간 대화.
  - `MEETING` (회의 모드) & `LECTURE` (강의 모드): 호스트 관리 하의 발언권 제어.
- **LiveKit DataChannel 기반 발언권 제어 (Floor Control)**:
  - `FLOOR_REQUEST`: 비-호스트 발언 신청 브로드캐스트.
  - `FLOOR_CANCEL`: 발언 신청 취소.
  - `FLOOR_GRANT`: 호스트가 해당 참여자 마이크 실시간 개방 (`setMicrophoneEnabled(true)`).
  - `FLOOR_REVOKE`: 호스트가 발언 권한 회수 (`setMicrophoneEnabled(false)`).
- **마이크 입력 프로필 (Audio Input Profiles)**:
  - `isolation`: 노이즈 억제 ON, 에코 취소 ON, 자동 게인 ON.
  - `studio`: 노이즈 억제 OFF, 에코 취소 OFF, 자동 게인 OFF (RAW 오디오).
  - `custom`: 개별 오디오 노드 선택.

### 4.2 사용자 인증 및 Google OAuth 2.0
- **동적 Public Origin 감지 (`getPublicOrigin`)**:
  - 리버스 프록시(Caddy/Nginx) 헤더 (`x-forwarded-host`, `x-forwarded-proto`, `host`)를 자동 해석하여 외부 도메인(`https://omni.steady2vivid.kro.kr`) 및 로컬 개발 환경 모두 지원.
- **자체 세션 관리**:
  - SHA-256 토큰 해싱 기반 HTTP-only 세션 쿠키 발급.

### 4.3 모바일/태블릿 반응형 UX (Mobile Responsiveness)
- 768px 이하 모바일 환경 사이드바 자동 닫기.
- Backdrop Overlay 터치 닫기, 사이드바 상단 `X` 버튼, 채널 클릭 시 자동 슬라이드 수축 및 `ESC` 키 바인딩.

### 4.4 다국어 지원 (i18n)
- 한국어(`ko`), 영어(`en`) 카탈로그 지원 (`catalogs.ts`).
- `I18nProvider` 및 `useI18n()` 훅을 통한 컴포넌트 텍스트 동적 동기화.

---

## 🗄️ 5. 주요 데이터베이스 모델 (Data Schema)

- **`Profile`**: 사용자 계정, 이메일, 아바타, 상태(AVAILABLE/IDLE/DND).
- **`Space`**: 커뮤니티 공간, 소유자(ownerId), 초대 코드(inviteCode).
- **`Channel`**: 텍스트/음성/스테이지 채널, 모드(GENERAL/MEETING/LECTURE).
- **`Message`**: 채널 메시지, 답글(replyToId), 스레드(threadRootId), 핀(isPinned).
- **`Friendship`**: 친구 관계(PENDING/ACCEPTED/BLOCKED), 요청자, 1:1 대화 연결.
