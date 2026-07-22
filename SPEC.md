# PRODUCT SPECIFICATION (PRD) - Phase 1: MVP Core & Real-time Text Chat

## 1. 개요 (Overview)
본 문서는 실시간 커뮤니케이션 플랫폼인 Omni-Platform의 **Phase 1: 기초 뼈대 및 실시간 텍스트 채팅** 구현을 위한 상세 명세서(Spec)입니다. 

---

## 2. 세부 기능 요구사항 (Functional Requirements)

### 2.1 사용자 인증 및 프로필 (Auth & Profiles)
- **가입 및 로그인**: Supabase Auth (Email/Password)를 사용해 가입 및 로그인을 수행합니다.
- **프로필 연동**: `auth.users`에 신규 계정 생성 시 데이터베이스 trigger를 통해 자동으로 `public.profiles` 테이블에 프로필 레코드(id, username, avatar_url, updated_at)가 기본값과 함께 생성됩니다.

### 2.2 스페이스 및 초대 시스템 (Spaces & Invites)
- **스페이스 생성**: 이름, 아바타 이미지를 입력받아 생성하며 고유한 6자리 이상의 랜덤 초대 코드(예: `invite_code`)를 자동으로 발행합니다.
- **초기 템플릿**: 스페이스 최초 생성 시, 자동으로 **'기본(General)'** 카테고리가 생성되고 그 하위에 **'# 일반(general)' 텍스트 채널**과 **'🔊 로비(Lobby)' 음성 채널**이 함께 인서트됩니다.
- **초대 가입**: 사용자가 초대 코드를 입력해 해당 스페이스의 멤버(`members`)로 조인합니다.
- **스페이스 삭제 (소프트 딜리트)**: 삭제 요청 시 `archived_at` 컬럼에 타임스탬프를 기록하여 비활성화하며 일반 조회 쿼리에서는 제외 처리합니다.

### 2.3 실시간 텍스트 채팅 및 Presence
- **실시간 메시징**: Supabase Realtime 채널을 활성화하여 특정 텍스트 채널 안의 실시간 메시지 발신 및 수신을 지원합니다.
- **유저 Presence**: Supabase Realtime Presence 기능을 이용하여 각 스페이스별 멤버들의 실시간 온라인/오프라인 상태를 UI에 표시합니다.

---

## 3. 데이터베이스 스키마 설계 (Database Schema)

### `profiles` (사용자 프로필)
- `id`: `uuid` (Primary Key, references `auth.users.id` on delete cascade)
- `username`: `text` (Not Null)
- `avatar_url`: `text` (Nullable)
- `updated_at`: `timestamp with time zone`

### `spaces` (스페이스)
- `id`: `uuid` (Primary Key, default `gen_random_uuid()`)
- `name`: `text` (Not Null)
- `avatar_url`: `text` (Nullable)
- `invite_code`: `text` (Unique, Not Null)
- `owner_id`: `uuid` (references `profiles.id`)
- `created_at`: `timestamp with time zone`
- `archived_at`: `timestamp with time zone` (Nullable)

### `categories` (카테고리)
- `id`: `uuid` (Primary Key)
- `space_id`: `uuid` (references `spaces.id` on delete cascade)
- `name`: `text` (Not Null)
- `position`: `integer` (순서 정렬용)

### `channels` (채널)
- `id`: `uuid` (Primary Key)
- `space_id`: `uuid` (references `spaces.id` on delete cascade)
- `category_id`: `uuid` (references `categories.id` on delete cascade, Nullable)
- `name`: `text` (Not Null)
- `type`: `enum` ('TEXT', 'VOICE', 'STAGE')
- `created_at`: `timestamp with time zone`

### `members` (스페이스 멤버십)
- `id`: `uuid` (Primary Key)
- `space_id`: `uuid` (references `spaces.id` on delete cascade)
- `profile_id`: `uuid` (references `profiles.id` on delete cascade)
- `role`: `enum` ('OWNER', 'ADMIN', 'MEMBER')
- `created_at`: `timestamp with time zone`

### `messages` (메시지)
- `id`: `uuid` (Primary Key)
- `channel_id`: `uuid` (references `channels.id` on delete cascade)
- `profile_id`: `uuid` (references `profiles.id`)
- `content`: `text` (Not Null)
- `created_at`: `timestamp with time zone`

---

## 4. Row Level Security (RLS) 정책 명세

- **spaces**: 멤버(`members`) 테이블에 본인의 `profile_id`와 `space_id` 매칭 데이터가 존재하거나 `owner_id`인 유저만 SELECT 가능.
- **channels / categories**: 상위 스페이스의 멤버십을 가진 유저만 SELECT 가능.
- **members**: 동일한 `space_id`에 속한 멤버이거나 본인의 프로필인 경우만 조회 가능.
- **messages**: 소속 스페이스의 채널에 대해 읽기/쓰기 권한 부여.

---

## 5. Phase 2: 실시간 음성/화상 통화 & 스테이지 채널 명세 (Voice & Video SFU Specification)

