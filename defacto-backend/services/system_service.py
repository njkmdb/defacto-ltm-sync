import os
import logging
import math
import json
from sqlalchemy import text, Table, MetaData, select, func, and_, or_, cast, String
from sqlalchemy.orm import Session
from fastapi import HTTPException

logger = logging.getLogger(__name__)

ALLOWED_SCHEMAS = ["core", "domain", "ext", "raw"]

def get_system_config():
    use_bq = str(os.getenv("USE_BIGQUERY", "False")).lower() == "true"
    return {"status": "success", "use_bigquery": use_bq}

def get_tables(schema_name: str, db: Session):
    if schema_name not in ALLOWED_SCHEMAS:
        raise HTTPException(status_code=400, detail="허용되지 않은 스키마입니다.")
    
    query = text("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = :schema_name AND table_type = 'BASE TABLE'
        ORDER BY table_name;
    """)
    result = db.execute(query, {"schema_name": schema_name}).fetchall()
    tables = [row[0] for row in result]
    return {"status": "success", "data": tables}

def get_table_data(schema_name: str, table_name: str, page: int, limit: int, search_conditions: str, db: Session):
    if schema_name not in ALLOWED_SCHEMAS:
        raise HTTPException(status_code=400, detail="허용되지 않은 스키마입니다.")
        
    check_query = text("""
        SELECT EXISTS (
            SELECT 1 
            FROM information_schema.tables 
            WHERE table_schema = :schema_name AND table_name = :table_name AND table_type = 'BASE TABLE'
        )
    """)
    is_valid = db.execute(check_query, {"schema_name": schema_name, "table_name": table_name}).scalar()
    
    if not is_valid:
        raise HTTPException(status_code=404, detail="테이블을 찾을 수 없습니다.")

    offset = (page - 1) * limit
    
    try:
        metadata = MetaData(schema=schema_name)
        target_table = Table(table_name, metadata, autoload_with=db.get_bind())
    except Exception as e:
        logger.error(f"Table reflection failed: {e}")
        raise HTTPException(status_code=500, detail="테이블 메타데이터를 로드할 수 없습니다.")
    
    count_query = select(func.count()).select_from(target_table)
    data_query = select(target_table)

    if search_conditions:
        try:
            conds = json.loads(search_conditions)
            if conds and isinstance(conds, list):
                combined_expr = None
                for c in conds:
                    kw = c.get('keyword', '')
                    col_name = c.get('target', '')
                    if not kw.strip() or not col_name or col_name not in target_table.c:
                        continue
                    
                    col_obj = target_table.c[col_name]
                    expr = cast(col_obj, String).ilike(f"%{kw.strip()}%")
                    
                    if combined_expr is None:
                        combined_expr = expr
                    else:
                        op = c.get('operator', 'AND')
                        if op == 'OR':
                            combined_expr = or_(combined_expr, expr)
                        else:
                            combined_expr = and_(combined_expr, expr)
                
                if combined_expr is not None:
                    count_query = count_query.where(combined_expr)
                    data_query = data_query.where(combined_expr)
        except Exception as e:
            logger.error(f"다중 검색 파싱 오류 (System Explorer): {e}")

    total_count = db.execute(count_query).scalar() or 0
    
    data_query = data_query.limit(limit).offset(offset)
    result = db.execute(data_query)
    
    columns = list(result.keys())
    
    rows = []
    for row in result.fetchall():
        row_dict = {}
        for idx, col in enumerate(columns):
            val = row[idx]
            if hasattr(val, 'isoformat'):
                val = val.isoformat()
            elif hasattr(val, '__iter__') and not isinstance(val, (str, dict, list)):
                val = str(val) 
            row_dict[col] = val
        rows.append(row_dict)
        
    total_pages = math.ceil(total_count / limit) if total_count > 0 else 1
    
    return {
        "status": "success", 
        "data": {
            "columns": columns,
            "rows": rows
        },
        "meta": {
            "total_count": total_count,
            "current_page": page,
            "total_pages": total_pages,
            "limit": limit
        }
    }

# 👇 [추가된 부분] 동적 설정 파일 관리 로직
SETTINGS_PATH = os.path.join(os.getcwd(), "config_dynamic.json")

def get_dynamic_settings() -> dict:
    if os.path.exists(SETTINGS_PATH):
        try:
            with open(SETTINGS_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to read dynamic settings: {e}")
            
    # 설정 파일이 없으면 기존처럼 .env에서 읽어와 Fallback
    return {
        "GEMINI_API_KEY": os.getenv("GEMINI_API_KEY", ""),
        "MODEL_NAME": os.getenv("MODEL_NAME", "gemini-2.5-flash")
    }

def update_dynamic_settings(api_key: str, model_name: str) -> dict:
    settings = {
        "GEMINI_API_KEY": api_key,
        "MODEL_NAME": model_name
    }
    try:
        with open(SETTINGS_PATH, "w", encoding="utf-8") as f:
            json.dump(settings, f, ensure_ascii=False, indent=2)
        return {"status": "success", "message": "System settings updated successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save settings: {e}")