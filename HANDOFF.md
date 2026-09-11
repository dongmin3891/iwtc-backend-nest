# IWTC 개발 인수인계

마지막 확인일: 2026-09-11

이 문서는 다른 컴퓨터나 새 Cursor 환경에서 IWTC 개발을 바로 이어가기 위한 현재 상태와 실행 절차를 정리한다.

## 1. 프로젝트 원칙

- 백엔드는 Spring Boot에서 NestJS로 새로 구현한다.
- 데이터베이스는 PostgreSQL 18을 사용한다.
- 기존 운영 DB, 기존 사용자 데이터, 기존 DB 계정과 비밀번호는 가져오지 않는다.
- 새 Prisma migration과 새 데이터로 시작한다.
- 기존 Spring 저장소는 API 동작과 비즈니스 규칙을 확인하는 참고 자료로만 사용한다.
- 로컬 개발 비밀번호와 운영 비밀번호를 분리한다. 실제 운영 비밀번호는 Git에 올리지 않고 Kubernetes Secret으로 관리한다.
- 운영 환경은 홈서버 K3s에 프론트엔드, 백엔드, PostgreSQL, MinIO를 함께 배포한다.
- PostgreSQL과 MinIO 데이터는 PVC에 저장해 Pod 재시작 후에도 유지하고, 홈서버 장애에 대비한 백업은 추후 Cloudflare R2 같은 외부 저장소로 보낸다.

## 2. 저장소와 기준 브랜치

| 용도               | 저장소                                                 | 기준 브랜치                 | 기능 기준 커밋 |
| ------------------ | ------------------------------------------------------ | --------------------------- | -------------- |
| 신규 백엔드        | `https://github.com/dongmin3891/iwtc-backend-nest.git` | `main`                      | `d31022e`      |
| 프론트엔드         | `https://github.com/dongmin3891/iwtc-frontend-new.git` | `refactor/full-project`     | `a5032d7`      |
| 기존 Spring 참고용 | `https://github.com/dongmin3891/iwtc-backend-new.git`  | `codex/nest-migration-plan` | `3703d2d`      |

신규 개발 코드는 `iwtc-backend-nest`에 작성한다. `iwtc-backend-new`를 신규 서버로 배포하지 않는다.

게임 결과·랭킹·미디어·회원·비회원 댓글·회원 인증·회원 댓글 삭제·내 월드컵 목록·상세·생성·관리용 후보 목록·후보 생성·수정·삭제·정적 이미지 업로드와 교체 구현은 각 원격 기준 브랜치에 push되어 있다. `iwtc.code-workspace`는 신규 백엔드 작업 트리에만 있는 로컬 편의 파일이며 커밋하지 않았다.

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
docker compose up -d
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
- 유튜브 후보 수정 요청 DTO와 입력 검증
- 소유자 전용 후보·유튜브 미디어 트랜잭션 수정 서비스
- 소유자 전용 후보 수정 PUT 컨트롤러
- 소유자 전용 후보 소프트 삭제 API와 삭제 후보의 관리·수정·댓글 차단
- S3 호환 오브젝트 스토리지 클라이언트와 로컬 MinIO 실행 환경
- JPEG·PNG·GIF 정적 이미지 후보 multipart 업로드
- 정적 이미지 후보명·공개 상태 수정과 선택적 이미지 교체
- 이미지 저장 실패 시 새 객체 정리, 교체 성공 시 이전 객체 정리
- 후보 소프트 삭제용 `Candidate.deletedAt` 스키마와 migration
- 후보 물리 삭제로 댓글이 사라지지 않게 보호하는 외래 키
- 공개 월드컵 미리보기와 플레이 가능 라운드의 삭제 후보 제외
- 게임 대진 후보 수 계산과 실제 후보 조회의 삭제 후보 제외
- 새 게임 결과 저장 시 삭제 후보 거부와 기존 결과 멱등성 유지
- 공개 랭킹 응답의 삭제 후보 제외와 과거 점수 보존
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
| POST   | `/api/me/game-contents-manage/world-cups/{worldCupId}/contents/static` | 완료 |
| PUT    | `/api/me/game-contents-manage/world-cups/{worldCupId}/contents/{contentsId}` | 완료 |
| PUT    | `/api/me/game-contents-manage/world-cups/{worldCupId}/contents/{contentsId}/static` | 완료 |
| DELETE | `/api/me/game-contents-manage/world-cups/{worldCupId}/contents/{contentsId}` | 완료 |

