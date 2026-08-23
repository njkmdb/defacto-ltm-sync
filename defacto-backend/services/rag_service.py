# 💡 [Facade Pattern 적용] 
# 기존 RagService는 인프라스트럭처별(Local DB, Google BigQuery)로 계층이 분리되었으며, 
# 두 계층을 지휘하는 RagOrchestrator 로 통합 개편되었습니다.
# 외부 라우터 호환성을 위해 클래스 이름을 매핑하여 내보냅니다.

from .rag_orchestrator import RagOrchestrator as RagService