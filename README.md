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

정적 미디어의 실제 파일은 PostgreSQL이 아니라 S3 호환 오브젝트 스토리지에 저장합니다. DB에는 메타데이터와 원본·썸네일 object key만 저장하며, 조회 API는 `MEDIA_PUBLIC_BASE_URL`을 기준으로 공개 HTTPS URL을 반환합니다. `size=divide2` 요청에 썸네일이 없으면 원본 URL을 반환합니다.

## 주요 명령

| 명령 | 설명 |
| --- | --- |
| `npm run start:dev` | 개발 서버 실행 |
| `npm run build` | 프로덕션 빌드 |
| `npm run lint` | 정적 검사 |
| `npm test` | 단위 테스트 |
| `npm run test:e2e` | API 통합 테스트 |
| `npm run prisma:validate` | Prisma 스키마 검사 |
| `npm run db:migrate` | 개발 DB에 migration 적용 |
| `npm run db:migrate:deploy` | 운영 DB에 커밋된 migration 적용 |
| `npm run db:seed` | 개발용 예시 데이터 추가 |

## 새 데이터베이스 원칙

- 기존 DB dump, 사용자, 비밀번호를 가져오지 않습니다.
- `prisma/migrations`가 새 DB의 유일한 스키마 변경 이력입니다.
- seed는 개발·테스트 환경에서만 명시적으로 실행합니다.
- 운영 자격 증명은 Kubernetes Secret으로 주입합니다.
- 운영 migration은 애플리케이션 시작 명령과 분리합니다.