개발용 seed는 공개 월드컵 1개와 `후보 A`부터 `후보 D`까지 총 4개 후보를 만든다. 후보 ID는 실행 환경에 따라 달라질 수 있으므로 코드에서 특정 ID를 전제로 사용하지 않는다.

게임 결과는 `GamePlay`와 `GamePlacement`에 저장한다. `playId`는 UUID v4이며 같은 결과의 재요청은 기존 결과를 반환하고, 같은 `playId`를 다른 결과에 사용하면 HTTP 409를 반환한다. 랭킹은 후보별 누적 점수로 계산하고 동점 후보에게 같은 순위를 부여한다.

미디어는 PostgreSQL에 메타데이터와 object key만 저장한다. 정적 파일 응답은 `MEDIA_PUBLIC_BASE_URL` 기반의 공개 URL이며 `size=divide2`에 썸네일 key가 없으면 원본 URL로 대체한다. 로컬 Compose에는 MinIO와 버킷 초기화 구성이 포함되어 있다. 정적 이미지는 JPEG·PNG·GIF, 최대 10MB를 허용한다. 생성 시 업로드 후 DB 저장에 실패하면 새 객체를 지우고, 교체 시 DB 트랜잭션이 성공한 뒤 이전 객체를 지운다.

댓글은 회원과 비회원 모두 작성할 수 있다. 비회원은 닉네임이 필수이며 `memberId`를 `null`로 저장한다. 회원은 프론트가 전달한 `access-token`으로 확인한 서버의 `memberId`와 닉네임을 저장하므로 요청 닉네임을 생략할 수 있고, 요청에 닉네임이 있어도 신뢰하지 않는다. 토큰 헤더가 없을 때만 비회원으로 처리하며 유효하지 않은 토큰을 보내면 HTTP 401을 반환한다. 본문은 공백 제거 후 1–30자, 비회원 닉네임은 1–50자로 검증한다. 작성 대상 후보가 공개 상태이며 요청 월드컵에 속하는지 확인한다. 목록은 `createdAt DESC, id DESC`로 안정적으로 정렬하며 `offset`은 건너뛸 행 수, `limit`은 조회 수다. 기본 `limit`은 20이고 최대 100이다. 회원 댓글 삭제는 작성 회원 본인만 가능하며 행을 제거하지 않고 `deletedAt`을 기록한다. 미인증 요청은 HTTP 401, 다른 회원 또는 비회원 댓글 삭제 요청은 HTTP 403, 없거나 이미 삭제된 댓글은 HTTP 404를 반환한다. 목록에서는 삭제된 댓글을 제외한다. 운영 공개 전 rate limit과 스팸 방지 정책이 필요하다.

회원은 기존 데이터를 이관하지 않고 새로 가입한다. `serviceId`는 영문·숫자 6–10자로 받고 소문자로 정규화하며, 닉네임은 공백 없는 2–10자다. 비밀번호는 8–16자의 영문·숫자·특수문자 조합이고 Argon2id 해시만 DB에 저장한다. access token은 15분이며 프론트 호환을 위해 `access-token` 헤더를 사용한다. refresh token은 30일짜리 HttpOnly 쿠키이고 DB에는 SHA-256 해시만 저장한다. 갱신 때마다 토큰과 세션을 교체하며 이전 토큰 재사용 시 같은 family의 세션을 모두 폐기한다. 로그아웃은 POST이며 refresh cookie 삭제와 서버 세션 폐기를 함께 수행한다.

월드컵 관리 목록과 상세, 생성 API는 로그인이 필수다. 생성 시 현재 회원의 ID를 `WorldCup.ownerId`에 저장하고, 목록과 상세 조회는 같은 `ownerId`만 조회한다. 다른 회원 소유이거나 존재하지 않는 월드컵 상세는 모두 HTTP 404를 반환해 존재 여부를 노출하지 않는다. 제목은 공백 제거 후 1~100자, 설명은 선택값으로 최대 100자, 공개 여부는 `PUBLIC` 또는 `PRIVATE`만 허용한다. 기존 스키마에 `ownerId`가 이미 있으므로 이 단계에서 새 migration은 만들지 않았다.

