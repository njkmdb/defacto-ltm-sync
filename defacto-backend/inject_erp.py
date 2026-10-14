import argparse
import logging
import os
import sys
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Any, Dict, List, Optional

sys.path.append(os.getcwd())

from sqlalchemy.orm import Session
from database.database import SessionLocal
from database.models import ExtEvent, ExtMst

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("defacto.erp_seeder")


@dataclass(frozen=True)
class SyntheticErpEventSpec:
    """Pre-Fact Check(교차 검증) 및 RAG 파이프라인 테스트용 합성 ERP 이벤트 명세."""

    base_entity_id: int
    ext_source: str
    event_type: str
    event_amount: Decimal
    attributes: Dict[str, Any]
    event_date: Optional[date] = None


DEFAULT_SYNTHETIC_ERP_EVENTS: List[SyntheticErpEventSpec] = [
    # 1. Pre-Fact Check 교차 검증 시나리오용 Ground-Truth 데이터 (기존 호환 유지)
    SyntheticErpEventSpec(
        base_entity_id=1024,
        ext_source="ERP_SYSTEM",
        event_type="CONTRACT",
        event_amount=Decimal("3000000.00"),
        attributes={
            "target_name": "미래통상",
            "target_name_ja": "未来通商株式会社",
            "target_name_en": "Mirae Trading Co., Ltd.",
            "memo": "미래통상 초기 계약금액 확정건 (ERP Ground-Truth)",
            "currency": "KRW",
            "verification_tier": "STRICT_AUDIT",
        },
    ),
    # 2. 일본어/글로벌 B2B 엔터프라이즈 SLA 계약 샘플 데이터
    SyntheticErpEventSpec(
        base_entity_id=1024,
        ext_source="SAP_S4HANA",
        event_type="INVOICE",
        event_amount=Decimal("12500000.00"),
        attributes={
            "target_name": "E2E_アルファオメガ_ソリューションズ",
            "memo": "エンタープライズLLMOps基盤ライセンス年間契約",
            "currency": "JPY",
            "verification_tier": "STRICT_AUDIT",
        },
    ),
]


def seed_synthetic_erp_events(
    db: Session,
    specs: Optional[List[SyntheticErpEventSpec]] = None,
    reference_date: Optional[date] = None,
) -> int:
    """
    지정된 합성 ERP 정형 이벤트 목록을 ext.ext_events 테이블에 안전하게 적재합니다.
    """
    target_specs = specs if specs is not None else DEFAULT_SYNTHETIC_ERP_EVENTS
    effective_date = reference_date or date.today()
    inserted_count = 0

    for spec in target_specs:
        record = ExtEvent(
            base_entity_id=spec.base_entity_id,
            event_date=spec.event_date or effective_date,
            ext_source=spec.ext_source,
            event_type=spec.event_type,
            event_amount=spec.event_amount,
            attributes=spec.attributes,
        )
        db.add(record)
        inserted_count += 1

    db.commit()
    return inserted_count


def inject_fake_erp(
    base_entity_id: int = 1024,
    include_extended_samples: bool = False,
) -> int:
    """
    [Backward-Compatible Entrypoint]
    Pre-Fact Check 교차 검증 테스트를 위한 합성 ERP Ground-Truth 데이터를 주입합니다.
    """
    db = SessionLocal()
    try:
        specs = (
            DEFAULT_SYNTHETIC_ERP_EVENTS
            if include_extended_samples
            else [DEFAULT_SYNTHETIC_ERP_EVENTS[0]]
        )
        seeded_specs = [
            SyntheticErpEventSpec(
                base_entity_id=base_entity_id,
                ext_source=s.ext_source,
                event_type=s.event_type,
                event_amount=s.event_amount,
                attributes=s.attributes,
                event_date=s.event_date,
            )
            for s in specs
        ]
        count = seed_synthetic_erp_events(db, specs=seeded_specs)
        logger.info(
            "✅ Synthetic ERP ground-truth seeded into ext.ext_events (tenant=%d, records=%d)",
            base_entity_id,
            count,
        )
        return count
    except Exception as exc:
        db.rollback()
        logger.error("❌ Failed to seed synthetic ERP data: %s", str(exc))
        raise
    finally:
        db.close()


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Seed synthetic ERP ground-truth records into ext.ext_events for Pre-Fact Check QA."
    )
    parser.add_argument(
        "--tenant-id",
        type=int,
        default=1024,
        help="Target tenant base_entity_id (default: 1024)",
    )
    parser.add_argument(
        "--extended",
        action="store_true",
        help="Include multi-lingual (KO/JA/EN) B2B enterprise sample records",
    )
    return parser.parse_args()


if __name__ == "__main__":
    cli_args = _parse_args()
    inject_fake_erp(
        base_entity_id=cli_args.tenant_id,
        include_extended_samples=cli_args.extended,
    )