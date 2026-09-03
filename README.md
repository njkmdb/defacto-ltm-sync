# Defacto LTM-Sync Context Manager

| [🇺🇸 English](README.md) | [🇰🇷 한국어](README_ko.md) | [🇯🇵 日本語](README_ja.md) 

![100% AI Generated](https://img.shields.io/badge/100%25_AI_Generated-8A2BE2?style=flat&logo=googlegemini&logoColor=white)
![Version](https://img.shields.io/badge/version-v0.3.2-4F46E5?style=flat)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white)
![Google BigQuery](https://img.shields.io/badge/Google_BigQuery-669DF6?style=flat&logo=googlecloud&logoColor=white)

It is a context manager that combines fragmented [short-term events] occurring in the field with past [specific memories (LTM)] to generate the driest and most accurate [short-text summaries], [in-depth reports], and [secondary creations].

* **Features:**  
Provides a universal framework agnostic to domains such as sales logs, game quests, and diaries.

* **Infrastructure:**  
Fundamentally supports standalone operation based on PostgreSQL (Local/Operational DB). If large-scale data expansion is required, it features a flexible architecture that can be scaled up into a 'Hybrid Dual-Track RAG Search System' by integrating Datastream ➡️ BigQuery **(BigQuery integration is optional)**. It supports multimodal data including audio and images as well as document files like PDF/CSV, and fundamentally blocks network costs by utilizing local storage instead of cloud storage.

* **Multi-Tenant Security:**  
A strict data isolation architecture based on `base_entity_id` is applied from the API DTO stage to the deepest parts of the core RAG engine (Cross-Entity Vector Search). This 100% fundamentally blocks other companies' confidential data from being searched or mixed into the LLM context.

* **Node-based Framework (Headless Engine):**  
It completely separates hard-coded business logic and operates based on an Orchestrator that sequentially executes tasks by reading the 'Pipeline Config' received from the frontend. The operational flow of the system can be infinitely created and expanded without redeploying the backend.

---

## 1. Getting Started (Local Execution Guide)

This project has all environments (DB, Backend, Frontend) containerized via Docker, allowing it to be booted up with a single command without complex environment setups.

### 1.1. Prerequisites

To boot the system, **Docker** must be installed on your local PC.

* **[Download Docker Desktop](https://www.docker.com/products/docker-desktop/)** (Common for Windows / Mac)
> The Docker Desktop application must be running after installation.


### 1.2. Booting LRSE Middleware (Required 💡)

This system communicates with a separate `LRSE` middleware server (port 8081) for LLM hallucination control. Please run the middleware before booting the backend.

1. Clone LRSE repository: `git clone [https://github.com/njkmdb/llm-rpc-schema-enforcer](https://github.com/njkmdb/llm-rpc-schema-enforcer)`
2. Navigate to the folder and boot the container:
```bash
docker-compose up --build -d
```

### 1.3. Defacto LTM-Sync Environment Variable Setup

1. Clone this repository and navigate to the folder:
`git clone [https://github.com/njkmdb/defacto-ltm-sync](https://github.com/njkmdb/defacto-ltm-sync)`
2. Rename the `.env.example` file in the root directory to **`.env`**.
3. Open the `.env` file and enter your issued **Gemini API Key**.

### 1.4. Booting Docker Containers

Enter the following commands in the terminal to boot the system.

* **Initial Boot (Image Build and Initial DB Setup):** It may take a few minutes during the first run due to image building and DB setup.
```bash
docker-compose up --build -d
```


* **Normal Boot (Regular Execution):** Runs only the containers in the background while maintaining the existing database and cache.
```bash
docker-compose up -d
```


* **System Shutdown:**
```bash
docker-compose stop
```


* Once booted, you can immediately use the system by accessing `http://localhost:3000` in your browser!

---

## 2. Frontend Architecture (Based on Next.js App Router)

For infinite expansion of the system, an **6-tier multi-page routing structure** via the Global Navigation Bar (GNB) was adopted.

### 2.1. Frontend Tech Stack

* **Core Framework:** Next.js (React) + TypeScript
* **Data Fetching & State:** TanStack Query (React Query)
* **State Management (Client):** Zustand (For Pipeline Builder Canvas control)
* **Styling & UI Components:** Tailwind CSS + lucide-react + Recharts (Dashboard statistics visualization)
* **Drag & Drop:** @dnd-kit/core (For assembling node blocks)
* **CSV Parsing:** PapaParse (Zero server load through client-side parsing)

### 2.2. Core Menu & UI Composition

1. **[ / ] Pipeline Dashboard:**  
A real-time main screen that monitors dashboard statistics (costs, tokens, RAG cache hit rates, hot keywords and risk detection alerts), manual loading and error correction of unstructured data, bulk synthesis, and dynamic interval control (Pause/Resume) for the external data (EXT) sync scheduler.

2. **[ /builder ] Pipeline Studio:**  
Commands a single workspace featuring a **'Pipeline Builder'** mode, which designs new data processing pipelines (JSON Config) by assembling core modules (Nodes) in the UI without backend logic modifications, and a **'Prompt Lab'** mode, which dynamically controls prompt and JSON schema mappings per pipeline step.

3. **[ /archive ] Archive:**  
A dedicated repository to search, view, edit, and bulk manage (bulk delete/inject/extract) short-term logs (`core.event_logs`) and in-depth summary reports (`core.event_briefings`) synthesized by AI.

4. **[ /memory ] Memory Explorer:**  
A debugging screen to search invariant data in the vector store (`core.event_memories`) using natural language and multiple conditions, and test RAG's Cosine Distance. Triggers the generation of AI summary reports (Briefing) based on cherry-picked facts.

5. **[ /studio ] Creative Studio:**  
A workspace to reconstruct texts with new tones and manners by multi-selecting (Source) existing logs, reports, and creations. Supports Meta-Prompt reverse engineering and a repository function for secondary creations.

6. **[ /domain ] Data Dictionary:**  
Integrates a **'Master Admin'** mode to control reference data (`domain.mst_entities`, etc.) and status codes for AI reference, and a **'System Data Explorer (DB Browser)'** mode, an exclusive tool for super admins to safely view all physical tables within the local database schemas.

7. **[ ADM Button ] System Settings:**  
Through the button on the top right of the GNB, you can dynamically change and immediately apply the Gemini API Key and Model Version without restarting the backend or awkwardly modifying the `.env` file (BYOK security applied).

---

## 3. Database Schema & Master Rules

To guarantee the data integrity of the system, Write and Read permissions are strictly separated. Pipelines only Read from the `domain` and `ext` schemas.

### [RAW Schema: Original Data] - Pipeline Write Allowed

* **`raw.event_raw_source`**: Multimodal (audio, image, etc.) file metadata.
* **`raw.event_raw`**: Raw unstructured text before going through the structuring pipeline.

### [CORE Schema: Facts, Memory, and AI Artifacts] - Pipeline Write Allowed

* **`core.event_facts` (Detail Layer):** Structured fact source text and metadata.
* **`core.event_memories` (Index Layer):** LTM and cache integrated vector store.
* **`core.event_logs`**: Final short-term logs with fused contexts.
* **`core.event_briefings`**: In-depth summary report archive generated by cherry-picking multiple memories.
* **`core.event_creations`**: Secondary creation repository that multi-references short-term logs, reports, and other creations.
* **`core.batch_jobs`** & **`core.history_ext_sync`**: Bulk synthesis status and micro-batch synchronization history tables.

### [DOMAIN Schema: Master Data] - JSONB & Band Separation Strategy Applied

* **`domain.mst_entities` & `domain.mst_objects`:**
Virtual tables that implement infinite forms of masters like clients, employees, and projects within a single table using JSONB columns, without adding physical columns. Pipelines absolutely do not update these tables and only reference them.
* **`domain.mst_status`**: Allows dynamic creation of business custom statuses such as sales and assets through two-track band separation (ID Range).
* **`domain.mst_prompts`**: Stores prompts, `schema_name`, `temperature`, and `max_length` values by target and pipeline step.
* **`domain.mst_pipelines`**: Master table that permanently preserves dynamic node configuration JSONs (`steps` array) assembled in the pipeline builder.

### [EXT Schema: External Structured Data] - Pipeline Read-Only

* **`ext_mst` & `ext_events`**: Loads external integrated data like ERP and CRM; the backend does not modify them but reads them only as external data contexts for search augmentation.

---

## 4. Backend Core Business Logic (API Flow)

### Process A: 【Universal Fact Structuring Pipeline】 (`raw` ➡️ `core`)

#### 1. **Initial Integration (Context Refinement)**

* Fetches unprocessed unstructured text (`raw_content`) from `raw.event_raw`.

#### 2. **Dynamic Candidate Pre-Injection**

* Based on the original text, the backend extracts 5 highly relevant candidates through reverse pattern matching (`ILIKE`) against `domain.mst_entities`.
* To fundamentally block DB 500 errors that may occur during JSONB parsing, a Type Guard check utilizing `jsonb_typeof` is applied.
* Injects the extracted candidates into the LLM's system prompt to suppress hallucinations without token explosion and map the exact target real name to the DB ID (PK).

#### 3. **Fact Loading (`core.event_facts`)**

* Before LRSE client communication, completely unpacks `temperature` and `max_length` from `mst_prompts` and injects them as physical control parameters.
* Solely loads the result into `core.event_facts` and issues an `event_id`.

#### 4. **Append-Only Based LTM Loading (`core.event_memories`)**

* Never merges or updates existing memories.
* Embeds the structured text and **unconditionally newly INSERTs** it into `core.event_memories`.
* Permanently embeds the actor (`base_entity_id`) and targets (`target_entity_id`, `target_object_id`) in the record to solve concurrency control (Race Condition) and ensure integrity.

#### 5. **Status Update**

* Marks the status of `raw.event_raw` as '1 (SYNCED)' upon success, or '2 (FAILED)' upon failure, and loads the error log.

### Process B: 【Universal Context Synthesis】 (`core` ➡️ `core`)

#### 1. **Secure Short-term Facts (Same-day Data):**

* Writes a short-term fact log based on `core.event_facts` and `core.event_memories` generated on the same day, based on the frontend's `reference_date`.

#### 2. **Master Reference and Query Augmentation:**

* Secures real names (Name) by referencing (Read) the `domain` schema based on target IDs recorded in the same-day facts.
* Maximizes vector search weight by injecting them into the embedding search query in the format `[Core Target Entity: XXX]`.

#### 3. **Secure Dual-Track RAG-based LTM:**

* Executes the following two tracks simultaneously to overcome the limitations of simple similarity checks.
* **[Track 1: Relationship-Centric Search]** Filters only past memories for a specific target (`WHERE target_entity_id = ? AND base_entity_id = ?`) to fetch continuous context.
* **[Track 2: Global Context-Centric Search (Cross-Entity Insight)]** Removes target entity filtering to search for similar cases across targets, but isolates the search to **strictly within the memories of the own tenant (`WHERE base_entity_id = ?`)**.
* Applies a Time Decay logic to measure pure cosine distance, then adds a penalty based on elapsed days to re-sort by the final `adjusted_distance`. The search prioritizes the local cache (Tier 1) and local pgvector (Tier 2), performing a 3-Tier routing that falls back to BigQuery (Tier 3) when necessary.

#### 4. **Agent Planning and Final Log Writing (`core.event_logs`):**

* The Agent analyzes the summary and external data to autonomously determine if additional detailed fact source texts (`FETCH_FACT_DETAILS`) or master information are needed, and calls tools.
* Delivers the retrieved detailed data to the LLM (LRSE) to generate and load the final summary (`llm_summary`) and action items (`action_items`).

### Process C: 【In-depth Report and Secondary Creation Engine】

#### 1. **AI Summary Report (Briefings):**

* When a user passes cherry-picked memories, it bypasses the `MAX_FETCH_LIMIT` defense mechanism to retrieve the entirety of the selected source texts without loss, writing a professional in-depth report.

#### 2. **Creative Studio (Creations):**

* Merges multiple sources to produce secondary creations with the desired tone and manner. Verifies fact distortion (Hallucination) with the `fact_preservation_check` flag to ensure the integrity of the original is not compromised.

### ★ Node-based Dynamic Pipeline (The Executor)

Isolates API pipeline logic into 'Node (Module)' units, orchestrated by the **`PipelineOrchestrator`**.

1. **Payload Paradigm Shift (Data -> Pipeline):**
* Instead of a fixed payload like `{"query": "...", "data": "..."}`, the client transmits an entire array (`steps`) indicating **"which nodes to execute, in what order, and with what parameters injected."** (`schemas.pipeline_schemas.PipelineExecutionRequest`)


2. **Dynamic Template Engine (Interpolation):**
* The execution result (`output_key`) of the previous step (Node A) is dynamically replaced at runtime via the in-memory state (`PipelineContext`) into the `{{node_a_result}}` template variable within the next step's (Node B) parameters.


3. **Single Transaction Rollback Integrity Guarantee:**
* The orchestrator's execution loop is wrapped with `with self.db.begin_nested():`, ensuring that if an error occurs during the pipeline, all DB operations (like INSERTs) performed in previous nodes are safely rolled back to prevent orphan data.



### Available Core Modules (Nodes Registry)

* **`LTM_Search`:** Calls the RAG orchestrator for vector search of LTM/Cache context.
* **`Fetch_Ext_Data`:** Fetches external structured data (EXT schema).
* **`Pre_Fact_Check`:** Cross-validates LTM vs EXT data to prevent LLM hallucinations and aborts the transaction if contradictions occur.
* **`LLM_Generate`:** Structures data by communicating with the LRSE middleware based on dynamically injected Prompts and Schemas.
* **`Persist_DB`:** Safely upserts the computed final data into system tables.

---

## 5. Changelog

* **2026.09.04 (v0.3.2)**
  - Supported LRSE v0.4.0 stateless architecture (integrated dynamic schema routing)
  - Lightened the project by removing unnecessary scaffolding files (template.py) and orphan components (DomainModals.tsx)
  - Optimized rendering by removing dead code, such as unused state variables, within React components (EntityView, ObjectView, StatusView)

* **2026.08.30 (v0.3.1)**
  - Applied efficient container regular boot process based on `docker-compose start/stop`.
  - Updated GNB integration and `[ADM]` environment settings modal for system configuration management.

* **2026.08.29 (v0.3.0)**
  - Fully introduced Node-based framework (Headless Engine).
  - Added frontend visual pipeline builder feature (`/builder`).
  - Added `mst_pipelines` table to preserve pipeline designs (JSON Config).
  - Implemented `PipelineOrchestrator` and state preservation `PipelineContext`.
  - Fully applied topological sort-based `steps` array schema (`PipelineExecutionRequest`) to API payloads.

* **2026.08.27 (v0.2.1)**
  - Added System Data Explorer (DB Browser) feature and UI exclusively for super admins (`/system`).
  - Eliminated dynamic query anti-patterns and fundamentally blocked SQL Injections by introducing SQLAlchemy MetaData Reflection.
  - Applied defense logic against DOM Bloat and UI Freezing when rendering large-scale Vector (3072 dimensions) and JSONB objects.

* **2026.08.25 (v0.2.0)**
  - Fully applied enterprise Multi-Tenant data security architecture.
  - Enforced `base_entity_id` as a required value in global API DTOs and completed frontend integration.
  - Applied tenant isolation logic during Cross-Entity Search (Track 2) in RAG Orchestrator.
  - Perfected Cascade Soft Disconnect logic for orphan objects upon deletion.

* **2026.08.23 (v0.1.0)**
 - Initial release.



---

## 6. System Architecture & Pipeline Diagram

To consider scalability, the backend API layer has been reorganized into strictly separated modules.

```text
[Defacto Universal LTM-Sync Engine Architecture]
├── 1. Trigger Layer (Client / Job / Event)
│   ├── Scheduling Batch (APScheduler - EXT sync and 10-min interval polling)
│   ├── Manual API Call (Manual load, text correction, 2nd creation, bulk synthesis)
│   └── Event-Driven (Direct Local Storage Upload ➡️ BackgroundTask)
│
├── 2. API Gateway & Core Engine (FastAPI Routers)
│   │
│   ├── [pipeline_builder_router.py] (Dynamic Pipeline Orchestration Gateway)
│   ├── [pipeline_router.py] (Process A/B Engine Control)
│   ├── [raw_router.py] (Unstructured data manual load and correction control)
│   ├── [memory_router.py] (Memory Explorer and in-depth report control)
│   ├── [creative_router.py] (2nd Creative Studio and Meta-Prompt control)
│   ├── [log_router.py] (Final log single/bulk Upsert control)
│   ├── [master_router.py] (Domain Master control - Read/Write)
│   ├── [prompt_router.py] (Prompt and JSON schema dynamic mapping control)
│   ├── [scheduler_router.py] (Micro-batch and bulk synthesis trigger)
│   ├── [dashboard_router.py] (Statistics and system insights control)
│   ├── [system_router.py] (System Data Explorer and DB Browser control)
│   └── [media_router.py] (Multimodal STT/OCR async background processing)
│
├── 3. LLM RPC Middleware (LRSE Engine)
│   ├── Enforcement of dynamically injected Pydantic JSON Schema based on domain
│   ├── Injection of Token(max_length) and Temperature physical controls
│   └── Auto Retry Loop operation upon Validation failure
│
├── 4. Primary Database (PostgreSQL & pgvector)
│   ├── [Domain] mst_entities, mst_objects, mst_status, mst_prompts, mst_pipelines (Master)
│   ├── [Ext/Raw] ext_mst, ext_events, event_raw_source, event_raw
│   └── [Core] event_facts, event_memories, event_logs, event_briefings, event_creations, history_ext_sync, batch_jobs
│
└── 5. Data Pipeline & Warehouse [Optional]
    ├── Datastream (PostgreSQL WAL-based CDC real-time capture)
    └── BigQuery (Data Mart, Archive, Cold-Tier RAG execution)

```