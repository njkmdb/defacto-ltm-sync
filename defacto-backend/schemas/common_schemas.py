from pydantic import BaseModel

class PaginationMeta(BaseModel):
    total_count: int
    current_page: int
    total_pages: int
    limit: int

class ActionItem(BaseModel):
    task: str
    status_id: int
    due_date: str

class SaveSummaryResponse(BaseModel):
    status: str
    message: str

class SystemConfigResponse(BaseModel):
    status: str
    use_bigquery: bool

# 👇 [추가된 부분] 동적 설정 관리를 위한 스키마
class SystemSettingsResponse(BaseModel):
    api_key: str
    model_name: str

class UpdateSystemSettingsRequest(BaseModel):
    api_key: str
    model_name: str