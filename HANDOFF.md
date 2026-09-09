# IWTC 개발 인수인계

마지막 확인일: 2026-09-09

이 문서는 다른 컴퓨터나 새 Cursor 환경에서 IWTC 개발을 바로 이어가기 위한 현재 상태와 실행 절차를 정리한다.

## 1. 프로젝트 원칙

- 백엔드는 Spring Boot에서 NestJS로 새로 구현한다.
- 데이터베이스는 PostgreSQL 18을 사용한다.
- 기존 운영 DB, 기존 사용자 데이터, 기존 DB 계정과 비밀번호는 가져오지 않는다.
- 새 Prisma migration과 새 데이터로 시작한다.
- 기존 Spring 저장소는 API 동작과 비즈니스 규칙을 확인하는 참고 자료로만 사용한다.
- 로컬 개발 비밀번호와 운영 비밀번호를 분리한다. 실제 운영 비밀번호는 Git에 올리지 않고 Kubernetes Secret으로 관리한다.

## 2. 저장소와 기준 브랜치

| 용도               | 저장소                                                 | 기준 브랜치                 | 기능 기준 커밋 |
| ------------------ | ------------------------------------------------------ | --------------------------- | -------------- |
| 신규 백엔드        | `https://github.com/dongmin3891/iwtc-backend-nest.git` | `main`                      | `4317c81`      |
| 프론트엔드         | `https://github.com/dongmin3891/iwtc-frontend-new.git` | `refactor/full-project`     | `f9c01bb`      |
| 기존 Spring 참고용 | `https://github.com/dongmin3891/iwtc-backend-new.git`  | `codex/nest-migration-plan` | `3703d2d`      |

신규 개발 코드는 `iwtc-backend-nest`에 작성한다. `iwtc-backend-new`를 신규 서버로 배포하지 않는다.

게임 결과·랭킹·미디어·회원·비회원 댓글·회원 인증·회원 댓글 삭제·내 월드컵 목록·상세·생성·관리용 후보 목록 구현과 프론트엔드의 게임 완료·댓글 작성·삭제·로그인·후보 응답 매핑 수정은 각 원격 기준 브랜치에 push되어 있다. `iwtc.code-workspace`는 신규 백엔드 작업 트리에만 있는 로컬 편의 파일이며 커밋하지 않았다.

## 3. 새 환경에 내려받기

세 저장소를 같은 상위 폴더에 두면 비교와 실행이 편하다.

```bash
mkdir iwtc
cd iwtc

git clone https://github.com/dongmin3891/iwtc-backend-nest.git

git clone https://github.com/dongmin3891/iwtc-frontend-new.git
cd iwtc-frontend-new
git switch refactor/full-project
cd ..

git clone https://github.com/dongmin3891/iwtc-backend-new.git
cd iwtc-backend-new
git switch codex/nest-migration-plan
cd ..
```

기존 Spring 코드가 당장 필요하지 않으면 세 번째 저장소는 나중에 받아도 된다.

## 4. Cursor 워크스페이스 구성

1. Cursor에서 `File > Add Folder to Workspace...`를 선택한다.
2. `iwtc-frontend-new`와 `iwtc-backend-nest`를 추가한다.
3. 기존 구현을 비교할 때만 `iwtc-backend-new`도 추가한다.
4. `File > Save Workspace As...`로 `iwtc.code-workspace` 같은 이름으로 저장한다.

워크스페이스 파일에는 컴퓨터별 절대 경로가 들어갈 수 있으므로 저장소에 반드시 커밋할 필요는 없다.

## 5. 신규 백엔드 실행

### 요구 사항

- Node.js 24.19 이상
- npm
- Docker Desktop

`.nvmrc`가 있으므로 nvm을 사용하면 프로젝트 버전을 바로 선택할 수 있다.

```bash
cd iwtc-backend-nest
nvm install
nvm use
npm ci
cp .env.example .env
docker compose up -d postgres
npm run db:migrate
npm run db:seed
npm run start:dev
```

백엔드 주소는 `http://localhost:3001`이다.

- Swagger: `http://localhost:3001/docs`
- 기본 상태 확인: `http://localhost:3001/health/live`
- DB 연결 상태 확인: `http://localhost:3001/health/ready`

