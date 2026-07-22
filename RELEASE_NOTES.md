# Omni Platform v1.1.0

Omni Platform의 두 번째 공식 프로덕션 릴리즈입니다.

> **배포 주소**: [https://omni.steady2vivid.kro.kr](https://omni.steady2vivid.kro.kr)

---

## 📋 주요 업데이트 (Key Highlights)

### 1. 🛡️ 디스코드 스타일 스페이스 독립 설정 & RBAC 커스텀 역할
* **독립 스페이스 설정 모달 (`SpaceSettingsModal`)**: 스페이스 헤더 ⚙️ 설정 버튼 연동.
* **디스코드 표준 6대 세부 권한 토글**: `MANAGE_SPACE`, `MANAGE_ROLES`, `MANAGE_CHANNELS`, `KICK_MEMBERS`, `MANAGE_MESSAGES`, `SPEAK_VOICE` 및 역할 색상 지정(Color Picker) 지원.
* **비공개 채널 🔒 락 (Channel Permissions)**: 특정 유저 및 특정 커스텀 역할 전용 채널 오버라이드 설정.
* **스페이스 감사 로그 (Audit Logs)**: 메시지 삭제(삭제된 텍스트 본문 포함), 역할 수정, 스페이스 설정 변경 등의 활동을 타임라인으로 기록 및 조회.

### 2. 📩 1:1 DM 안읽음 뱃지 & 실시간 읽음 동기화
* **빨간 원 뱃지 (`bg-danger`)**: 안 읽은 DM 수량이 친구 목록 및 상단 탭에 실시간 표시.
* **자동 읽음 처리 (`lastReadAt`)**: 대화방 진입 시 읽음 처리 및 뱃지 즉시 소멸.

### 3. 📎 20MB 고용량 및 일반 파일 첨부 (Rich Attachments)
* **모든 형식의 파일 첨부**: 이미지뿐만 아니라 PDF, ZIP, DOCX, TXT 등 20MB 이하 파일 업로드 지원.
* **상단 미리보기 배너 & 다운로드 카드**: 채팅창 입력 상단 배너 표시 및 대화창 내 클릭 한 번으로 다운로드 가능한 카드 렌더링.

### 4. ⚡ 실시간 브로드캐스팅 & 한글 IME 중복 전송 방지
* **메시지 즉시 삭제 (`_type: DELETE`)**: 메시지 삭제 시 상대방 화면에서 즉시 실시간 소멸.
* **한글 IME(조합) 중복 전송 차단**: 한글 입력 중 Enter 키 중복 이벤트 차단 및 전송 진행 락 구현.

---

## 🛠️ CI/CD & 인프라

* **GitHub Actions 자동 배포**: Release 발행 시 Caddy Reverse Proxy 및 PM2 무중단 프로세스 자동 갱신
* **프로덕션 환경**: Node.js v22 runtime, SQLite (`prisma/dev.db`) DB 스키마 동기화

---

> [!NOTE]
> 이슈 보고 및 기능 제안은 [GitHub Repository](https://github.com/junans0boi/omni-platform)를 이용해 주세요.
