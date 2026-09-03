# Defacto LTM-Sync Context Manager

| [🇺🇸 English](README.md) | [🇰🇷 한국어](README_ko.md) | [🇯🇵 日本語](README_ja.md) 

![100% AI Generated](https://img.shields.io/badge/100%25_AI_Generated-8A2BE2?style=flat&logo=googlegemini&logoColor=white)
![Version](https://img.shields.io/badge/version-v0.3.2-4F46E5?style=flat)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white)
![Google BigQuery](https://img.shields.io/badge/Google_BigQuery-669DF6?style=flat&logo=googlecloud&logoColor=white)

現場で発生した断片化された[短期イベント]を、過去の[特定の記憶(LTM)]と結合し、最もドライで正確な[短文要約]、[深層レポート]、そして[二次創作物]を作り出すコンテキストマネージャーです。

* **特徴:**  
営業日誌、ゲームクエスト、日記など、ドメインにとらわれない汎用フレームワークを提供します。

* **インフラ環境:**  
基本的にPostgreSQL（ローカル/運用DB）ベースの単独稼働をサポートし、大規模なデータ拡張が必要な場合は、Datastream ➡️ BigQueryと連動して「ハイブリッド・ツートラックRAG検索システム」にスケールアップできる柔軟なアーキテクチャです**（BigQuery連携はオプション）**。音声や画像だけでなく、PDF/CSVなどのドキュメントファイルを含むマルチモーダルデータをサポートし、クラウドストレージの代わりにローカルストレージを活用することでネットワークコストを根本から遮断します。

* **マルチテナント(Multi-Tenant) セキュリティ:**  
API DTO段階からコアRAGエンジン(Cross-Entity Vector Search)の最深部まで、`base_entity_id`に基づく徹底したデータ分離(Isolation)アーキテクチャが適用されており、他社の機密データが検索されたりLLMコンテキストに混入したりすることを100%根本から遮断します。

* **ノードベースフレームワーク (Headless Engine):**  
ハードコーディングされたビジネスロジックを完全に分離し、フロントエンドから受け取った「パイプライン設計図(Pipeline Config)」を読み込んで順次タスクを実行するオーケストレーター(Orchestrator)ベースで動作します。バックエンドの再デプロイなしにシステムの動作フローを無限に生成および拡張できます。

---

## 1. Getting Started (ローカル実行ガイド)

本プロジェクトはDockerを通じてすべての環境(DB、Backend、Frontend)がコンテナ化されており、複雑な環境設定なしにたった数行のコマンドで起動できます。

### 1.1. 事前準備 (Prerequisites)
システムを起動するには、ローカルPCに**Docker**がインストールされている必要があります。
* **[Docker Desktopのダウンロード](https://www.docker.com/products/docker-desktop/)** (Windows / Mac 共通)
  > インストール後、Docker Desktopアプリケーションを実行しておく必要があります。

### 1.2. LRSEミドルウェアの起動 (必須 💡)
このシステムは、LLMのハルシネーション制御のために分離された`LRSE`ミドルウェアサーバー(ポート8081)と通信します。バックエンドを立ち上げる前に、まずミドルウェアを実行してください。
1. LRSEリポジトリのクローン: `git clone [https://github.com/njkmdb/llm-rpc-schema-enforcer](https://github.com/njkmdb/llm-rpc-schema-enforcer)`
2. 該当フォルダに移動後、コンテナを起動:
```bash
docker-compose up --build -d
```

### 1.3. Defacto LTM-Sync 環境変数の設定
1. 本リポジトリをクローンしてフォルダに移動します。
   `git clone [https://github.com/njkmdb/defacto-ltm-sync](https://github.com/njkmdb/defacto-ltm-sync)`
2. 最上位ディレクトリにある`.env.example`ファイルの名前を**`.env`**に変更します。
3. `.env`ファイルを開き、自身の**Gemini API Key**を発行して入力します。

### 1.4. Dockerコンテナの一括起動
ターミナルに以下のコマンドを入力してシステムを起動します。

* **初回起動時 (イメージのビルドおよびDB初期設定):** 初回実行時はイメージのビルドやDB設定により数分かかる場合があります。
```bash
docker-compose up --build -d
```

* **通常起動 (普段の実行):** 既存のデータベースとキャッシュを維持したまま、コンテナのみをバックグラウンドで実行します。

```bash
docker-compose up -d
```

* **システムの終了:**
```bash
docker-compose stop
```

* 起動が完了したら、ブラウザで `http://localhost:3000` に接続してシステムをすぐに使用できます！


---

## 2. フロントエンドアーキテクチャ (Next.js App Router ベース)

システムの無限の拡張のため、上部ナビゲーションバー(GNB)を通じた**6大マルチページルーティング構造**を採用しました。

### 2.1. フロントエンド技術スタック

* **Core Framework:** Next.js (React) + TypeScript
* **Data Fetching & State:** TanStack Query (React Query)
* **State Management (Client):** Zustand (パイプラインビルダーキャンバス制御用)
* **Styling & UI Components:** Tailwind CSS + lucide-react + Recharts (ダッシュボード統計の視覚化)
* **Drag & Drop:** @dnd-kit/core (ノードブロックのドラッグ＆ドロップ組み立て用)
* **CSV Parsing:** PapaParse (クライアントサイドパーシングによるサーバー負荷ゼロ化)

### 2.2. コアメニューとUI構成

1. **[ / ] パイプライン管制 (Pipeline Dashboard)**  
ダッシュボード統計（コスト、トークン、RAGキャッシュヒット率、ホットキーワードおよびリスク検知通知）、非定型データの手動積載およびエラー校正、一括大量合成、外部データ(EXT)同期スケジューラの動的周期制御(Pause/Resume)を管制するリアルタイムメイン画面。

2. **[ /builder ] パイプラインスタジオ (Pipeline Studio)**  
バックエンドのロジック修正なしにUIでコアモジュール(Node)を組み立てて新しいデータ処理パイプライン(JSON Config)を設計する「パイプラインビルダー」**モードと、パイプラインステップ別のプロンプトやJSONスキーママッピングを動的に制御する**「プロンプトラボ」モードを単一の空間で指揮します。

3. **[ /archive ] 日誌およびレポート保管所 (Archive)**  
AIが合成した短期日誌(`core.event_logs`)と深層要約レポート(`core.event_briefings`)を検索、閲覧、編集、および大量管理（一括削除/注入/抽出）する専用保管所。

4. **[ /memory ] 記憶探索機 (Memory Explorer)**  
ベクターストア(`core.event_memories`)の不変データを自然言語および複数条件で検索し、RAGのコサイン距離(Cosine Distance)をテスト。チェリーピッキングしたファクトに基づき、AI要約レポート(Briefing)の生成をトリガーするデバッグ画面。

5. **[ /studio ] 創作スタジオ (Creative Studio)**  
既存の日誌、レポート、創作物を複数選択(Source)し、新しいトーン＆マナーで文章を再構成するワークスペース。メタプロンプト(Meta-Prompt)の逆設計と二次創作物保管所機能をサポート。

6. **[ /domain ] データ辞書 (Data Dictionary)**  
AIが参照する基準データ(`domain.mst_entities`等)と状態コードを制御する「マスター管理」**モードと、最高管理者専用ツールとしてローカルデータベーススキーマ内のすべての物理テーブルを安全に閲覧する**「システムデータエクスプローラー(DB Browser)」モードを統合して提供します。

7. **[ ADM ボタン ] システム環境設定 (System Settings)**  
GNB右上のボタンから、バックエンドの再起動や`.env`ファイルの無理な修正なしに、Gemini API KeyとModel Versionを動的に変更し、即時適用できます（BYOKセキュリティ適用）。

---

## 3. データベーススキーマとマスタールール

システムのデータ整合性を保証するため、書き込み(Write)権限と参照(Read)権限を徹底して分離します。パイプラインは `domain` および `ext` スキーマを参照のみ行います。

### [RAW スキーマ: 原本データ] - パイプライン Write 許可
* **`raw.event_raw_source`**: マルチモーダル(音声、画像など)ファイルのメタデータ。
* **`raw.event_raw`**: 構造化パイプラインを通る前の未処理の非定型テキスト。

### [CORE スキーマ: ファクト、メモリ、および AI 算出物] - パイプライン Write 許可
* **`core.event_facts` (Detail 階層):** 構造化されたファクト原文およびメタデータ。
* **`core.event_memories` (Index 階層):** LTMおよびキャッシュ統合ベクターストア。
* **`core.event_logs`**: コンテキストが融合された最終短期日誌。
* **`core.event_briefings`**: 複数メモリをチェリーピッキングして生成した深層要約レポートのアーカイブ。
* **`core.event_creations`**: 短期日誌、レポート、その他の創作物を多重参照した二次創作物の保管所。
* **`core.batch_jobs`** & **`core.history_ext_sync`**: 一括合成ステータスとマイクロバッチ同期履歴テーブル。

### [DOMAIN スキーマ: マスターデータ] - JSONB および帯域分離戦略の適用
* **`domain.mst_entities` & `domain.mst_objects`:** 物理的なカラムの追加なしに、JSONBカラムを活用して取引先、従業員、プロジェクトなど無限の形式のマスターを単一のテーブル内に実装する仮想テーブル。パイプラインはこれらのテーブルを絶対に更新せず、参照のみを実施します。
* **`domain.mst_status`**: ツートラック帯域分離(ID Range)により、営業、資産などのビジネスカスタムステータスを動的に生成可能。
* **`domain.mst_prompts`**: ターゲットおよびパイプラインステップごとのプロンプト、`schema_name`、`temperature`、`max_length`値を保管。
* **`domain.mst_pipelines`**: パイプラインビルダーで組み立てた動的ノード構成JSON(`steps`配列)を永久保存するマスターテーブル。

### [EXT スキーマ: 外部定型データ] - パイプライン 参照専用
* **`ext_mst` & `ext_events`**: ERP、CRMなどの外部連携データをロードし、バックエンドはこれを変更せず、検索拡張用の外部データコンテキストとしてのみ読み込みます。

---

## 4. バックエンド コアビジネスロジック (API Flow)

### プロセス A: 【汎用ファクト構造化パイプライン】 (`raw` ➡️ `core`)

#### 1. **1次連携 (文脈整理)**
* `raw.event_raw`から未処理の非定型テキスト(`raw_content`)を取得します。

#### 2. **動的候補群の事前注入 (Dynamic Candidate Injection)**
* 原本を基に、バックエンドが`domain.mst_entities`を逆方向パターンマッチング(`ILIKE`)し、関連性の高い候補を5つ抽出します。
* JSONBの解析中に発生しうるDB 500エラーを根本から防ぐため、`jsonb_typeof`を利用したType Guard検証が適用されています。
* 抽出した候補をLLMのシステムプロンプトに注入することで、トークンの爆発なしにハルシネーションを抑え、正確なターゲット実名をDB ID(PK)にマッピングします。

#### 3. **ファクトロード (`core.event_facts`)**
* LRSEクライアント通信前に、`mst_prompts`から`temperature`と`max_length`を完全にUnpackingして物理的な制御パラメータとして注入します。
* 結果を`core.event_facts`に単独で保存し、`event_id`を発行します。

#### 4. **Append-Only ベース LTM ロード (`core.event_memories`)**
* 既存のメモリをマージ(Merge)したり更新(UPDATE)したりすることは絶対にありません。
* 構造化されたテキストをエンベディングし、`core.event_memories`に**無条件で新規INSERT**します。
* 該当レコードに行為主体(`base_entity_id`)と対象(`target_entity_id`, `target_object_id`)を永久に記録し、同時実行制御(Race Condition)を解決し、整合性を保証します。

#### 5. **状態アップデート**
* 成功時は`raw.event_raw`の状態を'1 (SYNCED)'に、失敗時は'2 (FAILED)'にマーキングし、エラーログを保存します。

### プロセス B: 【汎用コンテキスト合成】 (`core` ➡️ `core`)

#### 1. **短期ファクト(当日データ)の確保:**
* フロントエンドの`reference_date`を基準に、当日に発生した`core.event_facts`と`core.event_memories`を基に短期ファクトログを作成します。

#### 2. **マスター参照およびクエリ拡張 (Query Augmentation):**
* 当日のファクトに記録されたターゲットIDを基に`domain`スキーマを参照(Read)し、実名(Name)を確保します。
* エンベディング検索クエリに`[コアターゲットエンティティ: XXX]`の形式で注入し、ベクトル検索の重みを最大化します。

#### 3. **ツートラック(Dual-Track) RAGベース LTMの確保:**
* 単純な類似度検査の限界を超えるため、以下の2つのトラックを同時に実行します。
* **[Track 1: 関係中心検索]** 特定のターゲットに対する過去の記憶のみをフィルタリング(`WHERE target_entity_id = ? AND base_entity_id = ?`)し、連続性のある文脈を取得します。
* **[Track 2: グローバル文脈中心検索 (クロスエンティティインサイト)]** ターゲットエンティティのフィルタリングを解除してターゲット間の類似事例を検索しますが、**必ず自社テナント(`WHERE base_entity_id = ?`)内部の記憶のみを検索**するように隔離します。
* 時間減衰(Time Decay)ロジックを適用し、純粋なコサイン距離を測定した後、経過日数に応じたペナルティを加算し、最終的な`adjusted_distance`で再ソートします。検索はローカルキャッシュ(Tier 1)およびローカルpgvector(Tier 2)を最優先とし、必要に応じてBigQuery(Tier 3)にフォールバックする3-Tierルーティングを実行します。

#### 4. **エージェントプランニングおよび最終日誌作成 (`core.event_logs`):**
* エージェント(Agent)が要約と外部データを分析し、追加で必要な詳細ファクト原文(`FETCH_FACT_DETAILS`)やマスター情報を自ら判断してツールを呼び出します。
* 取得した詳細データを含めてLLM(LRSE)に伝達し、最終要約(`llm_summary`)とタスク(`action_items`)を生成および保存します。

### プロセス C: 【深層レポートおよび二次創作エンジン】
#### 1. **AI 要約レポート (Briefings):**
* ユーザーが直接チェリーピッキングした記憶(Memory)を渡すと、`MAX_FETCH_LIMIT`の防御壁をバイパスして、選択した原文全体を損失なく取得し、専門的な深層レポートを作成します。

#### 2. **創作スタジオ (Creations):**
* 複数のソースをマージし、希望するトーン＆マナーで二次創作物を生成します。原本の整合性を損なっていないかを`fact_preservation_check`フラグでファクトの歪曲(Hallucination)を検証します。

### ★ ノードベースの動的パイプライン (The Executor)
APIパイプラインロジックを「Node(モジュール)」単位で隔離し、`PipelineOrchestrator`がこれらを指揮。
1. **ペイロードパラダイムの転換 (Data -> Pipeline):**
* クライアントは`{"query": "...", "data": "..."}`形式の固定ペイロードではなく、「**どのノードを、どの順序で、どのパラメータを注入して実行するか**」という配列(`steps`)全体を送信します (`schemas.pipeline_schemas.PipelineExecutionRequest`)。

2. **動的テンプレートエンジン (Interpolation):**
* 前のステップ(Node A)の実行結果(`output_key`)は、次のステップ(Node B)のパラメータ内の`{{node_a_result}}`テンプレート変数によって、インメモリー状態(`PipelineContext`)を通じてランタイム時に動的に置換されます。

3. **単一トランザクションのロールバック整合性の保証:**
* オーケストレーターの実行ループは`with self.db.begin_nested():`で囲まれており、パイプライン中にエラーが発生した場合、前のノードで実行したすべてのDB操作(INSERTなど)が安全にロールバック(Rollback)され、孤児データを防ぎます。

### 使用可能なコアモジュール (Nodes Registry)

* **`LTM_Search`:** RAGオーケストレーターを呼び出してLTM/Cacheコンテキストをベクトル検索。
* **`Fetch_Ext_Data`:** 外部定型データ(EXTスキーマ)のインポート。
* **`Pre_Fact_Check`:** LLMのハルシネーションを防ぐためのLTM vs EXTデータの交差検証、および矛盾発生時のトランザクションの中断。
* **`LLM_Generate`:** 動的に注入されたPromptとSchemaに基づいてLRSEミドルウェアと通信し、データを構造化。
* **`Persist_DB`:** 算出された最終データをシステムテーブルに安全にUpsert。

---

## 5. アップデート履歴 (Changelog)
* **2026.09.04 (v0.3.2)**
  - LRSE v0.4.0のステートレスアーキテクチャへの対応（動的スキーマルーティングの連動）
  - 不要なスキャフォールディングファイル（template.py）および孤児コンポーネント（DomainModals.tsx）の削除によるプロジェクトの軽量化
  - Reactコンポーネント（EntityView, ObjectView, StatusView）内の未使用の状態（State）変数など、デッドコードの削除によるレンダリングの最適化

* **2026.08.30 (v0.3.1)**
  - `docker-compose start/stop`に基づく効率的なコンテナの通常起動プロセスを適用
  - システム設定管理のためのGNB統合および `[ADM]` 環境設定モーダルの更新

* **2026.08.29 (v0.3.0)**
  - ノードベースフレームワーク (Headless Engine) を全面導入。
  - フロントエンドのビジュアルパイプラインビルダー機能を追加 (`/builder`)。
  - パイプライン設計図(JSON Config)の保存用 `mst_pipelines` テーブルを追加。
  - `PipelineOrchestrator` および状態保存 `PipelineContext` の実装。
  - APIペイロードにトポロジカルソートベースの `steps` 配列スキーマ(`PipelineExecutionRequest`)を全面適用。

* **2026.08.27 (v0.2.1)**
  - 最高管理者専用のシステムデータエクスプローラー(DBブラウザ)機能およびUIの追加(`/system`)
  - SQLAlchemy MetaData Reflectionの導入により、動的クエリのアンチパターンを排除し、SQLインジェクションを根本から遮断
  - 大容量Vector(3072次元)およびJSONBオブジェクトのレンダリング時のDOM BloatおよびUI Freezing防御ロジックの適用

* **2026.08.25 (v0.2.0)**
  - エンタープライズ マルチテナント(Multi-Tenant)データセキュリティアーキテクチャの全面適用。
  - グローバルAPI DTOの `base_entity_id` 必須化およびフロントエンドとの連携完了。
  - RAG Orchestratorの Cross-Entity Search (Track 2) 時にテナント隔離ロジックを適用。
  - 削除時のカスケード孤立オブジェクト切断(Cascade Soft Disconnect)ロジックの完備。

* **2026.08.23 (v0.1.0)**
  - 初回リリース。

---

## 6. システムアーキテクチャおよびパイプラインダイアグラム

拡張性を考慮し、バックエンドAPIレイヤーを徹底的に分離されたモジュールに再編しました。

```text
[Defacto Universal LTM-Sync Engine Architecture]
├── 1. Trigger Layer (Client / Job / Event)
│   ├── スケジューリングバッチ (APScheduler - EXT 同期および10分周期ポーリング)
│   ├── 手動 API Call (手動積載、テキスト校正、二次創作、大量合成)
│   └── Event-Driven (Direct Local Storage Upload ➡️ BackgroundTask)
│
├── 2. API Gateway & Core Engine (FastAPI Routers)
│   │
│   ├── [pipeline_builder_router.py] (動的パイプラインオーケストレーションゲートウェイ)
│   ├── [pipeline_router.py] (Process A/B エンジン制御)
│   ├── [raw_router.py] (非定型データの手動積載および校正制御)
│   ├── [memory_router.py] (記憶探索および深層レポート制御)
│   ├── [creative_router.py] (二次創作スタジオおよびメタプロンプト制御)
│   ├── [log_router.py] (最終日誌の単一/大量Upsert制御)
│   ├── [master_router.py] (ドメインマスター制御 - Read/Write)
│   ├── [prompt_router.py] (プロンプトおよびJSONスキーマ動的マッピング制御)
│   ├── [scheduler_router.py] (マイクロバッチおよび大量合成のトリガー)
│   ├── [dashboard_router.py] (統計およびシステムインサイトの管制)
│   ├── [system_router.py] (システムデータ検索およびDBブラウザの制御)
│   └── [media_router.py] (マルチモーダルSTT/OCR非同期バックグラウンド処理)
│
├── 3. LLM RPC Middleware (LRSE Engine)
│   ├── ドメインに応じて動的に注入されるPydantic JSON Schemaの強制
│   ├── Token(max_length)およびTemperatureの物理的制御の注入
│   └── Validation失敗時のAuto Retry Loop動作
│
├── 4. Primary Database (PostgreSQL & pgvector)
│   ├── [Domain] mst_entities, mst_objects, mst_status, mst_prompts, mst_pipelines (マスター)
│   ├── [Ext/Raw] ext_mst, ext_events, event_raw_source, event_raw
│   └── [Core] event_facts, event_memories, event_logs, event_briefings, event_creations, history_ext_sync, batch_jobs
│
└── 5. Data Pipeline & Warehouse [Optional]
    ├── Datastream (PostgreSQLのWALベースCDCリアルタイムキャプチャ)
    └── BigQuery (データマート、アーカイブ、Cold-Tier RAGの実行)

```
