import logging
import os
from hashlib import sha256
from typing import Literal
from uuid import UUID

import psycopg
from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field, model_validator

router = APIRouter(prefix="/api/analytics")
logger = logging.getLogger("uvicorn.error")
PRODUCTS = {"eva", "holika", "influence", "tangle", "celimax"}
STORES = {"app_store", "google_play", "rustore"}


class Event(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    visit_id: UUID
    kind: Literal["visit", "active_time", "product_impression", "product_open", "site_click", "app_click"]
    target: str | None = Field(default=None, max_length=24)
    qr: str | None = Field(default=None, pattern=r"^[A-Za-z0-9_-]{1,100}$")
    duration_ms: int | None = Field(default=None, gt=0, le=30000, strict=True)

    @model_validator(mode="after")
    def validate_fields(self):
        if self.qr is not None and self.kind != "visit":
            raise ValueError("qr is only valid for visit events")
        if (self.kind == "active_time") != (self.duration_ms is not None):
            raise ValueError("duration_ms is required for active_time and unavailable for other events")
        targets = PRODUCTS if self.kind.startswith("product_") else STORES if self.kind == "app_click" else {None}
        if self.target not in targets:
            raise ValueError("invalid event target")
        return self


@router.post("/events", status_code=204)
def record_event(event: Event) -> Response:
    host = os.getenv("ANALYTICS_DB_HOST")
    if not host:
        raise HTTPException(503, detail="analytics_not_configured")

    qr_hash = sha256(event.qr.encode()).hexdigest() if event.qr else None
    try:
        with psycopg.connect(
            host=host,
            dbname="rivegauche_analytics",
            user="analytics_writer",
            password=os.environ["ANALYTICS_DB_PASSWORD"],
            connect_timeout=3,
        ) as connection:
            connection.execute(
                """
                INSERT INTO analytics_events (id, visit_id, kind, target, duration_ms, qr_hash)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT DO NOTHING
                """,
                (event.id, event.visit_id, event.kind, event.target, event.duration_ms, qr_hash),
            )
    except psycopg.Error as error:
        logger.warning("Could not record analytics event: %s", type(error).__name__)
        raise HTTPException(503, detail="analytics_unavailable") from None
    return Response(status_code=204)
