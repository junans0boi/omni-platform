# Omni Platform (옴니 플랫폼)

Omni Platform은 디스코드(Discord) 및 슬랙(Slack) 스타일의 **스페이스/채널 커뮤니케이션**, **1:1 DM 및 친구 관리**, **실시간 음성/화상 회의**를 지원하는 차세대 커뮤니케이션 플랫폼입니다.

---

## 🌟 주요 기능 (Key Features)

### 1. 🎨 멀티 테마 시스템 (Multi-Theme System)
- **3가지 독자적 커스텀 테마**: Default, Transmission (사이버펑크 스타일), Night Signal (다크 그린/네온 메카 스타일).
- **Light & Dark 모드 지원**: 총 6가지 색상 조합.
- **실시간 테마 전환 및 저장**: 설정(Settings) 메뉴에서 자유롭게 전환 가능하며 데이터베이스(`UserPreference`) 및 LocalStorage에 자동 저장.

### 2. 💬 실시간 채널 & 1:1 DM 채팅
- **Server-Sent Events (SSE) 기반 실시간 메세징**: 소켓 overhead 없이 가볍고 빠른 실시간 메시지 동기화.
- **1:1 DM & 친구 관리**:
  - 친구 요청/수락/거절 및 대기 중 요청 관리.
  - 사이드바 친구/DM 탭 통합 및 실시간 안 읽은 메시지 뱃지(`dmUnreadBadges`) 표시.
  - 메시지 중복 방지 (Deduplication) 및 자동 스크롤.
- **채널 모드 지원**: 일반(General), 회의(Meeting), 강의(Lecture) 모드 채널 생성 및 관리.

### 3. 🎙️ 실시간 음성/화상 커뮤니케이션
- **LiveKit WebRTC 연동**: 저지연 음성 및 화상 통화.
- 화면 공유, 마이크/카메라 켜기/끄기 및 상태 동기화.

### 4. 🔊 Web Audio 기반 사운드 시스템
- 외부 오디오 파일 없이 Web Audio API로 자체 합성된 고품질 효과음 (`INACTIVE_MESSAGE`, `TARGETED_MENTION`, `LOCAL_MUTED` 등).
- DND (방해금지) 모드 및 마스터 볼륨 설정 지원.

---

## 🛠️ 기술 스택 (Tech Stack)

- **Frontend / Framework**: [Next.js 15](https://nextjs.org/) (App Router), React 19, TypeScript
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Realtime Architecture**: Server-Sent Events (SSE), In-Memory Event Broker (`EventEmitter`)
- **Database & ORM**: Prisma ORM, SQLite / PostgreSQL
- **Voice & Video**: LiveKit WebRTC SDK
- **Styling**: Tailwind CSS v4, Vanilla CSS Semantic Tokens

---

## 🚀 시작하기 (Getting Started)

### 1. 사전 요구 사항 (Prerequisites)
- Node.js 18+ 이상
- npm / yarn / pnpm

### 2. 환경 변수 설정 (`.env.local`)
프로젝트 루트 디렉토리에 `.env.local` 파일을 생성하고 아래 설정을 입력합니다:

```env
DATABASE_URL="file:./prisma/dev.db"
OMNI_PLATFORM_BACKEND=legacy

# LiveKit WebRTC (음성/화상 기능 사용 시)
NEXT_PUBLIC_LIVEKIT_URL=wss://your-livekit-server.livekit.cloud
LIVEKIT_URL=wss://your-livekit-server.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
```

### 3. 의존성 설치 및 DB 마이그레이션
```bash
# 패키지 설치
npm install

# Prisma 데이터베이스 마이그레이션 적용
npx prisma migrate dev
```

### 4. 개발 서버 실행
```bash
npm run dev
```
브라우저에서 `http://localhost:3000` 접속 후 사용 가능합니다.

---

## 📁 주요 디렉토리 구조 (Directory Structure)

```text
omni-platform/
├── prisma/                    # Prisma DB schema 및 마이그레이션 파일
├── src/
│   ├── app/                   # Next.js App Router (페이지 및 API 엔드포인트)
│   │   ├── api/
│   │   │   ├── dm/            # 1:1 DM 관련 API 및 SSE 스트림
│   │   │   ├── friends/       # 친구 요청/관리 API
│   │   │   ├── channels/      # 채널 메시지 및 SSE 스트림
│   │   │   └── users/me/stream # 유저 전용 실시간 알림 SSE 스트림
│   │   └── dashboard/         # 메인 대시보드 페이지
│   ├── components/            # UI 컴포넌트 (FriendsPanel, SettingsModal, ThreadPanel 등)
│   ├── hooks/                 # 커스텀 훅 (useFriendsAndDms, useRealtime 등)
│   ├── lib/                   # 유틸리티 (sound-effects, events, auth, prisma)
│   └── store/                 # Zustand 전용 앱 상태 관리에 관한 스토어 (useAppStore.ts)
└── public/                    # 정적 자원
```

---

## 📄 라이선스 (License)

MIT License. 자유롭게 변경 및 재배포 가능합니다.
