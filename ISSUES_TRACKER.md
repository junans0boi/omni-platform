# Omni Platform — Issue Tracker & Resolution Log

이 문서는 모든 기능 요구사항 및 이슈의 등록, 구현, 검증, 종료(Closed) 상태를 추적 관리하는 공식 문서입니다.

---

## 📌 최근 완료 및 종료된 이슈 목록 (Closed Issues)

| Issue ID | Category | Issue Title | Status | Completion Date |
| :--- | :--- | :--- | :--- | :--- |
| **#61** | Feature | `FEAT-DM_UNREAD_BADGE`: 1:1 DM 읽음/안읽음 실시간 뱃지 동기화 및 붉은 원 뱃지 | **CLOSED** | 2026-07-22 |
| **#62** | Feature | `FEAT-SPACE_SETTINGS_RBAC`: 독립 스페이스 설정 화면, 디스코드 커스텀 역할/권한, 비공개 락, 감사 로그 | **CLOSED** | 2026-07-22 |
| **#27** | Feature | `FEAT-RICHMEDIA`: 풍부한 파일 업로드 및 링크 미리보기 | **CLOSED** | 2026-07-22 |
| **#63** | Feature | `FEAT-REALTIME_SYNC_ENHANCEMENT`: 스페이스 프로필/메시지 실시간 삭제 및 인라인 역할 선택 UI 잘림 해결 | **CLOSED** | 2026-07-22 |

---

## 📝 이슈별 세부 완료 작업 및 검증 이력

### 1. Issue #61 — 1:1 DM 읽음/안읽음 및 빨간 원 뱃지 (`FEAT-DM_UNREAD_BADGE`)
- **내용**:
  - `DirectParticipant` 스키마에 `lastReadAt` 필드 추가 및 `POST /api/dm/[conversationId]/read` 읽음 처리 API 구현.
  - DM 진입 시 실시간 미확인 수량이 자동 차감되며, 친구 목록 및 상단 탭에 안 본 메시지 수량이 **빨간 원 뱃지 (`bg-danger`)**로 표시됨.
- **검증**: `verify_all_requested_features.mjs` E2E 자동화 검증 완료.

### 2. Issue #62 — 독립 스페이스 설정 & 커스텀 역할/감사 로그 (`FEAT-SPACE_SETTINGS_RBAC`)
- **내용**:
  - `SpaceSettingsModal.tsx` 구축 (개요, 역할/권한, 멤버 관리, 채널 락, 감사 로그, 위험 지역).
  - 디스코드 방식 커스텀 역할 생성(Color Picker) 및 6대 세부 권한 토글 구현.
  - 채널 비공개 🔒 토글 및 사이드바 목록/메시지 API 권한 차단.
  - `AuditLog` 스키마 구축 및 주요 관리자 작업 실시간 타임라인 기록.
- **검증**: `verify_space_settings.mjs` E2E 자동화 검증 완료.

### 3. Issue #27 — 고용량 파일 및 이미지 첨부 업로드 (`FEAT-RICHMEDIA`)
- **내용**:
  - `/api/upload` API 확장하여 20MB 파일/이미지 업로드 지원.
  - DM 및 채널 입력란에 클립(Paperclip) 파일 선택, 이미지 커스텀 미리보기 및 일반 파일 다운로드 카드 렌더링.
- **검증**: 파일 업로드 API & UI 카드 렌더링 검증 완료.

### 4. Issue #63 — 실시간 스페이스/메시지 삭제 동기화 & UI 잘림 개선 (`FEAT-REALTIME_SYNC_ENHANCEMENT`)
- **내용**:
  - 메시지 삭제 시 `_type: "DELETE"` 실시간 SSE 이벤트를 브로드캐스트하여 상대방 화면에서 즉시 소멸되도록 처리.
  - 스페이스 이미지/이름 수정 시 `space:updated` SSE 이벤트를 전원에게 발송하여 실시간 반영.
  - 멤버 관리 탭 `+ 역할 선택` 클릭 시 absolute 팝오버 대신 **인라인 펼침 패널(Inline Expandable Panel)**로 개편하여 UI 잘림 현상 원천 해결.
- **검증**: `verify_realtime_and_ui_fixes.mjs` E2E 자동화 검증 완료 (Exit Code: 0).
