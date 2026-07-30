# CarbonLedger AI - 설치 및 운영 가이드 (한국어)

> CarbonLedger AI 플랫폼을 처음부터 운영 환경까지 설정하기 위한 전체 가이드입니다.

---

## 목차

1. [사전 준비물](#1-사전-준비물)
2. [Supabase 프로젝트 생성 및 설정](#2-supabase-프로젝트-생성-및-설정)
3. [환경변수 설정](#3-환경변수-설정)
4. [데이터베이스 마이그레이션 실행](#4-데이터베이스-마이그레이션-실행)
5. [RLS 정책 적용](#5-rls-정책-적용)
6. [시드 데이터 삽입](#6-시드-데이터-삽입)
7. [Supabase Storage 버킷 생성](#7-supabase-storage-버킷-생성)
8. [OpenAI API 키 발급 및 설정](#8-openai-api-키-발급-및-설정)
9. [로컬 개발 서버 실행 방법](#9-로컬-개발-서버-실행-방법)
10. [Vercel 배포 방법](#10-vercel-배포-방법)
11. [GitHub Actions Secrets 설정](#11-github-actions-secrets-설정)
12. [커스텀 도메인 설정](#12-커스텀-도메인-설정)
13. [첫 번째 Super Admin 계정 생성](#13-첫-번째-super-admin-계정-생성)
14. [회사/사업장 초기 데이터 등록](#14-회사사업장-초기-데이터-등록)
15. [배출계수 버전 선택 및 활성화](#15-배출계수-버전-선택-및-활성화)
16. [문제 해결 (FAQ / Troubleshooting)](#16-문제-해결-faq--troubleshooting)

---

## 1. 사전 준비물

CarbonLedger AI를 운영하기 위해 아래 항목들이 필요합니다.

### 필수 계정

| 항목 | 용도 | 가입 URL |
|------|------|----------|
| Supabase 계정 | 데이터베이스, 인증, 스토리지 | https://supabase.com |
| OpenAI 계정 | AI 분석 기능 (GPT API) | https://platform.openai.com |
| Vercel 계정 | 프론트엔드 배포 | https://vercel.com |
| GitHub 계정 | 소스 코드 관리, CI/CD | https://github.com |

### 필수 도구 (로컬 개발)

| 도구 | 최소 버전 | 설치 확인 명령 |
|------|-----------|----------------|
| Node.js | v22.x | `node --version` |
| pnpm | v10.x | `pnpm --version` |
| Git | v2.x | `git --version` |
| Supabase CLI | 최신 | `npx supabase --version` |
| Docker (선택) | v24.x | `docker --version` |

### 설치 명령

```bash
# Node.js (nvm 사용 권장)
nvm install 22
nvm use 22

# pnpm 설치
corepack enable
corepack prepare pnpm@latest --activate

# Supabase CLI (npx로 사용 가능, 전역 설치 선택)
npm install -g supabase
```

> **주의:** Windows 환경에서는 WSL2 사용을 강력히 권장합니다.

---

## 2. Supabase 프로젝트 생성 및 설정

### 2.1 프로젝트 생성

1. [Supabase 대시보드](https://supabase.com/dashboard)에 로그인합니다.
2. **"New Project"** 버튼을 클릭합니다.
3. 다음 정보를 입력합니다:
   - **Organization:** 조직 선택 또는 새로 생성
   - **Project name:** `carbonledger-ai` (또는 원하는 이름)
   - **Database password:** 강력한 비밀번호 설정 (반드시 기록해 둘 것)
   - **Region:** `Northeast Asia (Seoul)` 선택 (한국 사용자 기준)
   - **Pricing Plan:** 프로덕션은 Pro 플랜 권장

4. **"Create new project"** 클릭 후 프로비저닝이 완료될 때까지 대기합니다 (약 2분).

### 2.2 프로젝트 정보 확인

프로젝트 생성 후 **Settings > API** 메뉴에서 아래 값들을 확인합니다:

| 항목 | 위치 | 환경변수명 |
|------|------|------------|
| Project URL | Settings > API > Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| anon public key | Settings > API > Project API keys | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| service_role key | Settings > API > Project API keys | `SUPABASE_SERVICE_ROLE_KEY` |
| Connection string | Settings > Database > Connection string | `DATABASE_URL` |

> **주의:** `service_role` 키는 절대로 클라이언트 코드에 노출하지 마세요. 서버 측에서만 사용해야 합니다.

### 2.3 인증 설정

1. **Authentication > Providers** 메뉴로 이동합니다.
2. **Email** 프로바이더가 활성화되어 있는지 확인합니다.
3. **Authentication > URL Configuration**에서 리다이렉트 URL을 설정합니다:

```
# 로컬 개발
http://localhost:3000/auth/callback

# 프로덕션 (배포 후 추가)
https://your-domain.com/auth/callback
```

4. (선택) Google OAuth, Microsoft Azure AD 등 추가 인증 프로바이더를 설정합니다.

---

## 3. 환경변수 설정

프로젝트 루트에 `.env.local` 파일을 생성합니다.

```bash
cp .env.example .env.local
```

`.env.local` 파일을 열어 실제 값으로 교체합니다:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghij.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Database (Supabase > Settings > Database > Connection string > URI)
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres

# OpenAI
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=CarbonLedger AI

# Optional: Analytics (PostHog)
NEXT_PUBLIC_POSTHOG_KEY=phc_xxxxxxxxxxxxxxxx
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

> **주의:**
> - `.env.local` 파일은 `.gitignore`에 포함되어 있으므로 Git에 커밋되지 않습니다.
> - `DATABASE_URL`에는 Supabase의 **Connection Pooler** URI를 사용하세요 (포트 6543).
> - 직접 연결이 필요한 경우(마이그레이션 등) 포트 5432를 사용합니다.

---

## 4. 데이터베이스 마이그레이션 실행

### 4.1 Supabase CLI를 이용한 마이그레이션

```bash
# Supabase CLI 로그인
npx supabase login

# 프로젝트 연결 (project-ref는 Supabase 대시보드 URL에서 확인)
npx supabase link --project-ref your-project-ref

# 마이그레이션 실행
npx supabase db push
```

### 4.2 마이그레이션 파일 구조

```
supabase/
  migrations/
    0002_rls_policies.sql    # RLS 정책 정의
  seed.sql                   # 샘플 데이터
```

### 4.3 Drizzle ORM을 이용한 마이그레이션 (대안)

```bash
# 마이그레이션 파일 생성
pnpm db:generate

# 마이그레이션 적용
pnpm db:migrate

# 또는 스키마를 직접 푸시 (개발 환경)
pnpm db:push
```

> **주의:**
> - 마이그레이션은 순서대로 실행됩니다. 파일명의 번호 순서를 변경하지 마세요.
> - 프로덕션 환경에서는 반드시 `db:migrate`를 사용하고 `db:push`는 사용하지 마세요.

---

## 5. RLS 정책 적용

Row Level Security(RLS)는 멀티테넌트 데이터 격리를 보장합니다.

### 5.1 자동 적용 (마이그레이션 포함)

`npx supabase db push` 실행 시 `0002_rls_policies.sql` 파일이 자동으로 적용됩니다.

### 5.2 수동 적용

Supabase SQL Editor에서 직접 실행할 경우:

1. **Supabase 대시보드 > SQL Editor** 이동
2. `supabase/migrations/0002_rls_policies.sql` 파일 내용을 복사하여 붙여넣기
3. **Run** 클릭

### 5.3 적용된 RLS 정책 확인

```sql
-- RLS 활성화 상태 확인
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- 정책 목록 확인
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public';
```

### 5.4 주요 정책 요약

| 테이블 | 정책 | 설명 |
|--------|------|------|
| companies | users_view_own_company | 자사 정보만 조회 가능 |
| emission_records | company_view_emissions | 자사 배출 데이터만 조회 |
| emission_records | writer_create_emissions | admin/site_admin만 생성 가능 |
| emission_factors | all_view_emission_factors | 모든 인증 사용자 조회 가능 |
| audit_logs | company_view_audit_logs | 자사 감사 로그만 조회 (수정/삭제 불가) |

> **주의:** RLS 정책은 `service_role` 키를 사용할 때는 우회됩니다. 서버 측 관리 작업에서만 사용하세요.

---

## 6. 시드 데이터 삽입

개발/테스트 환경에서 샘플 데이터를 삽입합니다.

### 6.1 Supabase CLI로 삽입

```bash
npx supabase db seed
```

### 6.2 SQL Editor에서 직접 실행

1. Supabase 대시보드 > **SQL Editor** 이동
2. `supabase/seed.sql` 파일 내용을 복사하여 실행

### 6.3 삽입되는 샘플 데이터

| 항목 | 내용 |
|------|------|
| 회사 | 한국제조 주식회사 (제조업) |
| 사업장 | 울산 본사 공장, 인천 제2공장 |
| 시설 | 보일러동, 차량관리동, 전기실, 냉동설비동 |
| 사용자 | 5명 (company_admin, site_admin, reviewer, auditor, viewer) |
| 배출원 | 4개 (LNG 보일러, 경유 차량, 전력, 냉매 누출) |
| 배출 기록 | 2024년 상반기 월별/분기별 데이터 |
| 배출계수 | 환경부 2023년, IPCC AR6 기준 |
| 감축 목표 | 2030년 50% 절대량 감축, Scope 2 전환 목표 |

> **주의:** 시드 데이터는 개발/테스트 용도입니다. 프로덕션 환경에서는 실행하지 마세요.

---

## 7. Supabase Storage 버킷 생성

보고서, 증빙 문서 등의 파일 업로드를 위해 Storage 버킷을 생성합니다.

### 7.1 대시보드에서 생성

1. **Supabase 대시보드 > Storage** 이동
2. **"New bucket"** 클릭
3. 아래 버킷들을 생성합니다:

| 버킷 이름 | Public | 용도 |
|-----------|--------|------|
| `reports` | No | 생성된 보고서 PDF/Excel 파일 |
| `evidence` | No | 배출량 산정 증빙 자료 |
| `imports` | No | 데이터 임포트용 CSV/Excel 파일 |
| `avatars` | Yes | 사용자 프로필 이미지 |

### 7.2 SQL로 생성

Supabase SQL Editor에서 실행:

```sql
-- 버킷 생성
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('reports', 'reports', false),
  ('evidence', 'evidence', false),
  ('imports', 'imports', false),
  ('avatars', 'avatars', true);
```

### 7.3 Storage RLS 정책 설정

```sql
-- reports 버킷: 자사 파일만 접근
CREATE POLICY "company_access_reports" ON storage.objects
  FOR ALL USING (
    bucket_id = 'reports'
    AND (storage.foldername(name))[1] = auth.user_company_id()::text
  );

-- evidence 버킷: 자사 증빙만 접근
CREATE POLICY "company_access_evidence" ON storage.objects
  FOR ALL USING (
    bucket_id = 'evidence'
    AND (storage.foldername(name))[1] = auth.user_company_id()::text
  );

-- avatars 버킷: 본인 파일만 업로드, 모두 조회 가능
CREATE POLICY "users_upload_own_avatar" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "public_view_avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');
```

> **주의:** 파일 업로드 시 경로 규칙을 `{company_id}/{filename}` 형태로 유지해야 RLS 정책이 올바르게 작동합니다.

---

## 8. OpenAI API 키 발급 및 설정

AI 기반 배출량 분석, 보고서 자동 생성 기능을 사용하려면 OpenAI API 키가 필요합니다.

### 8.1 API 키 발급

1. [OpenAI Platform](https://platform.openai.com)에 로그인합니다.
2. **API Keys** 메뉴로 이동합니다 (https://platform.openai.com/api-keys).
3. **"Create new secret key"** 클릭합니다.
4. 키 이름을 입력합니다 (예: `carbonledger-production`).
5. 생성된 키를 즉시 복사합니다 (다시 확인할 수 없음).

### 8.2 결제 설정

1. **Billing** 메뉴에서 결제 수단을 등록합니다.
2. **Usage limits**를 설정하여 과도한 비용을 방지합니다:
   - Monthly budget: 프로젝트 규모에 맞게 설정 (예: $50)
   - Notification threshold: 예산의 80% 도달 시 알림

### 8.3 권장 모델 설정

CarbonLedger AI에서 사용하는 주요 모델:

| 기능 | 권장 모델 | 용도 |
|------|-----------|------|
| 데이터 분석 | gpt-4o | 배출량 패턴 분석, 이상치 탐지 |
| 보고서 생성 | gpt-4o | GHG 보고서 초안 작성 |
| 간단 질의 | gpt-4o-mini | 간단한 질문 응답, 분류 |

### 8.4 환경변수에 적용

```env
# .env.local
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx
```

> **주의:**
> - API 키를 클라이언트 코드에 절대 노출하지 마세요. 서버 측 API Route에서만 사용합니다.
> - 조직(Organization) 설정에서 프로젝트별 API 키를 분리 사용하는 것을 권장합니다.
> - Rate limit에 주의하세요. Tier 1 계정은 분당 요청 수가 제한됩니다.

---

## 9. 로컬 개발 서버 실행 방법

### 9.1 의존성 설치

```bash
# 프로젝트 클론
git clone https://github.com/musclebreadbread-stack/carbonledger-ai.git
cd carbonledger-ai

# 의존성 설치
pnpm install
```

### 9.2 환경변수 설정 확인

```bash
# .env.local 파일이 존재하는지 확인
ls -la .env.local

# 없으면 생성
cp .env.example .env.local
# 실제 값으로 수정
```

### 9.3 개발 서버 실행

```bash
# Next.js 개발 서버 실행
pnpm dev
```

브라우저에서 http://localhost:3000 으로 접속합니다.

### 9.4 Docker를 이용한 실행 (선택)

로컬 PostgreSQL과 함께 전체 스택을 실행하려면:

```bash
# Docker Compose로 실행
docker compose up -d

# 로그 확인
docker compose logs -f app
```

서비스 구성:
- **app:** Next.js 애플리케이션 (http://localhost:3000)
- **db:** PostgreSQL 15 (localhost:5432)
- **supabase-studio:** Supabase Studio UI (http://localhost:3001)

### 9.5 유용한 개발 명령어

```bash
# 타입 체크
pnpm typecheck

# 린트
pnpm lint

# 테스트 실행
pnpm test

# 테스트 (감시 모드)
pnpm test:watch

# 코드 포매팅
pnpm format

# Drizzle Studio (DB GUI)
pnpm db:studio
```

> **주의:** 로컬 개발 시에도 Supabase 클라우드 프로젝트에 연결하여 Auth와 Storage를 사용하는 것이 권장됩니다. Docker 환경의 DB는 스키마 테스트 용도로만 사용하세요.

---

## 10. Vercel 배포 방법

### 10.1 Vercel 프로젝트 생성

1. [Vercel](https://vercel.com)에 로그인합니다.
2. **"Add New Project"** 클릭합니다.
3. GitHub 저장소 `musclebreadbread-stack/carbonledger-ai`를 Import 합니다.
4. 프레임워크 프리셋: **Next.js** (자동 감지됨)
5. 빌드 설정 확인:
   - **Build Command:** `pnpm build`
   - **Output Directory:** `.next`
   - **Install Command:** `pnpm install`

### 10.2 환경변수 설정

Vercel 대시보드 > **Settings > Environment Variables**에서 아래 변수들을 추가합니다:

| 변수명 | 환경 | 값 |
|--------|------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview, Development | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview, Development | Supabase anon 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | Production, Preview | Service role 키 |
| `DATABASE_URL` | Production | PostgreSQL 연결 문자열 |
| `OPENAI_API_KEY` | Production | OpenAI API 키 |
| `NEXT_PUBLIC_APP_URL` | Production | `https://your-domain.com` |
| `NEXT_PUBLIC_APP_NAME` | Production, Preview, Development | `CarbonLedger AI` |

### 10.3 배포 실행

```bash
# main 브랜치에 push하면 자동 배포
git push origin main
```

또는 Vercel 대시보드에서 수동 배포:
1. **Deployments** 탭 이동
2. **"Redeploy"** 버튼 클릭

### 10.4 배포 확인

1. Vercel 대시보드에서 배포 상태를 확인합니다.
2. 빌드 로그에서 에러가 없는지 확인합니다.
3. 배포된 URL로 접속하여 정상 동작을 확인합니다.

### 10.5 Preview 배포

- `main` 이외의 브랜치에 Push하면 자동으로 Preview 배포가 생성됩니다.
- Pull Request에 Preview URL이 자동으로 댓글에 추가됩니다.

> **주의:**
> - Preview 환경에서는 프로덕션 DB에 연결하지 마세요. 별도의 Supabase 프로젝트를 사용하거나, Preview 전용 환경변수를 설정하세요.
> - `SUPABASE_SERVICE_ROLE_KEY`는 Production과 Preview 환경에만 설정합니다.

---

## 11. GitHub Actions Secrets 설정

CI/CD 파이프라인이 정상적으로 동작하려면 GitHub Secrets를 설정해야 합니다.

### 11.1 Secrets 설정 방법

1. GitHub 저장소 > **Settings > Secrets and variables > Actions** 이동
2. **"New repository secret"** 클릭
3. 아래 Secrets를 추가합니다:

| Secret 이름 | 값 | 용도 |
|-------------|-----|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | CI 빌드 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon 키 | CI 빌드 |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role 키 | 테스트/배포 |
| `DATABASE_URL` | PostgreSQL 연결 문자열 | 마이그레이션 |
| `OPENAI_API_KEY` | OpenAI API 키 | AI 기능 테스트 |
| `VERCEL_TOKEN` | Vercel 개인 액세스 토큰 | 자동 배포 |
| `VERCEL_ORG_ID` | Vercel 조직 ID | 자동 배포 |
| `VERCEL_PROJECT_ID` | Vercel 프로젝트 ID | 자동 배포 |

### 11.2 Vercel 토큰 발급

1. [Vercel 설정](https://vercel.com/account/tokens) 이동
2. **"Create Token"** 클릭
3. 토큰 이름과 만료 기간 설정
4. 생성된 토큰을 GitHub Secret에 저장

### 11.3 Vercel 프로젝트 ID 확인

```bash
# Vercel CLI 설치 (선택)
pnpm add -g vercel

# 프로젝트 연결 (처음 한 번)
vercel link

# .vercel/project.json에서 projectId와 orgId 확인
cat .vercel/project.json
```

### 11.4 CI 파이프라인 구성

현재 설정된 CI 파이프라인 (`.github/workflows/ci.yml`):

- **lint:** ESLint 검사
- **typecheck:** TypeScript 타입 검사
- **test:** Vitest 단위 테스트
- **build:** Next.js 빌드 검증

모든 작업이 통과해야 `main` 브랜치 머지가 가능합니다.

> **주의:**
> - Secrets는 Fork된 저장소의 PR에서는 사용할 수 없습니다.
> - `VERCEL_TOKEN`은 주기적으로 갱신하세요.

---

## 12. 커스텀 도메인 설정

### 12.1 Vercel에 도메인 추가

1. Vercel 대시보드 > **Settings > Domains** 이동
2. 도메인 입력 (예: `carbon.yourcompany.co.kr`)
3. **"Add"** 클릭

### 12.2 DNS 레코드 설정

도메인 등록 업체 (가비아, 후이즈, AWS Route 53 등)에서 DNS 레코드를 추가합니다:

**루트 도메인 사용 시:**

| 타입 | 호스트 | 값 |
|------|--------|-----|
| A | @ | `76.76.21.21` |

**서브도메인 사용 시:**

| 타입 | 호스트 | 값 |
|------|--------|-----|
| CNAME | carbon (또는 원하는 서브도메인) | `cname.vercel-dns.com` |

### 12.3 SSL 인증서

Vercel에서 SSL 인증서를 자동으로 발급합니다. DNS 설정 후 최대 48시간이 소요될 수 있으나, 대부분 수분 내에 완료됩니다.

### 12.4 Supabase 리다이렉트 URL 업데이트

도메인 설정 후 Supabase 인증 리다이렉트 URL을 업데이트합니다:

1. Supabase 대시보드 > **Authentication > URL Configuration**
2. **Redirect URLs**에 추가:

```
https://carbon.yourcompany.co.kr/auth/callback
```

### 12.5 환경변수 업데이트

Vercel 환경변수를 업데이트합니다:

```env
NEXT_PUBLIC_APP_URL=https://carbon.yourcompany.co.kr
```

> **주의:** DNS 전파에 시간이 걸릴 수 있습니다. `nslookup` 또는 `dig` 명령으로 확인하세요.

---

## 13. 첫 번째 Super Admin 계정 생성

### 13.1 Supabase Auth로 사용자 생성

1. Supabase 대시보드 > **Authentication > Users** 이동
2. **"Add user" > "Create new user"** 클릭
3. 이메일과 비밀번호를 입력합니다
4. **"Auto Confirm User"** 체크박스를 선택합니다

### 13.2 사용자 메타데이터 설정

Supabase SQL Editor에서 실행합니다:

```sql
-- 1. 먼저 회사 레코드가 있어야 합니다 (없으면 생성)
INSERT INTO companies (id, name, industry, country, registration_number, fiscal_year_start)
VALUES (
  gen_random_uuid(),
  '우리 회사명',
  'manufacturing',
  'South Korea',
  '000-00-00000',
  1
)
RETURNING id;
-- 반환된 company_id를 아래에서 사용합니다

-- 2. Auth 사용자의 메타데이터에 role과 company_id 설정
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{role}',
    '"super_admin"'
  ),
  '{company_id}',
  '"여기에-company-id-입력"'
)
WHERE email = 'admin@yourcompany.com';

-- 3. users 테이블에 레코드 생성
INSERT INTO users (id, company_id, email, full_name, role, status)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'admin@yourcompany.com'),
  '여기에-company-id-입력',
  'admin@yourcompany.com',
  '관리자 이름',
  'super_admin',
  'active'
);
```

### 13.3 로그인 확인

1. 애플리케이션에 접속합니다.
2. 생성한 이메일/비밀번호로 로그인합니다.
3. 관리자 대시보드에 접근 가능한지 확인합니다.

### 13.4 역할(Role) 체계

| 역할 | 권한 |
|------|------|
| `super_admin` | 모든 기능 접근, 사용자 관리, 회사 설정 |
| `company_admin` | 회사 내 모든 기능, 사용자 관리 |
| `site_admin` | 담당 사업장 데이터 입력/관리 |
| `reviewer` | 데이터 검토 및 승인 |
| `auditor` | 읽기 전용 감사 접근 |
| `viewer` | 읽기 전용 |

> **주의:** super_admin 계정은 최소한으로 유지하세요. 일반 업무에는 company_admin 이하 역할을 사용합니다.

---

## 14. 회사/사업장 초기 데이터 등록

### 14.1 회사 정보 등록

Super Admin으로 로그인 후 관리 메뉴에서 등록하거나, SQL로 직접 등록합니다:

```sql
INSERT INTO companies (id, name, industry, country, registration_number, fiscal_year_start)
VALUES (
  gen_random_uuid(),
  '한국제조 주식회사',
  'manufacturing',    -- manufacturing, energy, logistics, construction, etc.
  'South Korea',
  '123-45-67890',     -- 사업자등록번호
  1                   -- 회계연도 시작월 (1=1월)
);
```

### 14.2 사업장(Site) 등록

```sql
INSERT INTO sites (id, company_id, name, address, latitude, longitude, grid_region)
VALUES
  (gen_random_uuid(), '회사-id', '울산 본사 공장', '울산광역시 남구 산업로 123', 35.5384, 129.3114, 'Korea'),
  (gen_random_uuid(), '회사-id', '인천 제2공장', '인천광역시 서구 경서동 456', 37.4563, 126.7052, 'Korea');
```

### 14.3 시설(Facility) 등록

```sql
INSERT INTO facilities (id, site_id, name, type)
VALUES
  (gen_random_uuid(), '사업장-id', '보일러동', 'boiler_house'),
  (gen_random_uuid(), '사업장-id', '전기실', 'electrical'),
  (gen_random_uuid(), '사업장-id', '차량관리동', 'vehicle_depot'),
  (gen_random_uuid(), '사업장-id', '냉동설비동', 'refrigeration');
```

### 14.4 배출원(Emission Source) 등록

```sql
INSERT INTO emission_sources (id, company_id, site_id, facility_id, name, scope, category, fuel_type, description)
VALUES (
  gen_random_uuid(),
  '회사-id',
  '사업장-id',
  '시설-id',
  '산업용 보일러 #1',
  'scope1',                    -- scope1, scope2, scope3
  'stationary_combustion',     -- 카테고리
  'lng',                       -- 연료 타입
  'LNG 연소 보일러 (증기 생산)'
);
```

### 14.5 조직 경계 설정 체크리스트

- [ ] 모든 사업장이 등록되었는가?
- [ ] 각 사업장의 시설이 빠짐없이 등록되었는가?
- [ ] Scope 1/2 배출원이 모두 식별되었는가?
- [ ] 연료 타입과 사용량 단위가 정확한가?
- [ ] GPS 좌표가 올바른가? (지도 표시용)

> **주의:** 조직 경계는 GHG Protocol에 따라 지분법(equity share) 또는 경영통제법(operational control)으로 설정합니다. 한번 설정한 접근법은 일관되게 유지해야 합니다.

---

## 15. 배출계수 버전 선택 및 활성화

### 15.1 배출계수 개요

CarbonLedger AI는 다양한 배출계수 소스를 지원합니다:

| 제공처 | 버전 | 적용 범위 | 용도 |
|--------|------|-----------|------|
| 환경부 (Korea MOE) | 2023 | 한국 | 국내 법정 보고 |
| IPCC AR6 | 2021 | 글로벌 | 국제 보고, 냉매 등 |
| GHG Protocol | 2023 | 글로벌 | CDP, SBTi 보고 |

### 15.2 배출계수 데이터 확인

시드 데이터에 포함된 배출계수:

```sql
-- 현재 등록된 배출계수 확인
SELECT provider, version, fuel_type, scope, co2_factor, unit, category, region
FROM emission_factors
ORDER BY provider, fuel_type;
```

### 15.3 배출계수 추가 등록

환경부 고시 기준 추가 배출계수를 등록합니다:

```sql
INSERT INTO emission_factors (id, provider, version, fuel_type, scope, co2_factor, ch4_factor, n2o_factor, unit, category, region, valid_from, valid_to)
VALUES
  -- LPG (프로판)
  (gen_random_uuid(), 'Korea MOE', '2023', 'lpg_propane', 'scope1', 2.900, 0.00006, 0.000001, 'kgCO2/kg', 'stationary_combustion', 'Korea', '2023-01-01', '2023-12-31'),
  -- 등유
  (gen_random_uuid(), 'Korea MOE', '2023', 'kerosene', 'scope1', 2.441, 0.00012, 0.000002, 'kgCO2/L', 'stationary_combustion', 'Korea', '2023-01-01', '2023-12-31'),
  -- B-C유
  (gen_random_uuid(), 'Korea MOE', '2023', 'bunker_c', 'scope1', 3.114, 0.00018, 0.000004, 'kgCO2/L', 'stationary_combustion', 'Korea', '2023-01-01', '2023-12-31');
```

### 15.4 연도별 배출계수 업데이트

매년 환경부 고시가 갱신되면 새 버전을 등록합니다:

```sql
-- 2024년 버전 등록 예시
INSERT INTO emission_factors (id, provider, version, fuel_type, scope, co2_factor, ch4_factor, n2o_factor, unit, category, region, valid_from, valid_to)
VALUES (
  gen_random_uuid(),
  'Korea MOE',
  '2024',
  'grid_electricity',
  'scope2',
  0.4450,  -- 2024년 전력 배출계수 (예시)
  0.0000050,
  0.0000068,
  'kgCO2/kWh',
  'purchased_electricity',
  'Korea',
  '2024-01-01',
  '2024-12-31'
);
```

### 15.5 활성 버전 선택

배출량 산정 시 적용할 배출계수 버전을 선택합니다:

```sql
-- 특정 기간에 해당하는 배출계수 조회
SELECT *
FROM emission_factors
WHERE provider = 'Korea MOE'
  AND valid_from <= '2024-01-01'
  AND valid_to >= '2024-12-31';
```

> **주의:**
> - 배출계수는 보고 연도에 맞는 버전을 사용해야 합니다.
> - 환경부 온실가스 종합정보센터(NGMS)에서 최신 배출계수를 확인하세요.
> - 과거 데이터 소급 수정 시 해당 연도의 배출계수를 적용해야 합니다.

---

## 16. 문제 해결 (FAQ / Troubleshooting)

### 빌드 실패

**증상:** `pnpm build` 실행 시 에러 발생

```bash
# 해결 방법
# 1. node_modules 재설치
rm -rf node_modules .next
pnpm install

# 2. 환경변수 확인
cat .env.local  # NEXT_PUBLIC_ 변수들이 설정되어 있는지 확인

# 3. TypeScript 에러 확인
pnpm typecheck
```

---

### 데이터베이스 연결 실패

**증상:** `Error: connection refused` 또는 `ECONNREFUSED`

**확인 사항:**
1. `DATABASE_URL` 형식이 올바른지 확인:
   ```
   postgresql://postgres.[project-ref]:[password]@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres
   ```
2. Supabase 대시보드에서 Database 상태 확인
3. Connection Pooler가 활성화되어 있는지 확인 (Serverless 환경 필수)
4. 비밀번호에 특수문자가 있으면 URL 인코딩 필요

---

### 인증이 작동하지 않음

**증상:** 로그인 후 리다이렉트 실패 또는 세션 유지 안됨

**확인 사항:**
1. Supabase Authentication > URL Configuration에서 Redirect URL 확인
2. `NEXT_PUBLIC_SUPABASE_URL`이 올바른지 확인
3. 쿠키가 올바르게 설정되는지 브라우저 개발자 도구에서 확인
4. HTTPS 환경에서 `Secure` 쿠키 속성 확인

```bash
# 리다이렉트 URL 예시
# 개발: http://localhost:3000/auth/callback
# 프로덕션: https://your-domain.com/auth/callback
```

---

### RLS 정책으로 인한 데이터 접근 불가

**증상:** 데이터가 있는데 빈 결과가 반환됨

**확인 사항:**
1. 사용자의 JWT 메타데이터에 `company_id`와 `role`이 설정되어 있는지 확인:

```sql
-- 사용자 메타데이터 확인
SELECT raw_user_meta_data FROM auth.users WHERE email = 'user@example.com';
```

2. RLS 정책 우회 테스트 (service_role 키 사용):

```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // RLS 우회
)

const { data } = await supabase.from('companies').select('*')
console.log(data)  // 데이터가 보이면 RLS 정책 문제
```

---

### OpenAI API 오류

**증상:** AI 기능 사용 시 에러 발생

| 에러 코드 | 원인 | 해결 방법 |
|-----------|------|-----------|
| 401 | API 키 무효 | 키 재발급 후 환경변수 업데이트 |
| 429 | Rate limit 초과 | 요청 간격 조절, 상위 Tier 업그레이드 |
| 500 | OpenAI 서버 오류 | 잠시 후 재시도 |
| insufficient_quota | 크레딧 소진 | 결제 수단 확인 및 충전 |

---

### Vercel 배포 실패

**증상:** 배포 시 빌드 에러

**확인 사항:**
1. 모든 환경변수가 Vercel에 설정되어 있는지 확인
2. `pnpm-lock.yaml`이 커밋되어 있는지 확인
3. 로컬에서 `pnpm build`가 성공하는지 확인
4. Node.js 버전이 22.x인지 확인 (Vercel Settings > General > Node.js Version)

---

### Storage 업로드 실패

**증상:** 파일 업로드 시 403 또는 권한 에러

**확인 사항:**
1. Storage 버킷이 생성되어 있는지 확인
2. Storage RLS 정책이 올바르게 설정되어 있는지 확인
3. 파일 경로가 `{company_id}/{filename}` 형식인지 확인
4. 파일 크기 제한 확인 (기본 50MB)

---

### Docker 환경 문제

**증상:** `docker compose up` 실패

```bash
# 기존 컨테이너/볼륨 정리
docker compose down -v

# 이미지 다시 빌드
docker compose build --no-cache

# 재실행
docker compose up -d

# 로그 확인
docker compose logs -f
```

---

### 마이그레이션 충돌

**증상:** `supabase db push` 실행 시 충돌 에러

```bash
# 마이그레이션 상태 확인
npx supabase migration list

# 리모트 DB 상태와 비교
npx supabase db diff

# 특정 마이그레이션 복구 (주의: 데이터 손실 가능)
npx supabase migration repair --status applied 0002_rls_policies
```

---

### 성능 문제

**증상:** 페이지 로딩이 느림

**확인 사항:**
1. Supabase Connection Pooler 사용 여부 확인 (포트 6543)
2. 인덱스가 올바르게 생성되어 있는지 확인
3. Vercel Edge Network 활용 확인
4. 대용량 쿼리에 페이지네이션 적용 여부 확인

```sql
-- 느린 쿼리 확인
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

---

### 추가 도움이 필요한 경우

- **Supabase 문서:** https://supabase.com/docs
- **Next.js 문서:** https://nextjs.org/docs
- **Vercel 문서:** https://vercel.com/docs
- **GitHub Issues:** https://github.com/musclebreadbread-stack/carbonledger-ai/issues
- **환경부 온실가스 종합정보센터:** https://ngms.gir.go.kr