관리용 후보 목록은 월드컵 소유권을 먼저 확인한 뒤 공개·비공개 후보를 모두 `sortOrder`, 후보 ID 순서로 반환한다. 후보 ID 필드는 기존 Spring의 잘못된 `worldCupId` 이름을 유지하지 않고 `contentsId`로 바로잡았으며 프론트 매핑도 함께 수정했다. 후보별 게임 결과 점수를 합산하고 동점에는 같은 순위를 부여한다. 미디어가 없는 후보는 `mediaFileId: null`이며 프론트는 미디어 조회를 건너뛴다. 실제 미디어 내용은 기존 `/api/media-files/{mediaFileId}` API로 조회한다.

후보 생성 요청 규칙은 DTO와 단위 테스트로 작성되어 있다. 한 요청에는 1–256개 후보를 허용하며 후보명은 공백 제거 후 1–100자, 공개 여부는 `PUBLIC` 또는 `PRIVATE`다. 현재는 HTTPS `youtube.com/watch?v=` 주소, 5자리 시작 시간, 3–5초 재생 시간, `INTERNET_VIDEO_URL`과 `YOU_TUBE_URL` 조합만 허용한다. 정적 파일 요청과 알 수 없는 필드는 거부한다. 기존 프론트가 보내는 `originalName`은 호환을 위해 받지만 유튜브 미디어 저장에는 사용하지 않는다.

유튜브 후보 배열을 저장하는 내부 서비스도 구현되어 있다. 로그인 회원의 월드컵 소유권을 먼저 확인하고 요청에 포함된 모든 `MediaFile`과 `Candidate`를 하나의 트랜잭션에서 순서대로 생성한다. 후보 순서는 기존 마지막 `sortOrder` 다음 값부터 요청 배열 순서대로 연속해서 부여하며, 후보가 없으면 0부터 시작한다. 중간 저장이 실패하면 트랜잭션 전체가 실패하므로 해당 요청에서 생성하던 데이터가 함께 롤백된다. 같은 월드컵의 동시 요청은 PostgreSQL 트랜잭션 범위 advisory lock으로 직렬화한 뒤 마지막 순번을 조회하므로 `sortOrder` 고유 제약 충돌을 막는다. 서로 다른 월드컵은 서로 다른 잠금 키를 사용한다.

후보 일괄 생성 POST 컨트롤러는 기존 인증 가드에서 로그인 회원 ID를 받고, 검증된 요청 DTO의 `data` 배열을 내부 일괄 저장 서비스에 전달한다. 기존 프론트 호환을 위해 성공 시 HTTP 201과 `게임 생성`, `data: null` 응답을 사용한다. API 통합 테스트에서 유효한 로그인 요청 201, 미인증 요청 401, 빈 후보 배열 400, 다른 회원 월드컵 요청 404와 중첩 문자열 정규화를 확인했다.

후보 수정 요청 DTO는 기존 프론트 PUT 요청과 호환되는 `contentsName`, `originalName`, `mediaData`, `detailFileType`, `videoStartTime`, `videoPlayDuration`, `visibleType`을 받는다. 후보명과 문자열을 정규화하고 HTTPS YouTube watch 주소, 5자리 시작 시간, 3–5초 정수 재생 시간, `YOU_TUBE_URL`, `PUBLIC` 또는 `PRIVATE`만 허용하며 알 수 없는 필드는 거부한다. 수정 서비스는 월드컵 소유권과 후보 소속, 연결 미디어를 확인한 뒤 하나의 트랜잭션에서 후보와 YouTube 미디어를 함께 갱신한다. PUT API는 성공 시 HTTP 204를 반환하며 미인증·잘못된 입력·다른 회원 월드컵·다른 월드컵 후보를 자동화 테스트로 검증했다. 프론트의 공개 여부 수정값 전달과 수정 직후 미디어 캐시 무효화도 보정되어 있다.

프론트 후보 입력 검증은 이미지와 유튜브 후보를 모두 지원한다. 이미지는 JPEG·PNG·GIF와 최대 10MB를 검사하고 multipart 요청으로 개별 생성한다. 영상 후보는 HTTPS `youtube.com/watch?v=` 주소와 허용 호스트, 5자리 시작 시간, 3–5초의 정수 재생 시간을 검사한다.

신규 후보 생성 폼에는 이미지 파일과 유튜브 영상 선택지를 모두 노출한다. 저장된 이미지 후보 수정은 후보명·공개 여부만 바꾸거나 새 파일을 선택해 이미지를 교체할 수 있다. 임의의 MinIO 공개 URL은 Next.js 이미지 호스트 허용 목록에 종속되지 않도록 일반 `<img>`로 표시한다.

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

