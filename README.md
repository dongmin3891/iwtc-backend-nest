# iwtc-backend-nest

IWTC 프론트엔드의 API를 새 PostgreSQL 데이터베이스 기준으로 다시 구현하는 NestJS 백엔드입니다. 기존 데이터베이스나 기존 비밀번호를 가져오지 않습니다.

## 현재 구현 범위

- NestJS 12, TypeScript 6, Node.js 24
- PostgreSQL 18 로컬 개발 환경
- Prisma ORM 7.10 안정판과 최초 migration
- 환경 변수 시작 시 검증
- 공통 성공·오류 응답 형식
- Swagger 문서: `http://localhost:3001/docs`
- 상태 확인: `GET /health/live`, `GET /health/ready`
- 공개 월드컵 목록: `GET /api/world-cups`
- 플레이 가능한 라운드: `GET /api/world-cups/{worldCupId}/available-rounds`
- 월드컵 대진 후보: `GET /api/world-cups/{worldCupId}/contents`
- 월드컵 게임 결과 저장: `POST /api/world-cups/{worldCupId}/clear`
- 월드컵 게임 결과 랭킹: `GET /api/world-cups/{worldCupId}/game-result-contents`
- 미디어 파일 조회: `GET /api/media-files/{mediaFileId}`
- 월드컵 댓글 목록: `GET /api/world-cups/{worldCupId}/comments`
- 월드컵 후보 댓글 작성: `POST /api/world-cups/{worldCupId}/contents/{contentsId}/comments`
- 회원 댓글 삭제: `DELETE /api/comments/{commentId}`
- 내 월드컵 목록·상세 조회와 생성
- 회원가입·로그인·내 정보 조회
- refresh token rotation과 세션 단위 로그아웃
- 재현 가능한 개발용 seed

Prisma 8은 프로젝트 생성 시점에 npm에서 RC 버전만 제공되므로 운영 안정성을 위해 7.10으로 고정했습니다. Prisma 8 정식판 출시 후 별도 업그레이드로 진행합니다.

## 로컬 실행

요구 사항은 Node.js 24.19 이상, npm, Docker입니다.

```bash
nvm use
cp .env.example .env
npm ci
docker compose up -d postgres
npm run db:migrate
npm run db:seed
npm run start:dev
```

API는 `http://localhost:3001`, 기존 프론트엔드는 `http://localhost:3000`을 사용합니다.

PostgreSQL 18 공식 이미지의 데이터 볼륨 기준에 맞춰 컨테이너의 `/var/lib/postgresql`을 영구 볼륨으로 사용합니다.

`.env.example`의 비밀번호는 로컬 개발 전용 예시입니다. 운영 서버에서는 새로 만든 긴 무작위 비밀번호를 사용하고 Git 저장소에 커밋하지 않습니다.

JWT access secret과 refresh secret도 서로 다른 32자 이상의 값으로 설정해야 합니다. 운영용 값은 아래처럼 각각 새로 만든 뒤 Kubernetes Secret으로 주입하고, 생성된 값을 문서나 Git에 남기지 않습니다.

```bash
openssl rand -base64 48
openssl rand -base64 48
```

정적 미디어의 실제 파일은 PostgreSQL이 아니라 S3 호환 오브젝트 스토리지에 저장합니다. DB에는 메타데이터와 원본·썸네일 object key만 저장하며, 조회 API는 `MEDIA_PUBLIC_BASE_URL`을 기준으로 공개 HTTPS URL을 반환합니다. `size=divide2` 요청에 썸네일이 없으면 원본 URL을 반환합니다.

댓글은 회원과 비회원 모두 작성할 수 있습니다. 비회원은 닉네임이 필수이고 작성자 회원 ID를 `null`로 저장합니다. 회원은 `access-token` 헤더로 확인한 서버의 회원 ID와 닉네임을 저장하므로 요청 본문의 닉네임은 생략할 수 있고, 전달해도 사용하지 않습니다. 토큰 헤더가 없으면 비회원 요청으로 처리하지만, 유효하지 않은 토큰을 전달하면 비회원으로 낮추지 않고 HTTP 401을 반환합니다. 본문은 공백 제거 후 1–30자, 비회원 닉네임은 1–50자로 검증합니다. 목록은 최신순으로 정렬하고 `offset`과 `limit`을 지원합니다. 회원 댓글은 작성 회원만 소프트 삭제할 수 있습니다.

