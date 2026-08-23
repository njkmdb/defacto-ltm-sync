# Defacto LTM-Sync Context Manager

![Version](https://img.shields.io/badge/version-v0.1.0-4F46E5?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Google BigQuery](https://img.shields.io/badge/Google_BigQuery-669DF6?style=for-the-badge&logo=googlecloud&logoColor=white)

현장에서 발생한 파편화된 [단기 이벤트]를, 과거의 [특정 기억(LTM)]과 결합하여, 가장 건조하고 정확한 [단문 요약본], [심층 리포트], 그리고 [2차 창작물]로 만들어 내는 마스터 엔진입니다.

* **특징:** 영업 일지, 게임 퀘스트, 다이어리 등 도메인에 구애받지 않는 범용 프레임워크를 제공합니다.
* **인프라 환경:** PostgreSQL (로컬/운영 DB) ➡️ Datastream ➡️ BigQuery (아카이브 적재) 기반의 하이브리드 투트랙 RAG 검색 시스템입니다. 오디오 및 이미지 등 멀티모달 원본 파일은 클라우드 스토리지 대신 **로컬 고성능 NVMe SSD**를 활용하여 네트워크 비용을 원천 차단합니다.

---
## 1. 프론트엔드 아키텍처 (Next.js App Router 기반)

시스템의 무한한 확장을 위해 상단 네비게이션 바(GNB)를 통한 **6대 다중 페이지 라우팅 구조**를 채택했습니다.

### 1.1. 프론트엔드 기술 스택

* **Core Framework:** Next.js (React) + TypeScript
* **Data Fetching & State:** TanStack Query (React Query)
* **Styling & UI Components:** Tailwind CSS + lucide-react + Recharts (대시보드 통계 시각화)
* **CSV Parsing:** PapaParse (클라이언트 사이드 파싱을 통한 서버 부하 제로화)

### 1.2. GNB 6대 핵심 메뉴 구성

1. **[ / ] 파이프라인 관제 (Pipeline Dashboard)**   
대시보드 통계(비용, 토큰, RAG 캐시 적중률), 비정형 데이터 수동 적재 및 오류 교정 (Process A), 일괄 대량 합성, 외부 데이터(EXT) 동기화 스케줄러를 관제하는 실시간 메인 화면.

2. **[ /archive ] 일지 및 리포트 보관소 (Archive)**  
AI가 합성한 단기 일지(`core.event_logs`)와 심층 요약 리포트(`core.event_briefings`)를 검색, 열람, 편집 및 대량 관리(일괄 삭제/주입/추출)하는 전용 보관소.

3. **[ /domain ] 마스터 관리 (Domain Admin)**  
AI가 참조할 기준 데이터(`domain.mst_entities`, `domain.mst_objects`)와 상태 코드(`domain.mst_status`)를 관리. '싱글 테이블 & JSONB 가상 테이블 전략'을 사용하여 화면에서 동적 속성(Key-Value)을 자유롭게 추가 가능.

4. **[ /memory ] 기억 탐색기 (Memory Explorer)**  
벡터 저장소(`core.event_memories`)의 불변 데이터를 자연어 및 다중 조건으로 검색해 보고 RAG의 코사인 거리(Cosine Distance)를 테스트. 체리피킹한 팩트들을 기반으로 **AI 요약 리포트(Briefing)** 생성을 트리거하는 디버깅 화면.

5. **[ /prompt ] 프롬프트 랩 (Prompt Lab)**  
백엔드 재배포 없이 각 파이프라인 스텝(A_EXTRACTION, B_PLANNING 등)별 시스템 프롬프트, JSON 스키마 매핑, `temperature`, `max_length`를 동적으로 제어.

6. **[ /studio ] 창작 스튜디오 (Creative Studio)**  
기존 일지, 리포트, 창작물을 다중 선택(Source)하여 새로운 톤앤매너로 글을 재구성하는 워크스페이스. 메타 프롬프트(Meta-Prompt) 역설계 및 2차 창작물 보관소 기능을 지원.


---

## 2. 데이터베이스 스키마 및 마스터 룰

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

### [EXT 스키마: 외부 정형 데이터] - 파이프라인 참조 전용
* **`ext_mst` & `ext_events`**: ERP, CRM 등 외부 연동 데이터를 적재하며, 백엔드는 이를 변경하지 않고 검색 증강용 외부 데이터 문맥으로만 읽어 들임.


---

## 3. 백엔드 핵심 비즈니스 로직 (API Flow)

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

#### 3. **★ 투트랙(Dual-Track) RAG 기반 LTM 확보:**
* 단순 유사도 검사의 한계를 넘기 위해 아래 두 가지 트랙을 동시 수행합니다.
* **[Track 1: 관계 중심 검색]** 특정 대상에 대한 과거 기억만을 필터링(`WHERE target_entity_id = ?`)하여 연속성 있는 맥락을 가져옵니다.
* **[Track 2: 전역 맥락 중심 검색 (크로스 엔티티 인사이트)]** 엔티티 필터링을 완전히 해제하고 전체 DB에서 당일 팩트와 벡터 유사도가 가장 높은 전사적 기억을 가져옵니다.
* 시간 감쇠(Time Decay) 로직을 적용하여, 순수 코사인 거리를 측정한 뒤 경과 일수에 따른 패널티를 가산하여 최종 `adjusted_distance`로 재정렬합니다. 검색은 로컬 캐시(Tier 1) 및 로컬 pgvector(Tier 2)를 최우선으로 타며, 필요 시 BigQuery(Tier 3)로 폴백하는 3-Tier 라우팅을 수행합니다.

#### 4. **에이전트 플래닝 및 최종 일지 작성 (`core.event_logs`):**
* 에이전트(Agent)가 요약본과 외부 데이터를 분석해 추가로 필요한 상세 팩트 원문(`FETCH_FACT_DETAILS`)이나 마스터 정보를 스스로 판단하고 도구를 호출합니다.
* 인출된 상세 데이터를 포함하여 LLM(LRSE)에 전달하고, 최종 요약본(`llm_summary`)과 할 일(`action_items`)을 생성 및 적재합니다.


### 프로세스 C: 【심층 리포트 및 2차 창작 엔진】

#### 1. **AI 요약 리포트 (Briefings):**
* 사용자가 직접 체리피킹한 기억(Memory)을 넘기면, `MAX_FETCH_LIMIT` 방어막을 Bypass하여 선택된 원문 전체를 손실 없이 인출하여 전문적인 심층 리포트를 작성합니다.

#### 2. **창작 스튜디오 (Creations):**
* 다중 소스를 병합하여 원하는 톤앤매너로 2차 창작물을 생산합니다. 원본의 무결성을 해치지 않는지 `fact_preservation_check` 플래그로 팩트 왜곡(Hallucination)을 검증합니다.


---
## 4. 업데이트 내역 (Changelog)
* **2026.08.23 (v0.1.0)**  
  - 초기 릴리즈

---

## 5. 시스템 아키텍처 및 파이프라인 다이어그램

확장성을 고려하여 백엔드 API 레이어를 철저하게 분리된 모듈로 개편했습니다.

```text
[Defacto Universal LTM-Sync Engine Architecture]
├── 1. Trigger Layer (Client / Job / Event)
│   ├── 스케줄링 배치 (APScheduler - EXT 동기화 및 10분 주기 폴링)
│   ├── 수동 API Call (수동 적재, 텍스트 교정, 2차 창작, 대량 합성)
│   └── Event-Driven (Direct Local NVMe Upload ➡️ BackgroundTask)
│
├── 2. API Gateway & Core Engine (FastAPI Routers)
│   │
│   ├── [pipeline_router.py] (Process A/B 엔진 제어)
│   ├── [raw_router.py] (비정형 데이터 수동 적재 및 교정 제어)
│   ├── [memory_router.py] (기억 탐색 및 심층 리포트 제어)
│   ├── [creative_router.py] (2차 창작 스튜디오 및 메타 프롬프트 제어)
│   ├── [log_router.py] (최종 일지 단일/대량 Upsert 제어)
│   ├── [master_router.py] (도메인 마스터 제어 - Read/Write)
│   ├── [prompt_router.py] (프롬프트 및 JSON 스키마 동적 매핑 제어)
│   ├── [scheduler_router.py] (마이크로 배치 및 대량 합성 트리거)
│   ├── [dashboard_router.py] (통계 및 시스템 인사이트 관제)
│   └── [media_router.py] (멀티모달 STT/OCR 비동기 백그라운드 처리)
│
├── 3. LLM RPC Middleware (LRSE Engine)
│   ├── 도메인에 따라 동적으로 주입되는 Pydantic JSON Schema 강제화
│   ├── Token(max_length) 및 Temperature 물리적 제어 주입
│   └── Validation 실패 시 Auto Retry Loop 동작
│
├── 4. Primary Database (PostgreSQL & pgvector)
│   ├── [Domain] mst_entities, mst_objects, mst_status, mst_prompts (마스터)
│   ├── [Ext/Raw] ext_mst, ext_events, event_raw_source, event_raw
│   └── [Core] event_facts, event_memories, event_logs, event_briefings, event_creations, history_ext_sync, batch_jobs
│
└── 5. Data Pipeline & Warehouse
    ├── Datastream (PostgreSQL의 WAL 기반 CDC 실시간 캡처)
    └── BigQuery (데이터 마트, 아카이브, Cold-Tier RAG 수행)