`npm run db:migrate`와 `npm run db:seed`는 Prisma Client를 먼저 생성하도록 설정되어 있다. 따라서 별도로 `prisma generate`를 실행하지 않아도 된다.

### 환경 변수 주의 사항

- 현재 `.env.example`의 비밀번호는 로컬 개발 전용 예시값이며 운영 비밀번호가 아니다.
- 다른 환경에서는 현재 컴퓨터의 `.env`를 복사하지 말고 `.env.example`로 새 `.env`를 만든다.
- 정적 미디어 공개 주소는 `MEDIA_PUBLIC_BASE_URL`로 설정한다. 운영 환경에서는 HTTPS URL만 허용한다.
- `JWT_ACCESS_SECRET`과 `JWT_REFRESH_SECRET`은 서로 다른 32자 이상의 값이어야 한다. `.env.example` 값은 로컬 전용이므로 운영에서는 각각 새로 생성한다.
- access token 기본 수명은 15분, refresh token 기본 수명은 30일이다. 변경할 때는 `JWT_ACCESS_TTL_SECONDS`, `JWT_REFRESH_TTL_SECONDS`를 사용한다.
- 운영 환경에서는 충분히 긴 새 비밀번호를 만들고 Kubernetes Secret으로 주입한다.
- PostgreSQL 볼륨을 삭제하면 로컬 데이터가 사라지므로 의도적인 초기화가 아니면 볼륨 삭제 명령을 사용하지 않는다.

## 6. 프론트엔드 실행

```bash
cd iwtc-frontend-new
git switch refactor/full-project
npm ci
npm run dev
```

