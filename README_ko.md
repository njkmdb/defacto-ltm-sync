# Defacto LTM-Sync Context Manager

| [🇺🇸 English](README.md) | [🇰🇷 한국어](README_ko.md) | [🇯🇵 日本語](README_ja.md) |

![100% AI Generated](https://img.shields.io/badge/100%25_AI_Generated-8A2BE2?style=flat&logo=googlegemini&logoColor=white)
![Version](https://img.shields.io/badge/version-v0.3.3-4F46E5?style=flat)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white)
![Google BigQuery](https://img.shields.io/badge/Google_BigQuery-669DF6?style=flat&logo=googlecloud&logoColor=white)

현장에서 발생한 파편화된 [단기 이벤트]를, 과거의 [특정 기억(LTM)]과 결합하여, 가장 건조하고 정확한 [단문 요약본], [심층 리포트], 그리고 [2차 창작물]로 만들어 내는 컨텍스트 매니저입니다.

* **특징:**  
영업 일지, 게임 퀘스트, 다이어리 등 도메인에 구애받지 않는 범용 프레임워크를 제공합니다.

* **인프라 환경:**  
PostgreSQL (로컬/운영 DB) 기반의 단독 구동을 기본으로 지원하며, 대규모 데이터 확장이 필요할 경우 Datastream ➡️ BigQuery(아카이브 적재)와 연동하여 '하이브리드 투트랙 RAG 검색 시스템'으로 스케일업할 수 있습니다 **(BigQuery 연동은 선택 옵션)**. 오디오 및 이미지뿐만 아니라 PDF/CSV 등 문서 파일까지 포함하는 멀티모달 데이터를 지원하며, 클라우드 스토리지 대신 로컬 스토리지를 활용하여 네트워크 비용을 원천 차단합니다.

* **멀티 테넌트(Multi-Tenant) 보안:**  
API DTO 단계부터 코어 RAG 엔진(Cross-Entity Vector Search)의 가장 깊은 곳까지 `base_entity_id` 기반의 철저한 데이터 격리(Isolation) 아키텍처가 적용되어, 타사의 기밀 데이터가 검색되거나 LLM 컨텍스트에 혼입되는 것을 100% 원천 차단합니다.

* **노드 기반 프레임워크 (Headless Engine):**  
하드코딩된 비즈니스 로직을 완전히 분리하고, 프론트엔드에서 전달받은 '파이프라인 설계도(Pipeline Config)'를 읽어 순차적으로 작업을 수행하는 오케스트레이터(Orchestrator) 기반으로 동작합니다. 백엔드 재배포 없이 시스템의 동작 흐름을 무한히 생성하고 확장할 수 있습니다.

---

## 1. Getting Started (로컬 실행 가이드)

본 프로젝트는 Docker를 통해 모든 환경(DB, Backend, Frontend)이 컨테이너화되어 있어, 복잡한 환경 설정 없이 단 한 줄의 명령어로 기동할 수 있습니다.

### 1.1. 사전 준비 (Prerequisites)
시스템을 기동하려면 로컬 PC에 **Docker**가 설치되어 있어야 합니다.
* **[Docker Desktop 다운로드](https://www.docker.com/products/docker-desktop/)** (Windows / Mac 공통)
  > 설치 후 Docker Desktop 애플리케이션을 실행해 둔 상태여야 합니다.

### 1.2. LRSE 미들웨어 기동 (필수 💡)
이 시스템은 LLM 환각 제어를 위해 분리된 `LRSE` 미들웨어 서버(8081 포트)와 통신합니다. 백엔드를 띄우기 전 미들웨어를 먼저 실행해 주세요.
1. LRSE 저장소 클론: `git clone [https://github.com/njkmdb/llm-rpc-schema-enforcer](https://github.com/njkmdb/llm-rpc-schema-enforcer)`
2. 해당 폴더로 이동 후 컨테이너 기동:
```bash
docker-compose up --build -d
```

### 1.3. Defacto LTM-Sync 환경 변수 세팅
1. 본 저장소를 클론하고 폴더로 이동합니다.
   `git clone [https://github.com/njkmdb/defacto-ltm-sync](https://github.com/njkmdb/defacto-ltm-sync)`
2. 최상단 디렉토리에 있는 `.env.example` 파일의 이름을 **`.env`**로 변경합니다.
3. `.env` 파일을 열고 본인의 **Gemini API Key**를 발급받아 입력합니다.

### 1.4. 도커 컨테이너 일괄 기동
터미널에 아래 명령어를 입력하여 시스템을 기동합니다.

* **최초 기동 시 (이미지 빌드 및 DB 초기 세팅):** 최초 실행 시 이미지 빌드 및 DB 세팅으로 인해 몇 분 정도 소요될 수 있습니다.
```bash
docker-compose up --build -d
```

* **일반 기동 (평상시 실행):** 기존 데이터베이스와 캐시를 유지하며 컨테이너만 백그라운드에서 실행합니다.
```bash
docker-compose up -d
```

* **시스템 종료:**
```bash
docker-compose stop
```

* 기동이 완료되면 브라우저에서 `http://localhost:3000` 으로 접속하여 시스템을 바로 사용할 수 있습니다!

---

## 2. 프론트엔드 아키텍처 (Next.js App Router 기반)

시스템의 무한한 확장을 위해 상단 네비게이션 바(GNB)를 통한 **6대 다중 페이지 라우팅 구조**를 채택했습니다.

### 2.1. 프론트엔드 기술 스택

* **Core Framework:** Next.js (React) + TypeScript
* **Data Fetching & State:** TanStack Query (React Query)
* **State Management (Client):** Zustand (파이프라인 빌더 캔버스 제어용)
* **Styling & UI Components:** Tailwind CSS + lucide-react + Recharts (대시보드 통계 시각화)
* **Drag & Drop:** @dnd-kit/core (노드 블록 드래그 앤 드롭 조립용)
* **CSV Parsing:** PapaParse (클라이언트 사이드 파싱을 통한 서버 부하 제로화)

### 2.2. 핵심 메뉴 및 UI 구성

1. **[ / ] 파이프라인 관제 (Pipeline Dashboard)**  
대시보드 통계(비용, 토큰, RAG 캐시 적중률, 핫 키워드 및 위험 감지 알림), 비정형 데이터 수동 적재 및 오류 교정, 일괄 대량 합성, 외부 데이터(EXT) 동기화 스케줄러의 동적 주기 제어(Pause/Resume)를 관제하는 실시간 메인 화면.

2. **[ /builder ] 파이프라인 스튜디오 (Pipeline Studio)**  
백엔드 로직 수정 없이 UI에서 코어 모듈(Node)을 조립하여 새로운 데이터 처리 파이프라인(JSON Config)을 설계하는 **'파이프라인 빌더'** 모드와, 파이프라인 스텝별 프롬프트 및 JSON 스키마 매핑을 동적으로 제어하는 **'프롬프트 랩'** 모드를 단일 공간에서 지휘합니다.

3. **[ /archive ] 일지 및 리포트 보관소 (Archive)**  
AI가 합성한 단기 일지(`core.event_logs`)와 심층 요약 리포트(`core.event_briefings`)를 검색, 열람, 편집 및 대량 관리(일괄 삭제/주입/추출)하는 전용 보관소.

4. **[ /memory ] 기억 탐색기 (Memory Explorer)**  
벡터 저장소(`core.event_memories`)의 불변 데이터를 자연어 및 다중 조건으로 검색해 보고 RAG의 코사인 거리(Cosine Distance)를 테스트. 체리피킹한 팩트들을 기반으로 AI 요약 리포트(Briefing) 생성을 트리거하는 디버깅 화면.

5. **[ /studio ] 창작 스튜디오 (Creative Studio)**  
기존 일지, 리포트, 창작물을 다중 선택(Source)하여 새로운 톤앤매너로 글을 재구성하는 워크스페이스. 메타 프롬프트(Meta-Prompt) 역설계 및 2차 창작물 보관소 기능을 지원.

6. **[ /domain ] 데이터 딕셔너리 (Data Dictionary)**  
AI가 참조할 기준 데이터(`domain.mst_entities` 등) 및 상태 코드를 제어하는 **'마스터 관리'** 모드와, 최고 관리자 전용 도구로서 로컬 데이터베이스 스키마 내 모든 물리 테이블을 안전하게 열람하는 **'시스템 데이터 탐색기(DB Browser)'** 모드를 통합 제공합니다.

7. **[ ADM 버튼 ] 시스템 환경 설정 (System Settings)**  
GNB 우측 상단의 버튼을 통해 백엔드 재시작이나 `.env` 파일의 억지스러운 수정 없이, Gemini API Key와 Model Version을 동적으로 변경 및 즉시 적용할 수 있습니다 (BYOK 보안 적용).


---

## 3. 데이터베이스 스키마 및 마스터 룰

시스템의 데이터 무결성을 보장하기 위해 쓰기(Write) 권한과 참조(Read) 권한을 철저히 분리합니다. 파이프라인은 `domain` 및 `ext` 스키마를 오직 참조만 합니다.

### [RAW 스키마: 원본 데이터] - 파이프라인 Write 허용
* **`raw.event_raw_source`**: 멀티모달(음성, 이미지 등) 파일 메타데이터.
* **`raw.event_raw`**: 구조화 파이프라인을 타기 전의 원시 비정형 텍스트.

### [CORE 스키마: 팩트, 메모리 및 AI 산출물] - 파이프라인 Write 허용
* **`core.event_facts` (Detail 계층):** 구조화된 팩트 원문 및 메타데이터.
* **`core.event_memories` (Index 계층):** LTM 및 캐시 통합 벡터 저장소.
* **`core.event_logs`**: 컨텍스트가 융합된 최종 단기 일지.
* **`core.event_briefings`**: 다중 메모리를 체리피킹하여 생성한 심층 요약 리포트 아카이브.
* **`core.event_creations`**: 단기 일지, 리포트, 다른 창작물을 다중 참조한 2차 창작물 보관소.
* **`core.batch_jobs`** & **`core.history_ext_sync`**: 일괄 합성 상태 및 마이크로 배치 동기화 이력 테이블.

### [DOMAIN 스키마: 마스터 데이터] - JSONB 및 대역 분리 전략 적용
* **`domain.mst_entities` & `domain.mst_objects`:**
물리적인 컬럼 추가 없이, JSONB 컬럼을 활용해 거래처, 직원, 프로젝트 등 무한한 형태의 마스터를 단일 테이블 내에 구현하는 가상 테이블. 파이프라인은 이 테이블들을 절대 갱신하지 않으며 참조만 실시.
* **`domain.mst_status`**: 투트랙 대역 분리(ID Range)를 통해 영업, 자산 등 비즈니스 커스텀 상태를 동적 생성 가능.
* **`domain.mst_prompts`**: 타겟 및 파이프라인 스텝별 프롬프트, `schema_name`, `temperature`, `max_length` 값을 보관.
* **`domain.mst_pipelines`**: 파이프라인 빌더에서 조립한 동적 노드 구성 JSON(`steps` 배열)을 영구 보존하는 마스터 테이블.

### [EXT 스키마: 외부 정형 데이터] - 파이프라인 참조 전용
* **`ext_mst` & `ext_events`**: ERP, CRM 등 외부 연동 데이터를 적재하며, 백엔드는 이를 변경하지 않고 검색 증강용 외부 데이터 문맥으로만 읽어 들임.


---

## 4. 백엔드 핵심 비즈니스 로직 (API Flow)

### 프로세스 A: 【범용 팩트 구조화 파이프라인】 (`raw` ➡️ `core`)

#### 1. **1차 연동 (문맥 정돈)**
* `raw.event_raw`에서 미처리된 비정형 텍스트(`raw_content`)를 가져옵니다.

#### 2. **동적 후보군 사전 주입 (Dynamic Candidate Injection)**
* 원문을 바탕으로 백엔드가 `domain.mst_entities`를 역방향 패턴 매칭(`ILIKE`)하여 연관성 높은 후보군 5개를 추출합니다.
* JSONB 파싱 중 발생할 수 있는 DB 500 에러를 원천 차단하기 위해 `jsonb_typeof`를 활용한 Type Guard 검사가 적용되어 있습니다.
* 추출된 후보군을 LLM의 시스템 프롬프트에 주입하여, 토큰 폭발 없이 환각(Hallucination)을 억제하고 정확한 타겟 실명을 DB ID(PK)로 매핑합니다.

#### 3. **팩트 적재 (`core.event_facts`)**
* LRSE 클라이언트 통신 전, `mst_prompts`로부터 `temperature`와 `max_length`를 온전히 Unpacking하여 물리적 제어 파라미터로 주입합니다.
* 결과를 `core.event_facts`에 단독 적재하고 `event_id`를 발급받습니다.

#### 4. **Append-Only 기반 LTM 적재 (`core.event_memories`)**
* 절대로 기존 메모리를 병합(Merge)하거나 갱신(UPDATE)하지 않습니다.
* 구조화된 텍스트를 임베딩하여 `core.event_memories`에 **무조건 신규 INSERT** 합니다.
* 해당 레코드에 행위 주체(`base_entity_id`)와 대상(`target_entity_id`, `target_object_id`)을 영구히 박제하여 동시성 제어(Race Condition)를 해결하고 무결성을 보장합니다.

#### 5. **상태 업데이트**
* 성공 시 `raw.event_raw`의 상태를 '1 (SYNCED)'로, 실패 시 '2 (FAILED)'로 마킹하고 에러 로그를 적재합니다.


### 프로세스 B: 【범용 컨텍스트 합성】 (`core` ➡️ `core`)

#### 1. **단기 팩트(당일 데이터) 확보:**
* 프론트엔드의 `reference_date`를 기준으로 당일 발생한 `core.event_facts`와 `core.event_memories`를 바탕으로 단기 팩트 로그를 작성합니다.

#### 2. **마스터 참조 및 쿼리 증강 (Query Augmentation):**
* 당일 팩트에 기록된 타겟 ID들을 바탕으로 `domain` 스키마를 참조(Read)하여 실명(Name)을 확보합니다.
* 임베딩 검색 쿼리에 `[핵심 타겟 엔티티: XXX]` 형태로 주입하여 벡터 검색 가중치를 극대화합니다.

#### 3. ** 투트랙(Dual-Track) RAG 기반 LTM 확보:**
* 단순 유사도 검사의 한계를 넘기 위해 아래 두 가지 트랙을 동시 수행합니다.
* **[Track 1: 관계 중심 검색]** 특정 대상에 대한 과거 기억만을 필터링(`WHERE target_entity_id = ? AND base_entity_id = ?`)하여 연속성 있는 맥락을 가져옵니다.
* **[Track 2: 전역 맥락 중심 검색 (크로스 엔티티 인사이트)]** 타겟 엔티티 필터링을 해제하여 타겟 간 유사 사례를 검색하되, **반드시 자사 테넌트(`WHERE base_entity_id = ?`) 내부의 기억만 검색**하도록 격리합니다.
* 시간 감쇠(Time Decay) 로직을 적용하여, 순수 코사인 거리를 측정한 뒤 경과 일수에 따른 패널티를 가산하여 최종 `adjusted_distance`로 재정렬합니다. 검색은 로컬 캐시(Tier 1) 및 로컬 pgvector(Tier 2)를 최우선으로 타며, 필요 시 BigQuery(Tier 3)로 폴백하는 3-Tier 라우팅을 수행합니다.

#### 4. **에이전트 플래닝 및 최종 일지 작성 (`core.event_logs`):**
* 에이전트(Agent)가 요약본과 외부 데이터를 분석해 추가로 필요한 상세 팩트 원문(`FETCH_FACT_DETAILS`)이나 마스터 정보를 스스로 판단하고 도구를 호출합니다.
* 인출된 상세 데이터를 포함하여 LLM(LRSE)에 전달하고, 최종 요약본(`llm_summary`)과 할 일(`action_items`)을 생성 및 적재합니다.


### 프로세스 C: 【심층 리포트 및 2차 창작 엔진】

#### 1. **AI 요약 리포트 (Briefings):**
* 사용자가 직접 체리피킹한 기억(Memory)을 넘기면, `MAX_FETCH_LIMIT` 방어막을 Bypass하여 선택된 원문 전체를 손실 없이 인출하여 전문적인 심층 리포트를 작성합니다.

#### 2. **창작 스튜디오 (Creations):**
* 다중 소스를 병합하여 원하는 톤앤매너로 2차 창작물을 생산합니다. 원본의 무결성을 해치지 않는지 `fact_preservation_check` 플래그로 팩트 왜곡(Hallucination)을 검증합니다.

### ★ 노드 기반 동적 파이프라인 (The Executor)

API 파이프라인 로직을 'Node(모듈)' 단위로 격리후, **`PipelineOrchestrator`**가 이들을 지휘.

1. **페이로드 패러다임 전환 (Data -> Pipeline):**
   * 클라이언트는 `{"query": "...", "data": "..."}` 형태의 고정된 페이로드가 아니라, **"어떤 노드를, 어떤 순서로, 어떤 파라미터를 주입하여 실행할 것인지"**에 대한 배열(`steps`) 전체를 전송합니다. (`schemas.pipeline_schemas.PipelineExecutionRequest`)
2. **동적 템플릿 엔진 (Interpolation):**
   * 이전 단계(Node A)의 실행 결과물(`output_key`)은 다음 단계(Node B)의 파라미터 내 `{{node_a_result}}` 템플릿 변수에 의해 인메모리 상태(`PipelineContext`)를 통해 런타임에 동적으로 치환됩니다.
3. **단일 트랜잭션 롤백 무결성 보장:**
   * 오케스트레이터의 실행 루프는 `with self.db.begin_nested():`로 감싸져 있어, 파이프라인 도중 에러가 발생하면 이전 노드에서 수행한 모든 DB 조작(INSERT 등)이 안전하게 롤백(Rollback)되어 고아 데이터를 방지합니다.

### 사용 가능한 핵심 코어 모듈 (Nodes Registry)
* **`LTM_Search`:** RAG 오케스트레이터를 호출하여 LTM/Cache 컨텍스트를 벡터 검색.
* **`Fetch_Ext_Data`:** 외부 정형 데이터(EXT 스키마) 인출.
* **`Pre_Fact_Check`:** LLM 환각 방지를 위한 LTM vs EXT 데이터 교차 검증 및 모순 발생 시 트랜잭션 중단.
* **`LLM_Generate`:** 동적 주입된 Prompt와 Schema를 기반으로 LRSE 미들웨어와 통신하여 데이터를 구조화.
* **`Persist_DB`:** 산출된 최종 데이터를 시스템 테이블에 안전하게 Upsert.

---
## 5. 업데이트 내역 (Changelog)

* **2026.09.05 (v0.3.3)**
  - 사용자 맞춤형 AI 가이드 봇 신규 도입 및 전역 기능 연동 (F5 새로고침 시 대화 상태 유지 포함)

* **2026.09.04 (v0.3.2)**
  - LRSE v0.4.0의 무상태 아키텍처 대응(동적 스키마 라우팅 연동)
  - 불필요한 스캐폴딩 파일(`template.py`) 및 고아 컴포넌트(`DomainModals.tsx`) 삭제를 통한 프로젝트 경량화
  - React 컴포넌트(`EntityView`, `ObjectView`, `StatusView`) 내 사용하지 않는 상태(State) 변수 등 데드 코드 제거로 렌더링 최적화

* **2026.08.30 (v0.3.1)**
  - `docker-compose start/stop` 기반의 효율적인 컨테이너 일반 기동 프로세스 적용
  - 시스템 설정 관리를 위한 GNB 통합 및 `[ADM]` 환경 설정 모달 업데이트

* **2026.08.29 (v0.3.0)**
  - 노드 기반 프레임워크 (Headless Engine) 전면 도입.
  - 프론트엔드 비주얼 파이프라인 빌더 기능 추가 (`/builder`).
  - 파이프라인 설계도(JSON Config) 보존을 위한 `mst_pipelines` 테이블 추가.
  - `PipelineOrchestrator` 및 상태 보존 `PipelineContext` 구현.
  - API 페이로드에 위상 정렬 기반의 `steps` 배열 스키마(`PipelineExecutionRequest`) 전면 적용.
* **2026.08.27 (v0.2.1)**
  - 최고 관리자 전용 시스템 데이터 탐색기 (DB 브라우저) 기능 및 UI 추가 (`/system`)
  - SQLAlchemy MetaData Reflection 도입으로 동적 쿼리 안티 패턴 제거 및 SQL Injection 원천 차단
  - 대용량 Vector(3072차원) 및 JSONB 객체 렌더링 시 DOM Bloat 및 UI Freezing 방어 로직 적용
* **2026.08.25 (v0.2.0)**
  - 엔터프라이즈 멀티 테넌트(Multi-Tenant) 데이터 보안 아키텍처 전면 적용.
  - 전역 API DTO의 `base_entity_id` 필수값 강제 및 프론트엔드 연동 완료.
  - RAG Orchestrator의 Cross-Entity Search(Track 2) 시 테넌트 격리 로직 적용.
  - 삭제 시 계단식 고아 객체 연결 해제(Cascade Soft Disconnect) 로직 완비.
* **2026.08.23 (v0.1.0)**  
  - 초기 릴리즈

---

## 6. 시스템 아키텍처 및 파이프라인 다이어그램

확장성을 고려하여 백엔드 API 레이어를 철저하게 분리된 모듈로 개편했습니다.

```text
[Defacto Universal LTM-Sync Engine Architecture]
├── 1. Trigger Layer (Client / Job / Event)
│   ├── 스케줄링 배치 (APScheduler - EXT 동기화 및 10분 주기 폴링)
│   ├── 수동 API Call (수동 적재, 텍스트 교정, 2차 창작, 대량 합성)
│   └── Event-Driven (Direct Local Storage Upload ➡️ BackgroundTask)
│
├── 2. API Gateway & Core Engine (FastAPI Routers)
│   │
│   ├── [pipeline_builder_router.py] (동적 파이프라인 오케스트레이션 게이트웨이)
│   ├── [pipeline_router.py] (Process A/B 엔진 제어)
│   ├── [raw_router.py] (비정형 데이터 수동 적재 및 교정 제어)
│   ├── [memory_router.py] (기억 탐색 및 심층 리포트 제어)
│   ├── [creative_router.py] (2차 창작 스튜디오 및 메타 프롬프트 제어)
│   ├── [log_router.py] (최종 일지 단일/대량 Upsert 제어)
│   ├── [master_router.py] (도메인 마스터 제어 - Read/Write)
│   ├── [prompt_router.py] (프롬프트 및 JSON 스키마 동적 매핑 제어)
│   ├── [scheduler_router.py] (마이크로 배치 및 대량 합성 트리거)
│   ├── [dashboard_router.py] (통계 및 시스템 인사이트 관제)
│   ├── [system_router.py] (시스템 데이터 탐색 및 DB 브라우저 제어)
│   └── [media_router.py] (멀티모달 STT/OCR 비동기 백그라운드 처리)
│
├── 3. LLM RPC Middleware (LRSE Engine)
│   ├── 도메인에 따라 동적으로 주입되는 Pydantic JSON Schema 강제화
│   ├── Token(max_length) 및 Temperature 물리적 제어 주입
│   └── Validation 실패 시 Auto Retry Loop 동작
│
├── 4. Primary Database (PostgreSQL & pgvector)
│   ├── [Domain] mst_entities, mst_objects, mst_status, mst_prompts, mst_pipelines (마스터)
│   ├── [Ext/Raw] ext_mst, ext_events, event_raw_source, event_raw
│   └── [Core] event_facts, event_memories, event_logs, event_briefings, event_creations, history_ext_sync, batch_jobs
│
└── 5. Data Pipeline & Warehouse [Optional]
    ├── Datastream (PostgreSQL의 WAL 기반 CDC 실시간 캡처)
    └── BigQuery (데이터 마트, 아카이브, Cold-Tier RAG 수행)
```