# SESSION HANDOFF & IMMEDIATE RUNBOOK

> **프로젝트 위치**: `/home/junzzang/workspace/omni-platform`
> **최종 업데이트**: 2026-07-20 KST

---

## 1. 현재 진행 상황 (Current Status)

1. **Phase 1: 기초 뼈대 및 실시간 텍스트 채팅 완료**:
   - Supabase RLS 정책 및 프로필 자동 동기화 트리거, 스페이스 기본 템플릿(카테고리/일반채널/음성채널) 자동생성 트리거 구축 완료.
   - Zustand 전역 상태 및 실시간 메시징(Supabase Realtime) & Presence 동기화 훅 개발 완료.
   - Glassmorphism 다크 테마 로그인/회원가입/대시보드 UI 구현 완료.
2. **Phase 2: 실시간 음성/화상 및 스테이지 채널 완료**:
   - LiveKit dynamic token 생성 API Route 및 상위 스페이스 가입 여부, 스테이지 권한(ADMIN/OWNER 발언) 검증 로직 구현 완료.
   - WebRTC `livekit-client` SDK 및 Zustand 연동을 통한 오디오/비디오 트랙 연결 및 제어 구현 완료.
   - 채팅창 상단의 접이식(Collapsible) 화상 그리드 UI 개발 및 채널 전환 연결 로직 연동 완료.
3. **이슈 트래커 등록 및 100% 완료**:
   - GitHub CLI(`gh`) 연동을 조지고 로드맵(Wayfinder Map #1)을 포함한 총 14개의 이슈를 생성 후 성공적으로 완료(Closed) 처리함.

---

## 2. 다음 바로 진행할 작업 (Next Action Items)

- [ ] **로컬 설치 및 구동 확인 (사용자 환경)**:
  - 샌드박스의 `log` 경로 차단 및 tar 압축 해제 환경 제약으로 인해 빌드가 실패했으므로, 사용자 로컬 PC에서 아래 명령어를 실행하여 최종 빌드 및 검증 진행:
    ```bash
    npm install
    npm run build
    npm run dev
    ```
- [ ] **Phase 3: 파일 공유 및 미디어 업로드 (Supabase Storage) & 데스크톱 패키징(Tauri)**:
  - Supabase Storage 연동을 통한 아바타 이미지 수정 및 채팅 내 파일/이미지 업로드 기능 추가.
  - 데스크톱 경량 실행 파일 (.exe, .dmg) 빌드를 위한 Tauri 환경 보일러플레이트 추가 및 설정.
