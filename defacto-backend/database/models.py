from datetime import datetime
from sqlalchemy import Column, Integer, BigInteger, SmallInteger, String, Text, DateTime, Date, ForeignKey, Boolean, Numeric, Index, CheckConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import declarative_base, relationship
from pgvector.sqlalchemy import Vector

Base = declarative_base()

# =====================================================================
# 1. DOMAIN 스키마: 마스터 데이터
# =====================================================================
class MstStatus(Base):
    __tablename__ = 'mst_status'
    __table_args__ = {'schema': 'domain'}

    status_id = Column(SmallInteger, primary_key=True)
    domain_category = Column(String(50), nullable=False)
    status_name = Column(String(100), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    up_ts = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    ne_ts = Column(DateTime, default=datetime.utcnow, nullable=False)

class MstEntity(Base):
    __tablename__ = 'mst_entities'
    __table_args__ = {'schema': 'domain'}

    entity_id = Column(BigInteger, primary_key=True, autoincrement=True)
    parent_entity_id = Column(BigInteger, ForeignKey('domain.mst_entities.entity_id'), nullable=True)
    entity_type = Column(String(50), nullable=False)
    entity_name = Column(String(200), nullable=False)
    attributes = Column(JSONB, default={})
    entity_status_id = Column(SmallInteger, ForeignKey('domain.mst_status.status_id'), default=1, nullable=False)
    up_ts = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    ne_ts = Column(DateTime, default=datetime.utcnow, nullable=False)

class MstObject(Base):
    __tablename__ = 'mst_objects'
    __table_args__ = {'schema': 'domain'}

    object_id = Column(BigInteger, primary_key=True, autoincrement=True)
    parent_object_id = Column(BigInteger, ForeignKey('domain.mst_objects.object_id'), nullable=True)
    object_type = Column(String(50), nullable=False)
    object_name = Column(String(200), nullable=False)
    attributes = Column(JSONB, default={})
    object_status_id = Column(SmallInteger, ForeignKey('domain.mst_status.status_id'), default=1, nullable=False)
    up_ts = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    ne_ts = Column(DateTime, default=datetime.utcnow, nullable=False)

class MstPrompt(Base):
    __tablename__ = 'mst_prompts'
    __table_args__ = {'schema': 'domain'}

    prompt_id = Column(BigInteger, primary_key=True, autoincrement=True)
    target_type = Column(String(50), nullable=False)
    target_value = Column(String(50), nullable=False)
    pipeline_step = Column(String(50), nullable=False)
    schema_name = Column(String(100), nullable=False)
    system_prompt = Column(Text, nullable=False)
    temperature = Column(Numeric(3, 2), default=0.7, nullable=False)
    max_length = Column(Integer, default=1000, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    up_ts = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    ne_ts = Column(DateTime, default=datetime.utcnow, nullable=False)

class MstPipeline(Base):
    __tablename__ = 'mst_pipelines'
    __table_args__ = {'schema': 'domain'}

    pipeline_id = Column(String(50), primary_key=True)
    pipeline_name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    config_json = Column(JSONB, nullable=False, default=[])
    is_active = Column(Boolean, default=True, nullable=False)
    up_ts = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    ne_ts = Column(DateTime, default=datetime.utcnow, nullable=False)

# =====================================================================
# 2. RAW 스키마: 비정형 원본 데이터 및 미디어 소스
# =====================================================================
class EventRawSource(Base):
    __tablename__ = 'event_raw_source'
    __table_args__ = {'schema': 'raw'}

    source_id = Column(BigInteger, primary_key=True, autoincrement=True)
    source_type = Column(String(50), nullable=False)
    file_url = Column(Text, nullable=False)
    status_id = Column(SmallInteger, ForeignKey('domain.mst_status.status_id'), default=1)
    up_ts = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    ne_ts = Column(DateTime, default=datetime.utcnow)

class EventRaw(Base):
    __tablename__ = 'event_raw'
    __table_args__ = {'schema': 'raw'}

    raw_id = Column(BigInteger, primary_key=True, autoincrement=True)
    source_id = Column(BigInteger, ForeignKey('raw.event_raw_source.source_id'), nullable=True)
    base_entity_id = Column(BigInteger, ForeignKey('domain.mst_entities.entity_id'), nullable=False)
    event_date = Column(Date, nullable=False)
    raw_content = Column(Text, nullable=False)
    sync_status_id = Column(SmallInteger, ForeignKey('domain.mst_status.status_id'), default=0)
    error_log = Column(Text)
    up_ts = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    ne_ts = Column(DateTime, default=datetime.utcnow)

# =====================================================================
# 3. CORE 스키마: [Detail 계층: 대뇌 피질] 완벽히 정제/구조화된 상세 팩트 보관소
# =====================================================================
class EventFact(Base):
    __tablename__ = 'event_facts'
    __table_args__ = {'schema': 'core'}

    event_id = Column(BigInteger, primary_key=True, autoincrement=True)
    raw_id = Column(BigInteger, ForeignKey('raw.event_raw.raw_id', ondelete='CASCADE'))
    base_entity_id = Column(BigInteger, ForeignKey('domain.mst_entities.entity_id'), nullable=False)
    target_entity_id = Column(BigInteger, ForeignKey('domain.mst_entities.entity_id'), nullable=False, default=0)
    target_object_id = Column(BigInteger, ForeignKey('domain.mst_objects.object_id'), nullable=False, default=0)
    event_date = Column(Date, nullable=False)
    schema_name = Column(String(100), nullable=False)
    
    fact_content = Column(Text, nullable=False, default='', comment="LLM이 교정 및 정돈한 상세 팩트 줄글")
    attributes = Column(JSONB, default={}, comment="금액, 품목 등 구조화된 Key-Value 메타데이터")
    
    up_ts = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    ne_ts = Column(DateTime, default=datetime.utcnow, nullable=False)

# =====================================================================
# 4. CORE 스키마: [Index 계층: 해마] 벡터 검색 및 LLM 1차 스캔용 초경량 요약/색인
# =====================================================================
class EventMemory(Base):
    __tablename__ = 'event_memories'
    __table_args__ = (
        Index('ix_event_memories_keywords_gin', 'core_keywords', postgresql_using='gin'),
        {'schema': 'core'}
    )

    memory_id = Column(BigInteger, primary_key=True, autoincrement=True)
    base_entity_id = Column(BigInteger, ForeignKey('domain.mst_entities.entity_id'), nullable=False)
    target_entity_id = Column(BigInteger, ForeignKey('domain.mst_entities.entity_id'), nullable=False, default=0)
    target_object_id = Column(BigInteger, ForeignKey('domain.mst_objects.object_id'), nullable=False, default=0)
    event_date = Column(Date, nullable=False)
    memory_type = Column(String(20), nullable=False)
    domain_context = Column(String(50))
    
    content_text = Column(Text, nullable=False, comment="검색 및 LLM 1차 스캔용 초압축 요약")
    core_keywords = Column(JSONB, default=[], comment="['단가 인하', '클레임'] 등 키워드 배열") 
    embedding = Column(Vector(3072))
    source_event_ids = Column(JSONB, nullable=False, default=[], comment="[1042, 1088] 형태의 event_id 배열") 
    
    exp_ts = Column(DateTime, nullable=True)
    ne_ts = Column(DateTime, default=datetime.utcnow, nullable=False)

# =====================================================================
# 5. CORE 스키마: 최종 일지 및 대량 작업 관리
# =====================================================================
class EventLog(Base):
    __tablename__ = 'event_logs'
    __table_args__ = {'schema': 'core'}

    log_id = Column(BigInteger, primary_key=True, autoincrement=True)
    base_entity_id = Column(BigInteger, ForeignKey('domain.mst_entities.entity_id'), nullable=False)
    log_date = Column(Date, nullable=False)
    schema_name = Column(String(100), nullable=False)
    llm_summary = Column(Text, nullable=False)
    action_items = Column(JSONB)
    up_ts = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    ne_ts = Column(DateTime, default=datetime.utcnow, nullable=False)

class BatchJob(Base):
    __tablename__ = 'batch_jobs'
    __table_args__ = {'schema': 'core'}

    job_id = Column(String(50), primary_key=True)
    job_type = Column(String(50), nullable=False)
    status = Column(String(20), nullable=False)
    total_count = Column(Integer, default=0, nullable=False)
    current_count = Column(Integer, default=0, nullable=False)
    error_log = Column(Text)
    up_ts = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    ne_ts = Column(DateTime, default=datetime.utcnow, nullable=False)

# =====================================================================
# 6. CORE 스키마: AI 요약 리포트 아카이브 (사이드카)
# =====================================================================
class EventBriefing(Base):
    __tablename__ = 'event_briefings'
    __table_args__ = {'schema': 'core'}

    briefing_id = Column(BigInteger, primary_key=True, autoincrement=True)
    base_entity_id = Column(BigInteger, ForeignKey('domain.mst_entities.entity_id'), nullable=False)
    query_text = Column(String(500), nullable=False)
    executive_summary = Column(Text, nullable=False)
    key_findings = Column(JSONB, default=[])
    risk_and_warnings = Column(JSONB, default=[])
    recommended_actions = Column(JSONB, default=[])
    source_memory_ids = Column(JSONB, default=[], comment="Audit Trail (감사 추적)을 위한 근거 메모리 ID 배열")
    up_ts = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    ne_ts = Column(DateTime, default=datetime.utcnow, nullable=False)

class ExtSyncHistory(Base):
    __tablename__ = 'history_ext_sync'
    __table_args__ = {'schema': 'core'}

    sync_id = Column(BigInteger, primary_key=True, autoincrement=True)
    sync_type = Column(String(20), nullable=False)
    status = Column(String(20), nullable=False)
    records_fetched = Column(Integer, default=0, nullable=False)
    error_message = Column(Text)
    start_ts = Column(DateTime, default=datetime.utcnow, nullable=False)
    end_ts = Column(DateTime, nullable=True)
    up_ts = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    ne_ts = Column(DateTime, default=datetime.utcnow, nullable=False)

# =====================================================================
# 7. CORE 스키마: 2차 창작 보관소
# =====================================================================
class EventCreation(Base):
    __tablename__ = 'event_creations'
    __table_args__ = {'schema': 'core'}

    creation_id = Column(BigInteger, primary_key=True, autoincrement=True)
    base_entity_id = Column(BigInteger, ForeignKey('domain.mst_entities.entity_id'), nullable=False)
    
    source_log_ids = Column(JSONB, default=[], nullable=False, comment="참조한 단기 일지 ID 배열")
    source_briefing_ids = Column(JSONB, default=[], nullable=False, comment="참조한 심층 리포트 ID 배열")
    source_creation_ids = Column(JSONB, default=[], nullable=False, comment="3차 창작 시 참조한 부모 창작물 ID 배열")
    
    tone_name = Column(String(50), nullable=False, comment="적용된 톤앤매너 프리셋 이름")
    creative_title = Column(String(200), nullable=False)
    creative_content = Column(Text, nullable=False)
    
    up_ts = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    ne_ts = Column(DateTime, default=datetime.utcnow, nullable=False)

# =====================================================================
# 8. EXT 스키마: 범용 외부 정형 데이터
# =====================================================================
class ExtMst(Base):
    __tablename__ = 'ext_mst'
    __table_args__ = {'schema': 'ext'}

    ext_mst_id = Column(BigInteger, primary_key=True, autoincrement=True)
    base_entity_id = Column(BigInteger, nullable=False)
    ext_source = Column(String(50), nullable=False, comment="데이터 출처 (예: ERP, CRM)")
    ext_type = Column(String(50), nullable=False, comment="데이터 유형 (예: CUSTOMER_GRADE, SALES_METRIC)")
    attributes = Column(JSONB, default={}, comment="범용 정형 속성 (JSONB 형태)")
    up_ts = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    ne_ts = Column(DateTime, default=datetime.utcnow, nullable=False)

class ExtEvent(Base):
    __tablename__ = 'ext_events'
    __table_args__ = {'schema': 'ext'}

    ext_event_id = Column(BigInteger, primary_key=True, autoincrement=True)
    base_entity_id = Column(BigInteger, nullable=False)
    event_date = Column(Date, nullable=False)
    ext_source = Column(String(50), nullable=False, comment="데이터 출처")
    event_type = Column(String(50), nullable=False, comment="이벤트 유형 (예: ORDER, INVOICE, CLAIM)")
    event_amount = Column(Numeric(15, 2), default=0.0, comment="관련 금액 (선택적 사용)")
    attributes = Column(JSONB, default={}, comment="기타 범용 속성 (JSONB 형태)")
    up_ts = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    ne_ts = Column(DateTime, default=datetime.utcnow, nullable=False)