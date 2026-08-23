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