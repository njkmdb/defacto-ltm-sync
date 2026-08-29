from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.pipeline_router import router as pipeline_router 
from routers.log_router import router as log_router
from routers.master_router import router as master_router
from routers.media_router import router as media_router 
from routers.prompt_router import router as prompt_router 
from routers.scheduler_router import router as scheduler_router
from routers.raw_router import router as raw_router
from routers.memory_router import router as memory_router
from routers.dashboard_router import router as dashboard_router
from routers.creative_router import router as creative_router  
from routers.system_router import router as system_router
from routers.pipeline_builder_router import router as pipeline_builder_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    from services.scheduler_service import scheduler, run_ext_sync_job
    # 💡 서버 기동 시 스케줄러 시작 (10분 주기 배치)
    scheduler.add_job(run_ext_sync_job, 'interval', minutes=10, id='ext_sync_job', replace_existing=True)
    scheduler.start()
    yield
    # 💡 서버 종료 시 스케줄러를 안전하게 종료하여 메모리 릭 방지
    scheduler.shutdown()

app = FastAPI(title="Defacto LTM-Sync API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8080",
        "http://127.0.0.1:8080"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pipeline_router)
app.include_router(log_router)
app.include_router(master_router)
app.include_router(media_router)
app.include_router(prompt_router)
app.include_router(scheduler_router)
app.include_router(raw_router)
app.include_router(memory_router)
app.include_router(dashboard_router)
app.include_router(creative_router)  
app.include_router(system_router)
app.include_router(pipeline_builder_router)