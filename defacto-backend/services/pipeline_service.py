# 💡 [Facade Pattern 적용] 
# 기존 pipeline_service.py의 수많은 로직이 도메인별(SRP)로 완벽히 분리되었습니다.
# 하지만 기존에 이 파일을 Import 하고 있던 라우터(Router)들의 하위 호환성을 100% 보장하기 위해
# 분리된 서비스 모듈들을 다시 하나로 모아주는 배럴(Barrel) 파일 역할을 수행합니다.

from .extraction_service import process_structure_events, get_pipeline_status
from .synthesis_service import process_synthesize_context, execute_fetch_detailed_facts, execute_fetch_entity_master, execute_fetch_object_master, get_ext_data_text
from .batch_service import bulk_synthesize_task
from .prompt_manager import get_dynamic_prompt, DEFAULT_PROMPTS, HierarchicalFactSchema, EventBriefingSchema