### 5.1 LiveKit 토큰 발행 API (`/api/livekit/token/route.ts`)
- **역할**: 클라이언트가 특정 음성/화상/스테이지 채널에 진입할 때 사용할 access token을 동적으로 발행합니다.
- **사양**:
  - `LiveKit Server SDK`를 사용하여 Next.js API Route(Serverless)로 구현.
  - **입력 쿼리 파라미터**: `room` (채널 UUID인 `channel_id`), `username` (유저의 profile username)
  - **권한 처리**: 
    - 세션 검증: Supabase Auth 세션이 존재하고 로그인된 유저만 호출 가능.
    - 해당 `channel_id`의 상위 `space_id`에 대해 해당 유저가 `public.members`에 등록되어 있는지 검증 후 통과 시에만 토큰 발급.
    - 채널 타입이 `STAGE`인 경우, 멤버의 역할(`role`)이 `ADMIN` 또는 `OWNER`인 경우에만 `canPublish` 권한을 부여하고, `MEMBER`인 경우 `canPublish` 권한을 `false`로 설정 (청취자 모드).

### 5.2 LiveKit Room 매핑 정책
- **일관성**: LiveKit Room Name은 채널의 UUID(`channel_id`)로 1:1 매핑하여 사용합니다.
- **오디오 코덱 및 품질**: 저지연 음성 통화(10~30ms) 및 화면 공유(60fps)를 지원하기 위해 LiveKit 기본 WebRTC 프로필을 적용합니다.

### 5.3 사용자 인터페이스 (Collapsible Voice/Video Grid)
- **레이아웃**: 음성/화상/스테이지 채널에 들어가면 중앙 채팅 영역 상단에 **접이식(Collapsible) 그리드 뷰**가 나타납니다.
  - 마이크 및 비디오 활성화 상태 표시.
  - 참여자들의 아바타 및 실시간 화상 스트림 그리드로 렌더링.
  - 참여자가 화면 공유를 진행하는 경우 크게 볼 수 있도록 강조 레이아웃 제공.
  - 음성 채널이 활성화된 상태에서도 하단 텍스트 채팅 영역을 통해 메시지를 실시간으로 공유 가능.

---

## 6. Phase 3: 전역 실시간 파이프라인 & 디스코드 스타일 2단 사이드바 명세

### 6.1 전역 SSE 실시간 이벤트 스트림 (`/api/events/stream`)
- **아키텍처**: 사용자 단위 전역 Server-Sent Events (SSE) 파이프라인 구축.
- **수신 이벤트 타입**:
  - `MESSAGE_CREATED`: 채널 신규 메시지 수신
  - `DM_CREATED`: 1:1 DM 신규 메시지 수신 및 알림
  - `FRIEND_REQUEST_SENT` / `FRIEND_REQUEST_ACCEPTED`: 친구 요청/수락 실시간 동기화
  - `NOTIFICATION_CREATED`: 전역 시스템/멘션 알림
  - `UNREAD_COUNTS_UPDATED`: 읽지 않은 배지 수 실시간 동기화
- **자동 폴링 백업**: SSE 연결 해제 또는 네트워크 흔들림 시 3~5초 간격의 백그라운드 폴링 자동 전환.

### 6.2 디스코드 스타일 2단 사이드바 레이아웃
- **최좌측 64px 세로 아이콘바**:
  - 상단 `[친구/DM]` 아이콘 (미읽음 DM + 대기 친구 요청 통합 배지)
  - 구분선(Divider)
  - `[스페이스 목록]` 세로 아이콘 리스트 (스페이스별 미읽음 배지 포함)
  - 하단 `[프로필 & 설정]` 아이콘
- **중단 240px 상세 패널**:
  - `[친구/DM]` 클릭 시: DM 대화 상대 목록 및 친구 탭(온라인, 전체, 대기 중, 친구 추가) 표시
  - `[스페이스]` 클릭 시: 해당 스페이스의 카테고리 및 채널(# 텍스트 / 🔊 음성) 목록 표시 (드롭다운 완전 제거)

### 6.3 모바일 반응형 슬라이드 드로어 & 검은 화면(Black Screen) 방지
- **검은 화면 방지**: 채널 또는 DM 미선택 시에도 대시보드가 비어있는 검은 화면이 되지 않도록 스페이스 목록 / 채널 선택 패널을 자동 렌더링.
- **모바일 드로어**: 768px 미만 뷰포트에서 채팅창 상단 햄버거(`☰`) 버튼 제공, 터치/클릭 시 좌측 사이드바가 모바일 스크린 전체에 슬라이드 덮개(Overlay Drawer)로 노출.

### 6.4 실시간 친구 요청 및 DM 배지 동기화
- **친구 요청 동기화**: 친구 요청 수신 시 '대기 중' 탭 및 사이드바 배지에 즉시 `+1` 반영. 수락 시 새로고침 없이 양쪽 유저의 '친구 목록/온라인' 탭으로 즉시 이동 및 DM 전송 버튼 활성화.
- **배지 차감 (Clear)**: 유저가 해당 DM 메시지창 또는 채널에 진입(Mount) 시 읽지 않은 배지 카운트를 DB와 연동하여 0으로 자동 소멸.