## 월드컵 관리

월드컵 관리 API는 모두 로그인이 필요합니다. 생성 시 access token으로 확인한 회원 ID를 소유자로 저장하며, 목록과 상세 조회도 요청 회원이 소유한 월드컵만 반환합니다. 다른 회원의 월드컵 상세는 존재 여부를 노출하지 않고 HTTP 404를 반환합니다.

| Method | 경로                                          | 설명           |
| ------ | --------------------------------------------- | -------------- |
| GET    | `/api/me/game-manage/world-cups`              | 내 월드컵 목록 |
| GET    | `/api/me/game-manage/world-cups/{worldCupId}` | 내 월드컵 상세 |
| POST   | `/api/me/game-manage/world-cups`              | 내 월드컵 생성 |
| GET    | `/api/me/game-contents-manage/world-cups/{worldCupId}/manage-contents` | 관리용 후보 목록 |

관리용 후보 목록은 `GET /api/me/game-contents-manage/world-cups/{worldCupId}/manage-contents`로 조회합니다. 월드컵 소유자만 접근할 수 있고 공개·비공개 후보를 모두 관리 순서대로 반환합니다. 후보별 누적 게임 점수와 공동순위도 함께 계산하며, 미디어가 아직 없는 후보는 `mediaFileId`가 `null`입니다.

## 회원 인증

회원 데이터는 새 PostgreSQL에서 시작하며 기존 회원이나 비밀번호를 가져오지 않습니다.

- 아이디(`serviceId`): 영문·숫자 6~10자, 소문자로 정규화
- 닉네임: 공백 없는 2~10자
- 비밀번호: 8~16자, 영문·숫자·특수문자 각각 포함
- 비밀번호 저장: Argon2id 해시
- access token: 15분, 기존 프론트 호환을 위해 `access-token` 응답·요청 헤더 사용
- refresh token: 30일, `HttpOnly`, `SameSite=Lax`, `/api` 경로 쿠키
- DB에는 refresh token 원문 대신 SHA-256 해시만 저장
- 갱신할 때마다 refresh token을 교체하고, 이미 사용한 토큰이 다시 들어오면 같은 세션 묶음을 모두 폐기
- 로그아웃은 `POST /api/members/sign-out`이며 쿠키와 서버 세션을 함께 폐기

인증 API는 다음과 같습니다.

| Method | 경로                      | 설명                      |
| ------ | ------------------------- | ------------------------- |
| POST   | `/api/members/sign-up`    | 회원가입                  |
| POST   | `/api/members/sign-in`    | 로그인                    |
| GET    | `/api/members/me/summary` | 내 회원 정보 조회         |
| POST   | `/api/new-access-token`   | access·refresh token 회전 |
| POST   | `/api/members/sign-out`   | 로그아웃                  |

## 주요 명령

| 명령                        | 설명                            |
| --------------------------- | ------------------------------- |
| `npm run start:dev`         | 개발 서버 실행                  |
| `npm run build`             | 프로덕션 빌드                   |
| `npm run lint`              | 정적 검사                       |
| `npm test`                  | 단위 테스트                     |
| `npm run test:e2e`          | API 통합 테스트                 |
| `npm run prisma:validate`   | Prisma 스키마 검사              |
| `npm run db:migrate`        | 개발 DB에 migration 적용        |
| `npm run db:migrate:deploy` | 운영 DB에 커밋된 migration 적용 |
| `npm run db:seed`           | 개발용 예시 데이터 추가         |

## 새 데이터베이스 원칙

- 기존 DB dump, 사용자, 비밀번호를 가져오지 않습니다.
- `prisma/migrations`가 새 DB의 유일한 스키마 변경 이력입니다.
- seed는 개발·테스트 환경에서만 명시적으로 실행합니다.
- 운영 자격 증명은 Kubernetes Secret으로 주입합니다.
- 운영 migration은 애플리케이션 시작 명령과 분리합니다.