게임 결과·미디어·댓글·회원 인증 migration을 실제 로컬 PostgreSQL에 적용했다. 게임 완료 저장, 누적 랭킹 갱신, 댓글 작성과 목록 재조회, 회원가입부터 로그아웃까지 이어지는 브라우저 흐름을 확인했다. 로그인 회원이 닉네임 없이 댓글을 작성해도 서버 회원 ID와 닉네임으로 연결되는 흐름과 본인 댓글 삭제 후 목록에서 사라지는 흐름도 실제 API와 PostgreSQL로 확인했다. 비밀번호는 Argon2id, refresh token은 64자리 SHA-256 해시로만 DB에 저장되는 것도 확인했다. 검증용 회원·세션·댓글·게임 결과는 확인 후 삭제했다.

월드컵 관리 API는 실제 로컬 PostgreSQL에서 회원가입, 로그인, 비공개 월드컵 생성, 내 목록과 상세 조회까지 확인했다. 다른 검증 회원으로 같은 월드컵 상세를 요청했을 때 HTTP 404가 반환되는 것도 확인했다. 이 과정에서 만든 검증용 회원·세션·월드컵은 확인 후 모두 삭제했다.

관리용 후보 목록도 실제 PostgreSQL에서 공개·비공개 후보 3개와 게임 결과를 만들어 관리 순서, 정식 `contentsId`, 누적 점수, 순위, 미디어 ID를 확인했다. 다른 회원 요청은 HTTP 404로 차단되었다. 검증용 회원·세션·월드컵·후보·게임 결과·미디어는 확인 후 모두 삭제했다.

후보 일괄 저장의 동시성 처리도 실제 PostgreSQL에서 확인했다. 첫 검증에서는 `pg_advisory_xact_lock`의 `void` 반환값을 Prisma가 역직렬화하지 못하는 문제가 발견되어, 잠금 호출 결과를 불리언 열로 변환하도록 수정했다. 수정 후 같은 월드컵에 후보 2개씩인 요청 두 개를 동시에 실행했고 후보 4개가 `sortOrder` 0–3으로 중복 없이 저장되었다. 각 요청 묶음도 `[0, 1]`, `[2, 3]`으로 유지되었고 미디어 4개가 모두 후보에 연결되었다. 검증용 월드컵·회원·후보·미디어는 모두 삭제했으며 남은 검증 데이터가 0개인 것을 확인했다.

후보 일괄 생성의 실제 HTTP 흐름도 로컬 NestJS API와 PostgreSQL에서 확인했다. 검증용 회원가입 201, 로그인 200, 월드컵 생성 201, 유튜브 후보 2개 일괄 생성 201, 관리 목록 재조회 200을 확인했다. DB에는 후보가 `sortOrder` 0과 1로 저장되었고 두 후보 모두 `YOU_TUBE_URL` 미디어와 연결되었으며, 호환 입력인 `originalName`은 저장되지 않았다. 검증 후 회원·세션·월드컵·후보·미디어를 삭제했고 남은 검증 데이터가 0개인 것을 확인했다.

프론트 후보 생성 폼의 YouTube 전용 표시도 실제 브라우저에서 확인했다. 이미지 파일 버튼은 표시되지 않았고 YouTube 영상만 등록할 수 있다는 안내와 `유튜브 영상` 버튼이 표시되었다. 버튼을 누르면 후보명, YouTube 동영상 링크, 영상 시작 시간, 반복 시간 입력란이 기존처럼 열렸다. 실제 후보는 저장하지 않았다. 화면 확인을 위해 만든 임시 회원과 빈 월드컵은 삭제했으며 두 데이터가 모두 0개 남은 것을 확인했다. 이 과정에서 `SelectVisibleType`의 라디오 입력에 `checked`와 `defaultChecked`가 함께 지정되었다는 기존 React 경고를 발견했다.

`SelectVisibleType`의 공개 라디오는 이미 `visibleType` 상태의 `checked` 값으로 제어되고 있으므로 중복된 `defaultChecked`를 제거했다. 공개·비공개 선택 방식과 후보 폼의 표시 내용은 변경하지 않았다. 테스트 59개, 타입 검사, 린트와 프로덕션 빌드가 통과했다. 실제 브라우저에서도 후보의 공개 상태가 비공개로 전환되고 다시 공개로 돌아오는 것을 확인했으며 `checked`·`defaultChecked` 관련 React 경고는 더 이상 발생하지 않았다. 브라우저 로그에는 별개의 favicon 404와 회원가입 비밀번호 입력의 autocomplete 권고만 남아 있다. 실제 후보는 저장하지 않았고 검증용 회원과 빈 월드컵은 삭제 후 모두 0건인 것을 확인했다.