프론트엔드 주소는 `http://localhost:3000`이다. 현재 `.env.development`에는 두 API 주소가 모두 신규 NestJS 서버를 바라보도록 설정되어 있다.

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/
NEXT_PUBLIC_API_MEMBER_URL=http://localhost:3001/
```

백엔드를 먼저 실행한 뒤 프론트엔드를 실행한다.

운영에서는 refresh cookie가 `Secure`로 설정되므로 회원 API도 반드시 HTTPS여야 한다. `api.ddongmy.com`처럼 같은 사이트의 HTTPS 호스트를 사용하거나 Traefik에서 `/api`를 신규 백엔드로 라우팅한다. 현재 프론트 `.env.production`의 기존 HTTP IP 주소는 신규 백엔드 배포 전에 교체해야 한다.

## 7. 현재 구현 상태

신규 NestJS 백엔드에 다음 기능이 구현되어 있다.

- NestJS 12, TypeScript 6, Node.js 24
- Prisma 7.10과 PostgreSQL 18
- 최초 Prisma schema와 migration
- 재실행 가능한 개발용 seed
- 공통 성공·오류 응답 형식
- 환경 변수 검증과 CORS 설정
- Swagger 문서
- liveness/readiness 상태 확인
- 공개 월드컵 목록 조회
- 플레이 가능한 라운드 조회
- 게임 대진 후보 조회와 탈락 후보 제외
- 게임 결과 이력과 1~4위 저장
- `playId` 기반 중복 제출 방지
- 누적 점수 기반 게임 결과 랭킹 조회
- 미디어 메타데이터 저장 모델과 공개 URL 조회
- 회원·비회원 댓글 작성과 최신순 댓글 목록 조회
- access token으로 확인한 댓글 작성자 회원 ID·닉네임 연결
- 토큰이 없을 때만 비회원 작성을 허용하는 선택적 댓글 인증
- 작성 회원 본인만 가능한 댓글 소프트 삭제와 동시 중복 삭제 방지
- 댓글 본문·닉네임 검증과 공개 후보 소속 확인
- 로그인 회원의 월드컵 목록·상세 조회와 생성
- 월드컵 생성 시 소유자 연결과 다른 회원 월드컵 접근 차단
- 소유자 전용 관리 후보 목록과 누적 점수·공동순위 조회
- 유튜브 후보 일괄 생성 요청 DTO와 입력 검증
- 소유자 전용 유튜브 후보 일괄 내부 저장 서비스
- 같은 월드컵 후보 생성의 `sortOrder` 동시성 충돌 방지
- 소유자 전용 후보 일괄 생성 POST 컨트롤러
- 새 PostgreSQL 회원가입과 Argon2id 비밀번호 해시
- 로그인, 내 회원 정보 조회, 세션 단위 로그아웃
- HttpOnly refresh token 쿠키와 일회성 rotation
- refresh token family 재사용 감지와 전체 폐기

현재 API:

| Method | 경로                                                          | 상태 |
| ------ | ------------------------------------------------------------- | ---- |
| GET    | `/health/live`                                                | 완료 |
| GET    | `/health/ready`                                               | 완료 |
| GET    | `/api/world-cups`                                             | 완료 |
| GET    | `/api/world-cups/{worldCupId}/available-rounds`               | 완료 |
| GET    | `/api/world-cups/{worldCupId}/contents`                       | 완료 |
| POST   | `/api/world-cups/{worldCupId}/clear`                          | 완료 |
| GET    | `/api/world-cups/{worldCupId}/game-result-contents`           | 완료 |
| GET    | `/api/media-files/{mediaFileId}`                              | 완료 |
| GET    | `/api/world-cups/{worldCupId}/comments`                       | 완료 |
| POST   | `/api/world-cups/{worldCupId}/contents/{contentsId}/comments` | 완료 |
| DELETE | `/api/comments/{commentId}`                                   | 완료 |
| POST   | `/api/members/sign-up`                                        | 완료 |
| POST   | `/api/members/sign-in`                                        | 완료 |
| GET    | `/api/members/me/summary`                                     | 완료 |
| POST   | `/api/new-access-token`                                       | 완료 |
| POST   | `/api/members/sign-out`                                       | 완료 |
| GET    | `/api/me/game-manage/world-cups`                              | 완료 |
| GET    | `/api/me/game-manage/world-cups/{worldCupId}`                 | 완료 |
| POST   | `/api/me/game-manage/world-cups`                              | 완료 |
| GET    | `/api/me/game-contents-manage/world-cups/{worldCupId}/manage-contents` | 완료 |
| POST   | `/api/me/game-contents-manage/world-cups/{worldCupId}/contents` | 완료 |

개발용 seed는 공개 월드컵 1개와 `후보 A`부터 `후보 D`까지 총 4개 후보를 만든다. 후보 ID는 실행 환경에 따라 달라질 수 있으므로 코드에서 특정 ID를 전제로 사용하지 않는다.

게임 결과는 `GamePlay`와 `GamePlacement`에 저장한다. `playId`는 UUID v4이며 같은 결과의 재요청은 기존 결과를 반환하고, 같은 `playId`를 다른 결과에 사용하면 HTTP 409를 반환한다. 랭킹은 후보별 누적 점수로 계산하고 동점 후보에게 같은 순위를 부여한다.

미디어는 PostgreSQL에 메타데이터와 object key만 저장한다. 정적 파일 응답은 `MEDIA_PUBLIC_BASE_URL` 기반의 공개 URL이며 `size=divide2`에 썸네일 key가 없으면 원본 URL로 대체한다. 현재 Compose에는 실제 S3 호환 오브젝트 스토리지가 포함되어 있지 않으므로 운영·로컬 저장소 공급자는 별도로 구성해야 한다.

댓글은 회원과 비회원 모두 작성할 수 있다. 비회원은 닉네임이 필수이며 `memberId`를 `null`로 저장한다. 회원은 프론트가 전달한 `access-token`으로 확인한 서버의 `memberId`와 닉네임을 저장하므로 요청 닉네임을 생략할 수 있고, 요청에 닉네임이 있어도 신뢰하지 않는다. 토큰 헤더가 없을 때만 비회원으로 처리하며 유효하지 않은 토큰을 보내면 HTTP 401을 반환한다. 본문은 공백 제거 후 1–30자, 비회원 닉네임은 1–50자로 검증한다. 작성 대상 후보가 공개 상태이며 요청 월드컵에 속하는지 확인한다. 목록은 `createdAt DESC, id DESC`로 안정적으로 정렬하며 `offset`은 건너뛸 행 수, `limit`은 조회 수다. 기본 `limit`은 20이고 최대 100이다. 회원 댓글 삭제는 작성 회원 본인만 가능하며 행을 제거하지 않고 `deletedAt`을 기록한다. 미인증 요청은 HTTP 401, 다른 회원 또는 비회원 댓글 삭제 요청은 HTTP 403, 없거나 이미 삭제된 댓글은 HTTP 404를 반환한다. 목록에서는 삭제된 댓글을 제외한다. 운영 공개 전 rate limit과 스팸 방지 정책이 필요하다.

회원은 기존 데이터를 이관하지 않고 새로 가입한다. `serviceId`는 영문·숫자 6–10자로 받고 소문자로 정규화하며, 닉네임은 공백 없는 2–10자다. 비밀번호는 8–16자의 영문·숫자·특수문자 조합이고 Argon2id 해시만 DB에 저장한다. access token은 15분이며 프론트 호환을 위해 `access-token` 헤더를 사용한다. refresh token은 30일짜리 HttpOnly 쿠키이고 DB에는 SHA-256 해시만 저장한다. 갱신 때마다 토큰과 세션을 교체하며 이전 토큰 재사용 시 같은 family의 세션을 모두 폐기한다. 로그아웃은 POST이며 refresh cookie 삭제와 서버 세션 폐기를 함께 수행한다.

월드컵 관리 목록과 상세, 생성 API는 로그인이 필수다. 생성 시 현재 회원의 ID를 `WorldCup.ownerId`에 저장하고, 목록과 상세 조회는 같은 `ownerId`만 조회한다. 다른 회원 소유이거나 존재하지 않는 월드컵 상세는 모두 HTTP 404를 반환해 존재 여부를 노출하지 않는다. 제목은 공백 제거 후 1~100자, 설명은 선택값으로 최대 100자, 공개 여부는 `PUBLIC` 또는 `PRIVATE`만 허용한다. 기존 스키마에 `ownerId`가 이미 있으므로 이 단계에서 새 migration은 만들지 않았다.

관리용 후보 목록은 월드컵 소유권을 먼저 확인한 뒤 공개·비공개 후보를 모두 `sortOrder`, 후보 ID 순서로 반환한다. 후보 ID 필드는 기존 Spring의 잘못된 `worldCupId` 이름을 유지하지 않고 `contentsId`로 바로잡았으며 프론트 매핑도 함께 수정했다. 후보별 게임 결과 점수를 합산하고 동점에는 같은 순위를 부여한다. 미디어가 없는 후보는 `mediaFileId: null`이며 프론트는 미디어 조회를 건너뛴다. 실제 미디어 내용은 기존 `/api/media-files/{mediaFileId}` API로 조회한다.

후보 생성 요청 규칙은 DTO와 단위 테스트로 작성되어 있다. 한 요청에는 1–256개 후보를 허용하며 후보명은 공백 제거 후 1–100자, 공개 여부는 `PUBLIC` 또는 `PRIVATE`다. 현재는 HTTPS `youtube.com/watch?v=` 주소, 5자리 시작 시간, 3–5초 재생 시간, `INTERNET_VIDEO_URL`과 `YOU_TUBE_URL` 조합만 허용한다. 정적 파일 요청과 알 수 없는 필드는 거부한다. 기존 프론트가 보내는 `originalName`은 호환을 위해 받지만 유튜브 미디어 저장에는 사용하지 않는다.

유튜브 후보 배열을 저장하는 내부 서비스도 구현되어 있다. 로그인 회원의 월드컵 소유권을 먼저 확인하고 요청에 포함된 모든 `MediaFile`과 `Candidate`를 하나의 트랜잭션에서 순서대로 생성한다. 후보 순서는 기존 마지막 `sortOrder` 다음 값부터 요청 배열 순서대로 연속해서 부여하며, 후보가 없으면 0부터 시작한다. 중간 저장이 실패하면 트랜잭션 전체가 실패하므로 해당 요청에서 생성하던 데이터가 함께 롤백된다. 같은 월드컵의 동시 요청은 PostgreSQL 트랜잭션 범위 advisory lock으로 직렬화한 뒤 마지막 순번을 조회하므로 `sortOrder` 고유 제약 충돌을 막는다. 서로 다른 월드컵은 서로 다른 잠금 키를 사용한다.

후보 일괄 생성 POST 컨트롤러는 기존 인증 가드에서 로그인 회원 ID를 받고, 검증된 요청 DTO의 `data` 배열을 내부 일괄 저장 서비스에 전달한다. 기존 프론트 호환을 위해 성공 시 HTTP 201과 `게임 생성`, `data: null` 응답을 사용한다. API 통합 테스트에서 유효한 로그인 요청 201, 미인증 요청 401, 빈 후보 배열 400, 다른 회원 월드컵 요청 404와 중첩 문자열 정규화를 확인했다.

프론트 후보 입력 검증도 현재 백엔드의 유튜브 전용 생성 범위와 맞췄다. 신규 정적 이미지 후보는 서버로 전송하기 전에 차단하고 지원 전이라는 안내를 반환한다. 영상 후보는 HTTPS `youtube.com/watch?v=` 주소와 허용 호스트, 5자리 시작 시간, 3–5초의 정수 재생 시간을 검사한다. 기존 정적 파일 요청 변환 코드는 과거 데이터 호환을 위해 유지했다.

## 8. 현재 확인된 사용자 흐름

다음 흐름을 실제 브라우저에서 확인했다.

1. 프론트 홈에서 `첫 번째 월드컵` 표시
2. 월드컵 선택
3. `4강` 선택
4. 후보 4명으로 준결승 두 경기 진행
5. 탈락 후보 ID를 제외해 결승 후보 2명 재조회
6. 결승 대진 화면 표시
7. 우승자 선택 후 게임 결과 저장
8. 누적 랭킹 갱신과 우승 결과 화면 표시
9. 비회원 댓글 작성, 최신순 재조회, 입력창 초기화
10. 새 회원가입 후 로그인 화면 이동과 성공 안내
11. 로그인 후 회원 정보 조회, 로그아웃 버튼과 `/members/{id}/games` 링크 표시
12. 잘못된 access token을 refresh cookie로 자동 갱신하고 원래 요청 재시도
13. refresh token 회전과 HttpOnly 속성 확인
14. 로그아웃 후 쿠키·로컬 회원 정보 삭제와 이전 access token 즉시 거부 확인
15. 로그인 회원 댓글에 access token 전달, 작성자 ID 연결, 본인 댓글 삭제 버튼 노출
16. 삭제 확인 후 소프트 삭제 요청, 댓글 목록 즉시 갱신과 삭제 댓글 제외

후보에 연결된 실제 이미지가 아직 없으므로 현재는 프론트엔드 기본 이미지가 표시된다.

게임 결과·미디어·댓글·회원 인증 migration을 실제 로컬 PostgreSQL에 적용했다. 게임 완료 저장, 누적 랭킹 갱신, 댓글 작성과 목록 재조회, 회원가입부터 로그아웃까지 이어지는 브라우저 흐름을 확인했다. 로그인 회원이 닉네임 없이 댓글을 작성해도 서버 회원 ID와 닉네임으로 연결되는 흐름과 본인 댓글 삭제 후 목록에서 사라지는 흐름도 실제 API와 PostgreSQL로 확인했다. 비밀번호는 Argon2id, refresh token은 64자리 SHA-256 해시로만 DB에 저장되는 것도 확인했다. 검증용 회원·세션·댓글·게임 결과는 확인 후 삭제했다. 미디어 조회는 자동화 테스트로 검증했으며 실제 오브젝트 스토리지는 아직 연결하지 않았다.

월드컵 관리 API는 실제 로컬 PostgreSQL에서 회원가입, 로그인, 비공개 월드컵 생성, 내 목록과 상세 조회까지 확인했다. 다른 검증 회원으로 같은 월드컵 상세를 요청했을 때 HTTP 404가 반환되는 것도 확인했다. 이 과정에서 만든 검증용 회원·세션·월드컵은 확인 후 모두 삭제했다.

관리용 후보 목록도 실제 PostgreSQL에서 공개·비공개 후보 3개와 게임 결과를 만들어 관리 순서, 정식 `contentsId`, 누적 점수, 순위, 미디어 ID를 확인했다. 다른 회원 요청은 HTTP 404로 차단되었다. 검증용 회원·세션·월드컵·후보·게임 결과·미디어는 확인 후 모두 삭제했다.

후보 일괄 저장의 동시성 처리도 실제 PostgreSQL에서 확인했다. 첫 검증에서는 `pg_advisory_xact_lock`의 `void` 반환값을 Prisma가 역직렬화하지 못하는 문제가 발견되어, 잠금 호출 결과를 불리언 열로 변환하도록 수정했다. 수정 후 같은 월드컵에 후보 2개씩인 요청 두 개를 동시에 실행했고 후보 4개가 `sortOrder` 0–3으로 중복 없이 저장되었다. 각 요청 묶음도 `[0, 1]`, `[2, 3]`으로 유지되었고 미디어 4개가 모두 후보에 연결되었다. 검증용 월드컵·회원·후보·미디어는 모두 삭제했으며 남은 검증 데이터가 0개인 것을 확인했다.

후보 일괄 생성의 실제 HTTP 흐름도 로컬 NestJS API와 PostgreSQL에서 확인했다. 검증용 회원가입 201, 로그인 200, 월드컵 생성 201, 유튜브 후보 2개 일괄 생성 201, 관리 목록 재조회 200을 확인했다. DB에는 후보가 `sortOrder` 0과 1로 저장되었고 두 후보 모두 `YOU_TUBE_URL` 미디어와 연결되었으며, 호환 입력인 `originalName`은 저장되지 않았다. 검증 후 회원·세션·월드컵·후보·미디어를 삭제했고 남은 검증 데이터가 0개인 것을 확인했다.

## 9. 검증 명령

백엔드:

```bash
npm run lint
npm test
npm run test:e2e
npm run build
```

마지막 작업 기준으로 린트, 빌드, 단위 테스트 84개가 통과했다. API 통합 테스트는 후보 일괄 생성의 201·401·400·404 경우를 포함해 45개가 통과했다.

프론트엔드:

```bash
npm run typecheck
npm run lint
npm test
```

마지막 작업 기준으로 프론트 타입 검사, 테스트 59개와 린트가 통과했다. 기존 `<img>` 사용과 관련된 Next.js 린트 경고 3건이 있으나 실패는 아니다. 직전 작업 기준 프로덕션 빌드도 통과했다. `npm ci`에서 기존 의존성 취약점이 보고되었으며, 별도 검토 없이 강제 자동 수정하지 않는다.

## 10. 참고 문서

기존 Spring 참고 저장소의 다음 문서에 프론트엔드 API 계약과 전체 이전 계획이 정리되어 있다.

- `iwtc-backend-new/API_CONTRACT.md`
- `iwtc-backend-new/BACKEND_MIGRATION_PLAN.md`

두 문서의 하단 진행 체크리스트 일부는 현재 구현보다 오래된 상태다. 실제 완료 여부는 이 문서와 신규 NestJS 저장소의 `main` 브랜치를 우선 기준으로 판단한다.

## 11. 다음 작업

프론트 후보 입력 검증을 현재 백엔드의 유튜브 전용 규칙과 맞추는 작업까지 완료되었다. 다음 작업은 후보 생성 폼 UI에서 정적 이미지 입력 선택지를 숨기고 현재는 유튜브 영상만 등록할 수 있다는 안내를 표시하는 변경만 진행한다. 기존 유튜브 입력과 후보 목록 동작은 유지한다. 이 단계에서는 백엔드 수정, API 변경과 브라우저 검증은 진행하지 않는다.

후보 삭제는 게임 결과가 후보를 `NoAction` 외래 키로 참조하므로 현재 상태에서 단순 hard delete가 실패한다. 삭제 API 구현 전 후보 soft delete 필드 추가 또는 과거 게임 결과 처리 정책을 먼저 결정해야 한다. 월드컵 삭제도 같은 이유로 게임 결과를 먼저 처리하지 않으면 실패하므로 별도 단계로 둔다.

그다음 우선순위는 다음과 같다.

1. 후보 일괄 생성, 수정, 삭제
2. 실제 S3 호환 오브젝트 스토리지와 미디어 업로드
3. GitHub Actions, GHCR, Kubernetes, Argo CD 배포
4. PostgreSQL 백업과 복구 테스트

## 12. 새 작업을 시작할 때 전달할 내용

새 개발 환경이나 새 AI 작업에서 아래처럼 요청하면 현재 맥락을 빠르게 이어갈 수 있다.

> `iwtc-backend-nest/HANDOFF.md`를 먼저 읽고 프론트 `src/domain/manage/content.ts`의 유튜브 전용 입력 검증과 후보 생성 폼을 확인해줘. 기존 DB나 회원 데이터는 사용하지 않는다. 다음 단계에서는 백엔드를 건드리지 말고, 프론트 후보 생성 폼에서 정적 이미지 입력 선택지를 숨기고 현재는 유튜브 영상만 등록할 수 있다는 안내를 표시해줘. 기존 유튜브 입력과 후보 목록 동작은 유지하고 브라우저 검증은 다음 단계로 남겨줘.
