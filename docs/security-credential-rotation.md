# GitHub·SSH·LiveKit 자격증명 교체 가이드

이 문서는 서버 침해 가능성이 있는 상황에서 **신뢰할 수 있는 로컬 Mac**으로 자격증명을 옮기는 절차다. 기본 순서는 `새 자격증명 생성 → 모든 사용처 교체 → 검증 → 구 자격증명 폐기`다. 단, 공격자가 현재도 접근 중이라고 의심되면 서비스 연속성보다 **즉시 폐기**를 우선한다. GitHub도 계정 침해 시 관련 자격증명을 한꺼번에 폐기할 수 있다고 안내하며, 이 작업은 자동화 중단을 일으킬 수 있다고 경고한다([GitHub: Revoking your credentials](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/revoking-your-credentials)).

비밀값은 명령행 인자, 셸 기록, 채팅, 이슈, 커밋에 붙여 넣지 않는다. 이 저장소의 `.gitignore`는 `.env*`를 제외하고 있으므로 로컬 비밀값은 `.env.local`에만 둔다. LiveKit도 로컬 비밀값을 `.env.local`에 두고 환경 파일을 버전 관리에서 제외하도록 안내한다([LiveKit: Secrets management](https://docs.livekit.io/deploy/agents/secrets/)).

## 0. 먼저 할 일: 깨끗한 기기와 계정 확보

1. 침해된 서버가 아닌 로컬 Mac에서 진행한다.
2. GitHub 이메일 계정과 비밀번호 관리자도 침해 가능성을 점검하고, 재사용하지 않은 새 비밀번호로 바꾼다.
3. GitHub에서 `Settings → Password and authentication`으로 이동해 비밀번호를 바꾸고 2FA를 활성화하거나 등록된 2FA 수단을 점검한다([GitHub: Updating access credentials](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/updating-your-github-access-credentials), [GitHub: Configuring 2FA](https://docs.github.com/en/authentication/securing-your-account-with-two-factor-authentication-2fa/configuring-two-factor-authentication)).
   공격자가 추가했을 수 있는 passkey·보안 키·인증 앱을 제거하고, 새 recovery codes를 발급해 비밀번호 관리자에 보관한다. 새 recovery codes를 만들면 이전 코드는 모두 무효화된다([GitHub: Configuring 2FA recovery methods](https://docs.github.com/en/authentication/securing-your-account-with-two-factor-authentication-2fa/configuring-two-factor-authentication-recovery-methods)).
4. `Settings → Sessions`에서 모르는 웹·모바일 세션을 모두 `Revoke`한다. GitHub는 이 화면에서 로그인 기기 확인과 세션 폐기를 지원한다([GitHub: Viewing and managing sessions](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/viewing-and-managing-your-sessions)).
5. `Settings → Security log`에서 알 수 없는 로그인, PAT, SSH 키, OAuth/GitHub App 관련 이벤트를 확인하고 필요하면 JSON/CSV로 보존한다([GitHub: Reviewing your security log](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/reviewing-your-security-log)).

## 1. GitHub PAT 교체

PAT를 사용하지 않았다면 새로 만들 필요가 없다. 로컬 Git 작업은 뒤의 SSH 방식 또는 GitHub CLI의 웹 로그인을 쓰는 편이 낫다. GitHub도 명령줄 인증에는 GitHub CLI나 Git Credential Manager를 고려하고, PAT가 필요하면 가능한 한 범위가 좁은 fine-grained PAT를 사용하라고 권장한다([GitHub: Managing personal access tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)).

### 1.1 새 PAT 만들기

1. GitHub `Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token`으로 이동한다.
2. 만료일을 지정한다.
3. `Repository access`는 이 저장소만 선택한다.
4. `Permissions`는 실제 작업에 필요한 최소 권한만 준다. 일반적인 clone/pull은 `Contents: Read-only`, push가 필요하면 `Contents: Read and write`가 필요하다. 이 선택 원칙과 생성 절차는 GitHub 공식 문서에 명시돼 있다([GitHub: Creating a fine-grained PAT](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token)).
5. 생성 직후 비밀번호 관리자에 저장한다. 저장하지 못했다면 값을 복구하려 하지 말고 다시 생성한다.

### 1.2 새 인증 검증

PAT를 터미널 인자에 직접 쓰지 않는다. HTTPS가 꼭 필요하지 않다면 아래처럼 GitHub CLI의 브라우저 인증을 새로 구성한다([GitHub CLI: `gh auth login`](https://cli.github.com/manual/gh_auth_login)).

```bash
gh auth logout --hostname github.com
gh auth login --hostname github.com --web
gh auth status --hostname github.com
```

저장소 읽기 권한은 비파괴 명령으로 확인한다.

```bash
git ls-remote origin HEAD
```

### 1.3 구 PAT 폐기

새 인증과 관련 자동화가 정상임을 확인한 뒤 `Settings → Developer settings → Personal access tokens`에서 기존 fine-grained/classic 토큰을 `Delete`한다. GitHub의 삭제 절차도 같은 화면을 사용한다([GitHub: Deleting a PAT](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#deleting-a-personal-access-token)). 서버에 저장돼 있던 PAT는 노출된 것으로 간주해 사용 여부와 관계없이 폐기한다.

## 2. GitHub 웹 세션·앱 권한 정리

비밀번호만 바꾸고 끝내지 않는다.

1. `Settings → Sessions`에서 현재 로컬 세션을 제외한 서버·미확인 세션을 폐기한다([GitHub: Viewing and managing sessions](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/viewing-and-managing-your-sessions)).
2. `Settings → Applications`에서 모르는 `Authorized OAuth Apps`, `Authorized GitHub Apps`를 폐기한다. GitHub는 접근 토큰 갱신 시 앱 권한도 검토·삭제하라고 안내한다([GitHub: Updating access credentials](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/updating-your-github-access-credentials#updating-your-access-tokens)).
3. `Settings → SSH and GPG keys`와 각 저장소 `Settings → Deploy keys`를 모두 점검한다. 모르는 키가 있으면 새 키 검증을 기다리지 말고 즉시 삭제한다([GitHub: Reviewing SSH keys](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/reviewing-your-ssh-keys), [GitHub: Managing deploy keys](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys)).

## 3. GitHub용 SSH 키 교체

침해된 서버에 private key가 있었다면 그 키는 복사해 오지 않는다. 로컬에서 완전히 새 키 쌍을 만든다. 기존 파일을 덮어쓰지 않도록 새 파일명을 쓴다.

### 3.1 새 키 생성·등록

GitHub는 Ed25519 키와 강한 passphrase 사용을 안내한다([GitHub: Generating a new SSH key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent)). 아래 명령에서 주석용 이메일과 파일명은 본인 환경에 맞게 정한다.

```bash
ssh-keygen -t ed25519 -C "본인의 GitHub 이메일" -f ~/.ssh/새_GitHub_키_파일명
ssh-add --apple-use-keychain ~/.ssh/새_GitHub_키_파일명
```

passphrase 입력 프롬프트를 비워 두지 않는다. 공개키만 GitHub에 등록한다. 웹에서 `Settings → SSH and GPG keys → New SSH key`를 사용하거나, 이미 안전하게 인증된 GitHub CLI가 있다면 다음 명령을 사용한다([GitHub: Adding a new SSH key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/adding-a-new-ssh-key-to-your-github-account)).

```bash
gh ssh-key add ~/.ssh/새_GitHub_키_파일명.pub --type authentication --title "로컬 Mac"
```

여러 GitHub 키가 있다면 `~/.ssh/config`의 `Host github.com` 항목에 `IdentityFile`을 새 키로 지정하고 `IdentitiesOnly yes`를 추가한다. 설정 파일에는 private key **경로만** 기록하며 키 내용은 넣지 않는다.

### 3.2 새 키 검증

```bash
ssh -T -i ~/.ssh/새_GitHub_키_파일명 -o IdentitiesOnly=yes git@github.com
GIT_SSH_COMMAND='ssh -i ~/.ssh/새_GitHub_키_파일명 -o IdentitiesOnly=yes' git ls-remote origin HEAD
```

첫 연결에서 호스트 지문을 묻는다면 화면의 지문을 GitHub 공식 지문과 대조한 뒤 승인한다. 성공 시 GitHub 사용자명이 포함된 인증 성공 메시지가 나온다([GitHub: Testing your SSH connection](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/testing-your-ssh-connection), [GitHub SSH key fingerprints](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints)).

### 3.3 구 키 폐기

1. GitHub `Settings → SSH and GPG keys`에서 침해 서버 또는 구 기기 키를 `Delete`한다. GitHub는 로컬의 SHA-256 지문과 계정 키를 대조하고, 미확인·구 키를 삭제하도록 안내한다([GitHub: Reviewing SSH keys](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/reviewing-your-ssh-keys)).
2. 저장소별 `Deploy keys`에도 같은 공개키가 없는지 확인해 삭제한다.
3. 로컬 agent에 구 키가 올라가 있다면 제거한다.

```bash
ssh-add -l -E sha256
ssh-add -d ~/.ssh/구_키_파일명
```

구 private key 파일은 GitHub에서 폐기됐음을 확인한 뒤 안전하게 제거한다. 침해 서버는 자격증명 교체만으로 신뢰 상태가 회복되지 않으므로 재사용하지 말고 깨끗한 이미지로 재구축한다.

## 4. GitHub Actions secrets 교체

현재 로컬 저장소에는 `.github/workflows`가 없지만, GitHub 저장소·환경·조직 수준에 secret이 남아 있을 수 있다. GitHub Actions secret은 저장소, environment, organization 수준에 각각 존재하며 낮은 수준의 동일 이름 secret이 우선한다([GitHub: Secrets reference](https://docs.github.com/en/actions/reference/security/secrets)).

먼저 값이 아니라 **이름과 범위**만 조사한다.

```bash
gh secret list --app actions
gh secret list --app actions --env 배포_환경명
gh secret list --app actions --org 조직명
```

LiveKit 새 키를 만든 후 같은 secret 이름을 대화형 입력으로 덮어쓴다. `--body` 인자에 값을 넣으면 셸 기록이나 프로세스 목록에 노출될 수 있으므로 사용하지 않는다. `gh secret set`은 `--body`를 생략하면 표준 입력으로 값을 받고, 전송 전 로컬에서 암호화한다([GitHub CLI: `gh secret set`](https://cli.github.com/manual/gh_secret_set)).

```bash
gh secret set LIVEKIT_API_KEY --app actions
gh secret set LIVEKIT_API_SECRET --app actions
```

environment 또는 organization secret이었다면 원래와 동일한 범위에 `--env` 또는 `--org`를 사용한다. 워크플로를 실행해 성공을 확인한 뒤에만 LiveKit 구 키를 폐기한다. GitHub는 로그에 비밀값이 평문으로 노출됐다면 로그를 삭제하고 해당 secret을 교체하라고 안내한다([GitHub Actions: Secure use reference](https://docs.github.com/en/actions/reference/security/secure-use)).

## 5. LiveKit Cloud API key/secret 교체

이 저장소는 서버에서 `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`을 읽고 클라이언트 연결 URL로 `NEXT_PUBLIC_LIVEKIT_URL`을 사용한다. API secret은 브라우저에 노출되는 `NEXT_PUBLIC_*` 변수에 절대 넣지 않는다. LiveKit도 API 자격증명 환경변수 이름을 `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL`로 정의한다([LiveKit: Server startup authentication](https://docs.livekit.io/agents/server/startup-modes/#authentication)).

### 5.1 새 LiveKit 키 생성

1. [LiveKit Cloud](https://cloud.livekit.io/)에 로그인해 대상 프로젝트를 선택한다.
2. 프로젝트 `Settings → Keys`에서 `Create key`로 새 API key/secret을 생성한다. LiveKit 공식 문서는 Cloud 프로젝트의 API keys 화면에서 새 키를 생성하는 절차를 설명한다([LiveKit: Connectors API authentication](https://docs.livekit.io/reference/telephony/connectors-api/#authentication)).
3. secret은 생성 시점에 비밀번호 관리자로 옮긴다. 저장소, 이슈, 채팅에는 기록하지 않는다.
4. webhook을 사용 중이면 `Settings → Webhooks`의 signing key도 새 API key로 바꿀 계획을 세운다. LiveKit Cloud webhook은 프로젝트 API key를 서명 키로 선택한다([LiveKit: Webhooks & events](https://docs.livekit.io/intro/basics/rooms-participants-tracks/webhooks-events/#configuration)).

LiveKit CLI만 새로 연결할 목적이라면 다음 명령이 브라우저 인증 후 CLI 전용 API key를 자동 생성한다. 이 키는 애플리케이션용 장기 자격증명과 분리한다([LiveKit CLI: Project commands](https://docs.livekit.io/reference/developer-tools/livekit-cli/projects/#livekit-cloud-projects)).

```bash
lk cloud auth
```

### 5.2 모든 사용처 교체

로컬 `.env.local`을 편집해 기존 `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`만 새 값으로 바꾼다. 프로젝트 URL이 변하지 않았다면 `NEXT_PUBLIC_LIVEKIT_URL`은 그대로 둔다.

```bash
chmod 600 .env.local
${EDITOR:-vi} .env.local
```

그다음 실제로 사용하는 곳을 모두 갱신한다.

- GitHub Actions: 앞 절의 repository/environment/organization secret
- 배포 플랫폼의 environment variables
- 별도 token server, worker, cron, webhook receiver
- 로컬 LiveKit CLI 프로젝트 설정

LiveKit는 개발·스테이징·운영을 별도 프로젝트로 분리해 각 환경에 고유 URL/key/secret을 사용하도록 권장한다([LiveKit: Project environments](https://docs.livekit.io/deploy/custom/deployments/#environment-variables)).

### 5.3 새 키 검증

앱을 재시작한 뒤 다음을 확인한다.

```bash
npm run dev
```

1. 로그인한다.
2. 음성 채널 참가를 시도한다.
3. `/api/livekit/token` 요청이 성공하고 브라우저가 LiveKit 방에 연결되는지 확인한다.
4. 배포 환경도 재배포한 뒤 같은 검증을 한다.

CLI 전용 키를 검증할 때는 secret을 출력하는 `lk project list --json`을 쓰지 않는다. 일반 목록과 실제 API 호출을 사용한다. 공식 CLI 문서상 `--json` 출력에는 API secret이 포함된다([LiveKit CLI: Project list](https://docs.livekit.io/reference/developer-tools/livekit-cli/projects/#list)).

```bash
lk project list
lk room list
```

### 5.4 구 LiveKit 키 폐기

로컬과 배포 환경에서 새 키가 정상 작동함을 확인한 뒤 LiveKit Cloud 프로젝트 `Settings → Keys`에서 구 API key를 선택하고 화면에 제공되는 폐기 동작을 수행한다. 공개 공식 문서는 일반 Cloud API key의 생성은 설명하지만, 현재 구 키 폐기 버튼의 정확한 이름이나 일반 키용 CLI 명령은 명시하지 않으므로 로그인된 공식 UI의 안내를 따른다. webhook signing key가 구 키를 가리키지 않는지 먼저 확인한다. 그 후 앱을 한 번 더 재시작하고 음성 채널 참가를 재검증한다.

`lk cloud auth`로 자동 발급된 **CLI 전용 키**를 폐기하는 경우에는 다음 명령을 사용한다. LiveKit 공식 문서에 따르면 이 명령은 해당 CLI 인증으로 발급된 API key를 폐기하고 로컬 프로젝트 설정에서도 제거한다([LiveKit CLI: Revoke](https://docs.livekit.io/reference/developer-tools/livekit-cli/projects/#revoke)).

```bash
lk cloud auth --revoke --project 프로젝트명
```

`lk project remove`는 로컬 설정만 지우며 LiveKit Cloud의 키를 폐기하지 않으므로 침해 대응에는 충분하지 않다([LiveKit CLI: Remove](https://docs.livekit.io/reference/developer-tools/livekit-cli/projects/#remove)).

## 6. 최종 확인표

- [ ] GitHub 비밀번호 변경, 2FA·복구 수단 확인
- [ ] 미확인 GitHub 웹·모바일 세션 폐기
- [ ] Security log와 OAuth/GitHub Apps 검토
- [ ] 구 PAT 모두 삭제
- [ ] 로컬에서 새 SSH 키 생성·등록·`ssh -T` 검증
- [ ] GitHub 계정 SSH keys와 저장소 deploy keys에서 서버 키 삭제
- [ ] LiveKit 새 key/secret을 `.env.local`과 모든 배포 secret에 반영
- [ ] GitHub Actions의 세 범위(repository/environment/organization) 확인
- [ ] 로컬·배포 환경에서 음성 채널 연결 검증
- [ ] webhook signing key 교체 확인
- [ ] LiveKit 구 키 삭제/revoke 후 재검증
- [ ] 침해 서버를 폐기하거나 깨끗한 이미지로 재구축
