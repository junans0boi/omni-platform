# Omni Platform (옴니 플랫폼)

Omni Platform은 디스코드(Discord) 및 슬랙(Slack) 스타일의 **스페이스/채널 커뮤니케이션**, **스페이스 RBAC 권한 & 커스텀 역할 관리**, **1:1 DM 및 친구 관리**, **파일/이미지 첨부**, **감사 로그(Audit Logs)**, **실시간 음성/화상 회의**를 지원하는 차세대 커뮤니케이션 플랫폼입니다.

---

## 🌟 주요 기능 (Key Features)

### 1. 🛡️ 디스코드 스타일 스페이스 설정 & 커스텀 역할 (RBAC & Space Settings)
- **독립 스페이스 설정 모달 (`SpaceSettingsModal`)**: 스페이스 헤더의 ⚙️ 버튼으로 전용 설정창 열기.
- **6대 세부 권한 커스텀 역할**: `MANAGE_SPACE`, `MANAGE_ROLES`, `MANAGE_CHANNELS`, `KICK_MEMBERS`, `MANAGE_MESSAGES`, `SPEAK_VOICE` 토글 및 커스텀 역할 Color Picker 지원.
- **비공개 채널 🔒 락 (Channel Permissions)**: 특정 유저 또는 특정 커스텀 역할만 접근 가능하도록 채널별 오버라이드 설정.
- **감사 로그 (Audit Logs)**: 메시지 삭제(삭제된 텍스트 본문 기록), 역할 변경, 스페이스 프로필 수정 등의 활동을 실시간 타임라인으로 수집 및 조회.

### 2. 💬 실시간 채널 & 1:1 DM 채팅 (SSE Realtime Sync)
- **Server-Sent Events (SSE) 기반 실시간 메세징**: 소켓 overhead 없이 빠른 실시간 메시지 동기화 및 즉시 삭제(`_type: DELETE`) 브로드캐스트.
- **1:1 DM & 친구 관리**:
  - 친구 요청/수락/거절 및 안 읽은 메시지 수량 **빨간 원 뱃지 (`bg-danger`)** 실시간 표시.
  - 대화방 진입 시 자동 읽음 처리(`lastReadAt`) 및 뱃지 소멸.
- **한글 IME 조합 및 중복 전송 방지**: 한글 입력 중 Enter 키 중복 이벤트 차단 및 전송 진행 락(Lock) 구현.

### 3. 📎 파일 & 이미지 첨부 (Rich Attachments)
- **20MB 고용량 파일 지원**: 이미지뿐만 아니라 PDF, ZIP, DOCX, TXT 등 모든 형식의 일반 파일 업로드.
- **상단 첨부 배너 & 다운로드 카드**: 입력창 상단 첨부 배너 표시 및 채팅창 내 클릭 한 번으로 다운로드 가능한 파일 카드 렌더링.

### 4. 🎨 멀티 테마 시스템 (Multi-Theme System)
- **3가지 독자적 커스텀 테마**: Default, Transmission (사이버펑크 스타일), Night Signal (다크 그린/네온 메카 스타일).
- **Light & Dark 모드 지원**: 총 6가지 색상 조합.
- **실시간 테마 전환 및 DB 자동 저장**.

### 5. 🎙️ 실시간 음성/화상 커뮤니케이션 & 사운드
- **LiveKit WebRTC 연동**: 저지연 음성 및 화상 통화, 화면 공유, 마이크/카메라 켜기/끄기.
- **Web Audio API 합성 효과음**: 외부 파일 없이 자체 연산된 고품질 사운드 이펙트.

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

# Prisma 데이터베이스 마이그레이션 및 db push
npx prisma db push
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
├── prisma/                    # Prisma DB schema (Space, Channel, Role, AuditLog, ChannelOverride)
├── src/
│   ├── app/                   # Next.js App Router (페이지 및 API 엔드포인트)
│   │   ├── api/
│   │   │   ├── dm/            # 1:1 DM 관련 API 및 SSE 스트림
│   │   │   ├── friends/       # 친구 요청/관리 API
│   │   │   ├── channels/      # 채널 메시지 및 SSE 스트림
│   │   │   ├── spaces/        # 스페이스 RBAC, 역할, 감사로그 API
│   │   │   └── upload/        # 20MB 파일/이미지 업로드 API
│   │   └── dashboard/         # 메인 대시보드 페이지
│   ├── components/            # UI 컴포넌트 (SpaceSettingsModal, FriendsPanel, ThreadPanel 등)
│   ├── hooks/                 # 커스텀 훅 (useFriendsAndDms, useRealtime 등)
│   ├── lib/                   # 유틸리티 (audit, sound-effects, events, auth, prisma)
│   └── store/                 # Zustand 전용 앱 상태 관리에 관한 스토어 (useAppStore.ts)
└── public/                    # 정적 자원
```

---

## 📄 라이선스 (License)

MIT License. 자유롭게 변경 및 재배포 가능합니다.
