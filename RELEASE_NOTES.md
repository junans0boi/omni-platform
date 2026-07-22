# Omni Platform v1.0.0

Omni Platform의 첫 번째 공식 프로덕션 릴리즈입니다.

> **배포 주소**: [https://omni.steady2vivid.kro.kr](https://omni.steady2vivid.kro.kr)

---

## 📋 주요 업데이트

### 1. Web Audio 사운드 엔진 & 마이크 테스트
* **기능별 효과음 분리**: 채널 입/퇴장, 음소거/해제, 화면 공유, 멘션 수신 시 각각 구별되는 오디오 피드백 제공
* **보이스 피드백 (루프백)**: 마이크 테스트 시 출력 장치로 입력 음성을 실시간 수신하여 마이크 상태 점검
* **입력 프로필 선택**: 노이즈 캔슬링(음성 격리), 스튜디오 원음, 사용자 지정 DSP 지원

### 2. 채널 운영 모드 (Channel Operating Modes)
* **일반 모드 (`GENERAL`)**: 자유 음성 및 채팅 소통
* **회의 모드 (`MEETING`)**: 발언 대기열 및 체계적 미팅 진행
* **강의 모드 (`LECTURE`)**: 수강자 발언권 권한 제어

### 3. 설정 영속화 & 계정 관리
* **설정 영속화**: 알림 설정, 소리 옵션, 미디어 입력/출력 장치, 시간 포맷 설정의 DB(`UserPreference`) 자동 연동
* **계정 관리**: 사용자명, 이메일, 전화번호 인라인 수정 및 비밀번호 변경 API 연동
* **UI 개선**: 설정 모달 상단 고정 닫기 버튼 및 `Esc` 키 단축키 지원

### 4. 알림 센터 & DM
* **알림 드로어**: 우측 슬라이드 방식의 알림 관리 인터페이스
* **DM 패널**: 친구 목록 및 1:1 실시간 메시징 최적화

---

## 🛠️ CI/CD & 인프라

* **GitHub Actions 자동 배포**: Release 발행 시 Caddy Reverse Proxy 및 PM2 무중단 프로세스 자동 갱신
* **프로덕션 환경**: Node.js v22 runtime, SQLite (`prisma/dev.db`) DB 스키마 동기화

---

> [!NOTE]
> 이슈 보고 및 기능 제안은 [GitHub Repository](https://github.com/junans0boi/omni-platform)를 이용해 주세요.