YouTube 후보 1개의 실제 브라우저 저장 흐름도 확인했다. 새 회원과 빈 월드컵을 만든 뒤 후보명, HTTPS YouTube watch 주소, 시작 시간 `00000`, 반복 시간 `3`, 공개 상태를 입력하고 화면의 신규 후보 목록에 추가했다. `새로운 컨텐츠 생성 적용`으로 저장한 뒤 내 월드컵 목록에서 관리 화면을 다시 열었을 때 서버에서 재조회된 후보와 모든 입력값이 그대로 표시되었다. PostgreSQL에서도 후보가 `sortOrder: 0`으로 저장되고 `INTERNET_VIDEO_URL`·`YOU_TUBE_URL` 미디어와 연결된 것을 확인했다. 검증 후 회원·세션·월드컵·후보·미디어를 모두 삭제했고 남은 데이터가 각각 0건인 것을 확인했다.

후보 수정의 실제 HTTP·PostgreSQL 흐름도 확인했다. 검증용 회원가입 201, 로그인 200, 월드컵 생성 201, YouTube 후보 생성 201 후 후보명, URL, 시작 시간, 반복 시간, 공개 여부를 변경하는 PUT 요청이 204를 반환했다. 관리 목록 API와 미디어 API를 다시 조회했을 때 수정된 후보명·공개 상태·URL·시작 시간·반복 시간이 반환되었고, PostgreSQL에서도 같은 값과 기존 `sortOrder: 0`, `INTERNET_VIDEO_URL`·`YOU_TUBE_URL`, `originalName: null`이 유지된 것을 확인했다. 검증 후 회원·세션·월드컵·후보·미디어를 모두 삭제했고 남은 데이터가 각각 0건인 것을 확인했다.

후보 수정의 실제 브라우저 흐름도 확인했다. 저장된 비공개 YouTube 후보의 수정 화면에서 후보명, 다른 실제 YouTube URL, 시작 시간 `00120`, 반복 시간 `5`, 공개 상태를 적용하자 수정 대기 건수가 1개로 표시되었다. `변경사항 적용` 후 성공 안내와 수정 대기 0개를 확인했고, 관리 화면을 새로고침한 뒤에도 모든 수정값과 새 YouTube 영상이 유지되었다. PostgreSQL에도 같은 값이 저장되었으며 검증용 회원·세션·월드컵·후보·미디어는 모두 삭제 후 0건인 것을 확인했다. 브라우저 로그에는 기존 favicon 404와 YouTube 로그 요청의 로컬 네트워크 오류만 있었고 애플리케이션 수정 오류는 없었다.

후보 삭제 정책의 첫 구현 단계로 `Candidate.deletedAt`과 `(world_cup_id, deleted_at, visible_type)` 인덱스를 추가하고 기존 후보 공개 인덱스를 대체했다. `Comment.candidate` 외래 키는 `Cascade`에서 `NoAction`으로 변경했고 `GamePlacement.candidate`의 `NoAction`은 유지했다. migration을 실제 로컬 PostgreSQL에 적용한 뒤 컬럼·인덱스·외래 키를 직접 확인했으며 기존 후보 4개는 모두 `deletedAt: null`로 보존되었다. Prisma 스키마 검증과 Client 생성, migration 상태 확인, 린트, 단위 테스트 113개, 빌드가 통과했다. 해당 migration 단계에는 서비스와 API의 삭제 후보 필터를 포함하지 않았다.

공개 월드컵 목록의 미리보기 후보와 플레이 가능한 라운드의 후보 수 계산에는 `visibleType: PUBLIC`과 함께 `deletedAt: null` 조건을 적용했다. 월드컵 목록 자체의 공개 기준과 페이지 수 계산은 변경하지 않았다. Prisma 조회 조건을 확인하는 단위 테스트를 보강했고 전체 린트, 단위 테스트 113개, API 통합 테스트 50개, 빌드가 통과했다. 게임 대진 조회와 결과 저장 등 나머지 후보 조회는 아직 변경하지 않았다.

