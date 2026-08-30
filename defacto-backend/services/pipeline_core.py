import re
import logging
from abc import ABC, abstractmethod
from typing import Dict, Any
from sqlalchemy.orm import Session

from schemas.pipeline_schemas import PipelineExecutionRequest

logger = logging.getLogger(__name__)

class PipelineContext:
    """
    [Core] 파이프라인 노드 간의 상태(State)와 테넌트 보안 컨텍스트를 유지하는 인메모리 저장소
    """
    def __init__(self, base_entity_id: int, initial_data: Dict[str, Any]):
        self.base_entity_id = base_entity_id
        # 💡 [버그 수정] 프론트엔드의 {{initial_context.xxx}} 변수 바인딩과 정확히 호환되도록 네스팅(Nesting) 구조로 래핑합니다.
        self.state: Dict[str, Any] = {"initial_context": initial_data.copy() if initial_data else {}}

    def resolve_params(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        프론트엔드가 주입한 params 내부의 "{{node_1.extracted_text}}" 형태의 템플릿 변수를 
        self.state에 저장된 실제 데이터로 동적 치환(Interpolation)하는 엔진입니다.
        """
        def _resolve_value(val: Any) -> Any:
            if isinstance(val, str):
                pattern = r"\{\{\s*([\w\.\_]+)\s*\}\}"
                matches = re.findall(pattern, val)
                if not matches:
                    return val

                # 문자열 자체가 통째로 변수인 경우 (예: "{{target_ids}}") - 객체 원본 유지
                if re.fullmatch(r"^\{\{\s*[\w\.\_]+\s*\}\}$", val.strip()):
                    return self._get_state_value(matches[0])

                # 문자열 내부에 변수가 섞여있는 경우 (예: "결과: {{count}}개") - String 병합
                resolved_str = val
                for match in matches:
                    state_val = self._get_state_value(match)
                    resolved_str = resolved_str.replace(f"{{{{{match}}}}}", str(state_val) if state_val is not None else "")
                return resolved_str
                
            elif isinstance(val, dict):
                return {k: _resolve_value(v) for k, v in val.items()}
            elif isinstance(val, list):
                return [_resolve_value(item) for item in val]
            else:
                return val

        return _resolve_value(params)

    def _get_state_value(self, path: str) -> Any:
        keys = path.split('.')
        val = self.state
        for k in keys:
            if isinstance(val, dict) and k in val:
                val = val[k]
            elif hasattr(val, k):
                val = getattr(val, k)
            else:
                return None
        return val


class BaseNode(ABC):
    """
    [Core] 모든 파이프라인 모듈이 반드시 구현해야 하는 추상 인터페이스
    """
    @abstractmethod
    async def execute(self, params: Dict[str, Any], context: PipelineContext, db: Session) -> Any:
        pass


class PipelineOrchestrator:
    """
    [Core] Headless Engine의 지휘자. 프론트엔드가 보낸 steps 배열을 읽고 
    단일 트랜잭션 내에서 순차 실행 및 Rollback 무결성을 보장합니다.
    """
    def __init__(self, db: Session):
        self.db = db
        self.registry: Dict[str, BaseNode] = {}

    def register_node(self, module_name: str, node_handler: BaseNode):
        """런타임 혹은 초기화 시점에 비즈니스 노드를 주입(DI) 받습니다."""
        self.registry[module_name] = node_handler

    async def execute(self, request: PipelineExecutionRequest) -> Dict[str, Any]:
        context = PipelineContext(request.base_entity_id, request.initial_context)
        
        with self.db.begin_nested():
            sorted_steps = sorted(request.steps, key=lambda x: x.step_order)
            
            for step in sorted_steps:
                logger.info(f"[Orchestrator] Executing Node: {step.step_id} (Module: {step.module_name})")
                
                node_handler = self.registry.get(step.module_name)
                if not node_handler:
                    raise ValueError(f"인가되지 않거나 알 수 없는 모듈이 호출되었습니다: {step.module_name}")
                
                resolved_params = context.resolve_params(step.params)
                result = await node_handler.execute(resolved_params, context, self.db)
                
                context.state[step.output_key] = result
                logger.info(f"[Orchestrator] Node {step.step_id} Completed. Output bound to '{step.output_key}'")
                
        return {"status": "success", "final_state": context.state}