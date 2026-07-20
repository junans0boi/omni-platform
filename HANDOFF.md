# SESSION HANDOFF & IMMEDIATE RUNBOOK

> **프로젝트 위치**: `/home/junzzang/workspace/omni-platform`
> **최종 업데이트**: 2026-07-20 KST

---

## 1. 현재 진행 상황 (Current Status)

### ✅ 완료된 작업

1. **Phase 1: MVP Core & 실시간 텍스트 채팅**
   - Prisma ORM + SQLite 기반 로컬 데이터베이스 완전 구축 및 검증 완료.
   - 로컬 세션 쿠키 기반 회원가입/로그인/로그아웃 API 완성.
   - 스페이스 생성 시 기본 카테고리 + 텍스트/음성 채널 자동 생성 트리거 완성.
   - 초대 코드 기반 스페이스 참여 기능 완성.
   - **Server-Sent Events(SSE) 기반 실시간 채팅 완성 및 맥북 로컬 환경에서 동작 검증 완료.**
   - ReadableStream + global messageBroker를 활용한 HMR 재로드 내성 SSE 실시간 스트림 구축.

2. **Phase 2: LiveKit 음성/화상 통화**
   - LiveKit 토큰 생성 API Route 구현 완료 (STAGE 채널 권한 분기 포함).
   - `livekit-client` 연동 VoiceGrid 컴포넌트 및 Zustand 음성 상태 관리 구현 완료.
   - 맥북 로컬 환경에서 LiveKit 설정 없이는 미작동 (`.env.local` 설정 필요).

3. **기술 전환: Supabase → 완전 로컬 SQLite + Prisma**
   - 외부 클라우드 의존성 제거 완료. Rate Limit 이슈 없음.
   - 모든 변경 사항은 GitHub `main` 브랜치에 커밋/푸시 완료.

---

## 2. 기술 스택 (Current Tech Stack)

| 영역 | 기술 |
|------|------|
| Framework | Next.js 15 (App Router) |
| Database | SQLite (Prisma ORM) |
| Auth | Cookie Session (httpOnly, local) |
| Real-time Chat | Server-Sent Events (SSE) |
| Voice/Video | LiveKit WebRTC (Client SDK) |
| State | Zustand |
| Styling | TailwindCSS v4 |

---

## 3. 다음 단계 (Next Phase)

### Phase 3: 프로필 편집 + 파일 & 이미지 업로드 + UX 개선
- [ ] 아바타 이미지 업로드 (로컬 파일시스템 저장 or Base64 인라인)
- [ ] 프로필 편집 페이지 (`/dashboard/settings`) 구현
- [ ] 채팅에 이미지/파일 업로드 기능 추가
- [ ] 채널 생성/삭제/이름변경 기능 (Admin/Owner 권한)
- [ ] 카테고리 생성/삭제 기능 (Admin/Owner 권한)

### Phase 4: 멤버 관리 + 권한 세분화
- [ ] 멤버 역할 변경 (MEMBER → ADMIN)
- [ ] 멤버 강퇴(Kick) 기능
- [ ] 스페이스 탈퇴 기능

### Phase 5: 배포 (Oracle Cloud Always Free)
- [ ] Oracle Cloud VPS에 Next.js 서비스 배포
- [ ] LiveKit SFU 서버 Self-Host 구성 (Oracle Free VM)
- [ ] 도메인 연결 및 HTTPS 설정

---

## 4. 로컬 환경 구동 방법

```bash
# 1. 저장소 클론 (또는 git pull)
git clone https://github.com/junans0boi/omni-platform.git
cd omni-platform

# 2. 패키지 설치
npm install

# 3. SQLite DB 초기화 (최초 1회)
npx prisma db push

# 4. 개발 서버 실행
npm run dev
# → http://localhost:3000 에서 바로 동작
```