게임 대진 조회에서는 요청 라운드와 비교하는 활성 공개 후보 수와 실제 무작위 대진에 사용하는 후보 목록에 모두 `deletedAt: null`을 적용했다. 다음 라운드의 탈락 후보 ID 제외 조건과 삭제 조건도 함께 전달되는 것을 단위 테스트로 확인했다. 전체 린트, 단위 테스트 113개, API 통합 테스트 50개, 빌드가 통과했다. 해당 단계에는 새 게임 결과 저장 후보 검증을 포함하지 않았다.

새 게임 결과 저장은 요청 후보를 검증할 때 `visibleType: PUBLIC`과 `deletedAt: null`을 함께 확인하므로 삭제 후보가 포함된 신규 결과를 거부한다. 트랜잭션 시작 시 같은 `playId`의 결과가 이미 있으면 후보를 다시 검증하지 않고 기존 결과를 반환하는 멱등 동작은 유지했다. 조회 조건과 기존 결과 우선 처리를 단위 테스트로 고정했으며 전체 린트, 단위 테스트 113개, API 통합 테스트 50개, 빌드가 통과했다. 해당 단계에는 공개 랭킹 변경을 포함하지 않았다.

공개 랭킹은 `visibleType: PUBLIC`이면서 `deletedAt: null`인 후보만 응답에 포함한다. 점수 집계는 먼저 조회한 활성 후보 ID에 대해서만 수행하므로 삭제 후보의 과거 `GamePlacement` 행은 DB에 보존하면서 현재 랭킹에서는 제외한다. 활성 후보의 과거 점수와 0점 후보 포함, 공동순위 계산 방식은 유지했다. 조회와 집계 조건을 단위 테스트로 고정했고 전체 린트, 단위 테스트 113개, API 통합 테스트 50개, 빌드가 통과했다.

정적 이미지 후보의 생성과 교체를 실제 브라우저, PostgreSQL, MinIO로 확인했다. 이미지 후보를 생성하고 관리 화면을 새로고침했을 때 이미지와 후보명이 유지되었고, 후보명 변경·비공개 전환·다른 PNG로 교체한 뒤 다시 새로고침해도 변경값이 유지되었다. DB에는 새 object key와 원본 파일명이 저장되었으며 새 MinIO 객체는 업로드한 파일과 byte 단위로 일치했다. 교체 전 객체는 HTTP 404로 삭제를 확인했다. 검증용 회원·월드컵·후보·미디어·MinIO 객체는 확인 후 모두 삭제했다.

이 브라우저 검증 중 저장된 MinIO URL을 Next.js `<Image>`가 허용되지 않은 외부 호스트로 판단해 관리 화면이 깨지는 문제를 발견했다. 저장된 정적 미디어 표시는 일반 `<img>`를 사용하도록 프론트에서 수정했고 `a5032d7`로 push했다. 수정 후 재조회 화면에서 이미지가 정상 표시되었다.

## 9. 검증 명령

백엔드:

```bash
npm run lint
npm test
npm run test:e2e
npm run build
```

마지막 작업 기준으로 린트와 빌드, 단위 테스트 142개가 통과했다. API 통합 테스트는 정적 이미지 생성·선택적 교체를 포함해 57개가 통과했다. 검증 명령은 프로젝트 기준 Node.js 24.19에서 실행해야 한다.

프론트엔드:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

마지막 작업 기준으로 프론트 타입 검사, 테스트 65개, 린트와 프로덕션 빌드가 통과했다. 기존 및 저장소 이미지 표시용 `<img>`와 관련된 Next.js 린트 경고 4건이 있으나 실패는 아니다. `npm ci`에서 기존 의존성 취약점이 보고되었으며, 별도 검토 없이 강제 자동 수정하지 않는다.

## 10. 참고 문서

기존 Spring 참고 저장소의 다음 문서에 프론트엔드 API 계약과 전체 이전 계획이 정리되어 있다.

- `iwtc-backend-new/API_CONTRACT.md`
- `iwtc-backend-new/BACKEND_MIGRATION_PLAN.md`
- `iwtc-backend-nest/CANDIDATE_DELETION_POLICY.md`

기존 Spring 참고 문서 두 개의 하단 진행 체크리스트 일부는 현재 구현보다 오래된 상태다. 실제 완료 여부는 이 문서와 신규 NestJS 저장소의 `main` 브랜치를 우선 기준으로 판단한다.

## 11. 다음 작업

