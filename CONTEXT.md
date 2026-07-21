# PROJECT CONTEXT & MASTER SPECIFICATION (Source of Truth)

> **프로젝트 개요**: 업무, 게임, 회의, 강의 4가지 용도를 모두 아우르는 실시간 커뮤니케이션 & 협업 플랫폼 (Discord Clone Project)
> **서비스명**: 미정 (TBD)
> **작성일자**: 2026-07-20

---

## 1. 비전 및 핵심 목표

* **4-in-1 통합 커뮤니케이션 플랫폼**:
  1. **🎮 게임용**: 저지연 음성 통화 (10~30ms), 노이즈 캔슬링, 게임 화면 공유 (60fps)
  2. **🏢 업무용**: 채널 및 카테고리 구조, 스레드(Thread), 파일 공유, 역할(Role) 기반 권한 관리
  3. **👥 회의용**: 화상 그리드 뷰 (Grid View), 발표자 화면 공유, 손들기, 마이크 제어
  4. **🎓 강의용**: 1:N 방송 모드 (Stage Channel), 강사 발표 + 학생 질의응답 채널
* **비용 0원 최적화 ($0 Stack)**:
  * 개발 및 초기 소규모 운영 단계에서 모든 인프라 비용 **0원** 지향.
  * Oracle Cloud Free Tier (2코어 / 12GB RAM) 서버를 미디어/백엔드 호스팅으로 활용.

---

## 2. $0 전용 기술 스택 (Architecture & Tech Stack)

| 구분 | 기술 / 서비스 | 선정 이유 및 비용 |
| --- | --- | --- |
| **Front-End** | **Next.js (React) + Tailwind CSS** | Vercel / Cloudflare Pages (무료 호스팅) |
| **Back-End / DB** | **Supabase (PostgreSQL + Realtime)** | 인증(Auth) + 텍스트 채팅(WebSocket) 무료 플랜 |
| **Desktop App** | **Tauri (또는 Electron)** | 경량 데스크톱 실행 파일 (.exe, .dmg) 생성 |
| **Voice / Video / Screen** | **LiveKit SFU (WebRTC)** | Oracle Cloud 무료 VPS에 Self-Host하여 대규모 통화 $0 처리 |
| **서버 인프라** | **Oracle Cloud Always Free (2-Core, 12GB RAM)** | 음성/영상 미디어 서버 및 백엔드 파이프라인 무료 운용 |

---

## 3. AI 개발 운영 프레임워크 (AI Hero 7 Phases + Skills)

본 프로젝트는 **AI Hero 7 Phases** 지도와 **mattpocock/skills** 도구를 결합하여 개발을 진행한다.

```
Idea ──> Research ──> Prototype ──> PRD ──> Kanban ──> Execution ──> QA
(grill-me) (research)  (prototype) (to-spec) (to-tickets) (implement/tdd) (code-review)
```

### 핵심 개발 원칙:
1. **Vertical Slice 원칙**:
   * 레이어별 분리 개발(DB ➡️ API ➡️ UI)을 금지한다.
   * "사용자 동작부터 DB/네트워크 ➡️ UI 렌더링 ➡️ 검증"까지 포함된 **작은 Vertical Slice 단위**로 구현한다.
2. **AI 에이전트 통제 규칙**:
   * 대규모 변경 요청을 금지하며, 하나의 GitHub Issue / Vertical Slice 단위로 작업을 할당한다.
   * 버그 수정 전에는 반드시 재현 실패 케이스(`diagnosing-bugs`)를 만들고 진행한다.
   * 기능 구현은 TDD(테스트 선작성) 패턴을 우선 준수한다.
3. **문서 관리 규칙**:
   * `CONTEXT.md`: 장기 유지되는 서비스 사양 및 기술 도메인 용어 (Source of Truth)
   * `HANDOFF.md`: 세션/에이전트 이동 시 임시 요약 및 직전 상태
   * GitHub Issues: 실제 구현할 Vertical Slice 작업 티켓

---

## 4. 도메인 용어집 (Domain Glossary)

