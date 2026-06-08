# Clothing-Fit

> 사용자의 실제 체형 기반 2D·3D 가상 피팅을 통해 온라인 의류의 핏과 스타일을 직관적으로 확인할 수 있는 플랫폼

---

## 🛠 Backend 기술 스택 (Tech Stack)

| 영역            | 기술                         |
| --------------- | ---------------------------- |
| Package Manager | ![pnpm](https://img.shields.io/badge/pnpm-F69220?style=flat-square&logo=pnpm&logoColor=white) |
| Runtime         | ![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=node.js&logoColor=white) |
| Language        | ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white) |
| Framework       | ![Express](https://img.shields.io/badge/Express-000000?style=flat-square&logo=express&logoColor=white) |
| Database        | ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white) |
| ORM             | ![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=flat-square&logo=prisma&logoColor=white) |
| Authentication  | ![JWT](https://img.shields.io/badge/JWT-000000?style=flat-square&logo=jsonwebtokens&logoColor=white) |
| Security & Traffic | ![Rate Limiting](https://img.shields.io/badge/Rate--Limiting-FF6B6B?style=flat-square&logo=shield&logoColor=white) |
| Validation      | ![Zod](https://img.shields.io/badge/Zod-3E67B1?style=flat-square&logo=zod&logoColor=white) |
| API Docs        | ![Swagger](https://img.shields.io/badge/Swagger-85EA2D?style=flat-square&logo=swagger&logoColor=black) |
| Environment     | ![dotenv](https://img.shields.io/badge/dotenv-ECD53F?style=flat-square&logo=dotenv&logoColor=black) |
| Code Quality    | ![Biome](https://img.shields.io/badge/Biome-60A5FA?style=flat-square&logo=biome&logoColor=white) |
| Deployment      | ![AWS S3](https://img.shields.io/badge/AWS_S3-569A31?style=flat-square&logo=amazons3&logoColor=white) ![AWS EC2](https://img.shields.io/badge/AWS_EC2-FF9900?style=flat-square&logo=amazonec2&logoColor=white) ![AWS RDS](https://img.shields.io/badge/AWS_RDS-527FFF?style=flat-square&logo=amazonrds&logoColor=white) |

## 📂 Backend 폴더 구조 (Folder Structure)

```text
prisma/
├── schema.prisma       # Prisma 스키마 정의
└── seed.ts             # 초기 데이터 시드

src/
├── app.ts              # Express 앱 설정
├── server.ts           # 서버 실행 진입점
│
├── common/             # 전역 공통 로직
│   ├── errors/         # 커스텀 에러 및 에러 처리
│   ├── middleware/     # Express 미들웨어
│   ├── schemas/        # 공통 스키마
│   ├── types/          # 공통 타입 선언
│   └── utils/          # 유틸 함수
│
├── config/             # 환경 및 설정 파일
│
├── lib/                # 외부 시스템 연결 계층
│   ├── ai/             # AI 클라이언트 (Gemini, Meshy)
│   ├── logger/         # 로깅
│   ├── prisma/         # Prisma 클라이언트
│   └── storage/        # 파일 저장소
│
├── modules/            # 기능(도메인) 단위 모듈
│
└── routes/             # 라우트 통합

tests/                  # 테스트
```


## 📝 커밋/브랜치/PR 컨벤션 (Commit/Branch/PR Convention)

### 타입 목록

| 타입 | 설명 |
| ------------ | -------------------------------------------------- |
| **feat** | 새로운 기능 추가 |
| **fix** | 버그 수정 |
| **docs** | 문서 수정 (코드 변경 없음) |
| **style** | 코드 포맷팅, 세미콜론 등 스타일 변경 (논리 변경 없음) |
| **refactor** | 리팩토링 (기능 변화 없음) |
| **test** | 테스트 관련 코드 추가/수정 |
| **chore** | 빌드, 패키지 매니저 설정 등 기타 작업 |
| **comment** | 필요한 주석 추가 및 변경 |
| **rename** | 파일 혹은 폴더명을 수정하거나 옮기는 작업만인 경우 |
| **remove** | 파일을 삭제하는 작업만 수행한 경우 |
| **!HOTFIX** | 급하게 치명적인 버그를 고쳐야하는 경우 |

### 커밋 메시지 규칙
```text
지라티켓키 타입 : 커밋 내역
1. 설명
2. 설명
3. 설명
예시)
SCRUM-01 feat : 로그인 기능
1. 로그인 api 연결
2. 로그인 버튼 생성
3. 로그인 연결
```

### 브랜치 이름 규칙
```text
타입/제목
예시)
feat/health-check
```

### PR 제목 규칙
```text
지라티켓키 타입 : 설명
예시)
SCRUM-01 feat : 로그인 기능 구현
```

---

## 🚀 로컬 실행 방법 (Getting Started)

프로젝트를 로컬 환경에서 실행하고 테스트하는 방법입니다.

### 1. 레포지토리 클론 및 폴더 이동

```bash
git clone https://github.com/prgrms-fullcycle-devcourse/webfull_9_10_ClothingFit_BE

cd webfull_9_10_ClothingFit_BE
```

### 2. 패키지 설치

```bash
pnpm install
```

### 3. 환경 변수 설정

프로젝트 최상위 경로에 `.env` 파일을 생성하고 `.env.example`을 참고하여 환경 변수를 채워주세요.

### 4. 프로젝트 실행

```bash
pnpm dev        # 개발 모드 실행

pnpm build      # 프로덕션 빌드

pnpm start      # 프로덕션 실행
```

---

## 🧑‍💻 팀원 소개 (Team)

| 프로필                                                         | 이름   | 역할      | GitHub                                             |
| ------------------------------------------------------------- | ------ | --------- | -------------------------------------------------- |
| <img src="https://github.com/hollyjelly.png" width="50" />    | 나현지 | Fitting / Closet | [@hollyjelly](https://github.com/hollyjelly)  |
| <img src="https://github.com/doeun9903.png" width="50" />     | 박도은 | Auth / Profile / Users | [@doeun9903](http://github.com/doeun9903) |
| <img src="https://github.com/s576air.png" width="50" />       | 한재민 | Notifications / Posts | [@s576air](https://github.com/s576air)   |