후보 생성·수정·삭제와 실제 S3 호환 이미지 업로드까지 완료되었다. 다음 목표는 `ddongmy-os`에서 사용 중인 GitOps 흐름을 IWTC 프론트엔드와 백엔드에 적용하는 것이다.

확정된 운영 구조는 다음과 같다.

```text
Internet
  -> Traefik
     -> iwtc.ddongmy.com       -> Frontend
     -> api.iwtc.ddongmy.com   -> NestJS Backend
     -> media.iwtc.ddongmy.com -> MinIO S3 API

K3s / namespace: iwtc
  -> Frontend Deployment
  -> Backend Deployment
  -> PostgreSQL StatefulSet + PVC 5Gi
  -> MinIO StatefulSet + PVC 20Gi
```

- 프론트엔드, 백엔드, PostgreSQL, MinIO를 모두 홈서버 K3s에서 운영한다.
- K3s 기본 `local-path` StorageClass를 전제로 시작하되, 실제 적용 전 홈서버에서 `kubectl get storageclass`로 확인한다.
- PostgreSQL과 MinIO는 각각 단일 replica StatefulSet으로 시작하고 PVC에 데이터를 보존한다.
- PVC는 Pod 재시작에는 안전하지만 홈서버 디스크 장애까지 보호하지 않으므로 외부 백업이 필수다.
- 운영 Secret은 Git에 커밋하지 않고 `iwtc` namespace의 Kubernetes Secret으로 주입한다.
- MinIO 관리 콘솔은 외부에 공개하지 않고 S3 API만 `media.iwtc.ddongmy.com`으로 노출한다.
- `iwtc` 버킷은 초기화 Job으로 만들고 이미지 다운로드만 공개한다.
- Prisma migration은 여러 백엔드 Pod가 동시에 실행하지 않도록 Argo CD `PreSync` Job으로 수행한다.
- TLS는 세 서브도메인을 포함하는 인증서 또는 `*.ddongmy.com` wildcard 인증서가 필요하다.

구현 순서는 다음과 같다.

1. 백엔드 저장소에 `k8s/`, Argo CD Application, GitHub Actions를 추가한다.
2. PostgreSQL StatefulSet·Service·5Gi PVC와 MinIO StatefulSet·Service·20Gi PVC·버킷 초기화 Job을 구성한다.
3. 백엔드 Deployment·Service·Ingress와 `/health/live`, `/health/ready` probe를 구성한다.
4. 백엔드 런타임 이미지에 Prisma migration 실행 파일을 포함하고 PreSync migration Job을 연결한다.
5. 프론트엔드 저장소에 프로덕션 Dockerfile, Kubernetes Deployment·Service·Ingress, GitHub Actions, Argo CD Application을 추가한다.
6. 프론트 빌드 환경을 `https://api.iwtc.ddongmy.com/`으로 바꾸고 백엔드 CORS를 `https://iwtc.ddongmy.com`으로 설정한다.
7. GHCR 이미지가 비공개이면 K3s에 image pull Secret을 등록한다.
8. Argo CD로 백엔드 인프라부터 동기화한 뒤 프론트엔드를 배포하고 회원가입·로그인·게임·이미지 업로드를 검증한다.
9. 안정화 후 PostgreSQL `pg_dump`와 MinIO 객체를 Cloudflare R2 같은 외부 저장소로 보내는 CronJob, 보존 정책, 실제 복구 테스트를 추가한다.

현재 로컬 Mac에는 Kubernetes current context가 설정되어 있지 않아 클러스터 상태를 직접 조회하지 못했다. 실제 배포 적용과 검증은 홈서버 kubeconfig를 연결하거나 홈서버에서 명령을 실행해야 한다.

## 12. 새 작업을 시작할 때 전달할 내용

새 개발 환경이나 새 AI 작업에서 아래처럼 요청하면 현재 맥락을 빠르게 이어갈 수 있다.

> `iwtc-backend-nest/HANDOFF.md`를 먼저 읽고 이어서 진행해줘. 기존 운영 DB나 회원 데이터는 사용하지 않는다. 다음 단계에서는 확정된 K3s/PVC 구조에 따라 백엔드 저장소부터 PostgreSQL, MinIO, NestJS, GitHub Actions, Argo CD 배포 구성을 구현해줘. 운영 Secret 값은 Git에 커밋하지 말고, 기존 `iwtc.code-workspace`도 커밋하지 마.