* **User Identity (사용자 인증 주체)**: 로그인 자격과 세션을 소유하는 사용자 본인 확인 주체. 다른 사용자가 보는 이름·아바타인 Profile과 구분한다.
* **Profile (프로필)**: 플랫폼 안에서 표시되고 Space 활동에 연결되는 사용자 표현. 인증 자격 자체를 뜻하지 않는다.
* **Account Exit (계정 탈퇴)**: 사용자의 접근권한을 즉시 회수하고, 취소 유예기간 뒤 User Identity와 직접 식별정보를 제거하는 절차. 공동 대화 기록의 일괄 삭제와는 구분한다.
* **Tombstone Profile (탈퇴 프로필)**: 탈퇴 완료 후 기존 대화의 참조 무결성만 유지하는 비식별 Profile. 모든 사용자에게 동일하게 '탈퇴한 사용자'로 표현되며 다시 로그인하거나 Membership을 가질 수 없다.
* **Space (스페이스)**: 디스코드의 '서버(Guild)'에 해당하는 최상위 커뮤니티 공간.
* **Membership (멤버십)**: 하나의 Profile이 하나의 Space에 참여하는 관계. Space 데이터 접근 권한의 기본 경계다.
* **Active Membership (활성 멤버십)**: 현재 접근권한을 부여하는 Membership. 탈퇴하거나 비활성화된 Profile의 과거 관계는 접근권한으로 인정하지 않는다.
* **Category (카테고리)**: 채널들을 묶는 그룹 (예: 🎮 게임, 🏢 업무, 🎓 강의).
* **TextChannel (텍스트 채널)**: Supabase Realtime 기반 실시간 메시징 채널.
* **VoiceChannel (음성 채널)**: WebRTC/LiveKit 기반의 소규모 통화 및 화면 공유 채널.
* **StageChannel (스테이지 채널)**: 강사/발표자 1인 대 대규모 수강생 형태의 방송 채널.
* **Role & Permission (역할 및 권한)**: 카테고리/채널별 접근 및 발언 권한 제어.

---

## 5. 핵심 개발 정책 및 스펙 (Core Specifications)

### 5.1 기술 세부 사항
* **상태 관리**: **Zustand**를 사용하여 실시간 채널, 메시지 상태 및 연결 상태 관리.
* **디자인 테마**: **Sleek Premium Dark Mode** (글래스모피즘 + 그라데이션 포인트) 단독 제공.

### 5.2 도메인 가입 및 템플릿 정책
* **스페이스 가입 흐름**: 초대 코드/링크 방식으로 가입. 사용자는 고유한 무작위 초대 링크를 통해 스페이스 멤버(`members`)로 자동 합류.
* **초기 생성 템플릿**: 스페이스 최초 생성 시, 자동으로 **'기본(General)'** 카테고리 아래에 **'# 일반(general)' 텍스트 채널**과 **'🔊 로비(Lobby)' 음성 채널**이 기본 생성됨.

### 5.3 보안 및 권한 정책 (Security & Authorization Policies)
* **Row Level Security (RLS)**: Supabase DB에 RLS를 전면 활성화하고, 모든 데이터 접근 권한을 스페이스 멤버십(`members` 테이블 내 가입 여부)에 바인딩함. 비멤버는 웹소켓 Realtime 구독이나 직접 조회를 통한 채널 메시지 읽기/쓰기가 물리적으로 불가능함.

### 5.4 추가 세부 설계 및 리소스 정책
* **프로필 동기화**: Supabase Auth 가입 시 PostgreSQL 데이터베이스 트리거(Trigger)를 사용하여 `public.profiles` 테이블에 자동으로 사용자 레코드를 동기화함.
* **삭제 정책 (Soft Delete)**: 스페이스 삭제 시 데이터베이스에서 즉시 레코드를 삭제하지 않고 `archived_at` 플래그를 통한 소프트 딜리트(Soft Delete) 방식을 적용함.
* **계정 탈퇴와 기록 보존**: 탈퇴 요청 즉시 로그인과 Space 접근을 중단하고 30일의 취소 유예기간 뒤 User Identity 및 직접 식별정보를 삭제한다. 메시지는 공동 대화의 연속성을 위해 Tombstone Profile 작성자로 보존하되, 사용자는 탈퇴 전에 자신의 메시지를 삭제할 수 있고 메시지 자체에 포함된 개인정보의 삭제 요청은 별도로 처리한다. 법적으로 검증된 삭제 요청은 유예기간 없이 처리한다.
* **Space owner 승계**: 활성 Space는 정확히 한 명의 활성 owner를 가진다. owner는 탈퇴 전에 각 Space를 같은 Space의 활성 멤버에게 명시적으로 승계하거나 archive해야 하며, 임의의 자동 승계는 하지 않는다. 법적 삭제 요청에 승계 선택이 없으면 해당 Space를 archive한다.
* **사용자 상태 추적 (Presence)**: Supabase Realtime Presence(인메모리 웹소켓)를 사용하여 데이터베이스 부하 없이 실시간 유저 온라인/오프라인 상태를 추적 및 동기화함.
* **파일 및 스토리지**: 아바타 및 채팅방 업로드 미디어를 Supabase Storage에 저장하고, DB 권한(RLS) 정책과 통합하여 보안을 유지함.

