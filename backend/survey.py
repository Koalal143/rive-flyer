import logging
import os
import secrets
from html import escape
from typing import Annotated, Literal
from uuid import UUID
from zoneinfo import ZoneInfo

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import HTMLResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pydantic import BaseModel, ConfigDict, Field, model_validator

from analytics import connect_analytics

router = APIRouter()
logger = logging.getLogger("uvicorn.error")
basic_auth = HTTPBasic(auto_error=False, realm="Rive Gauche survey")
MOSCOW = ZoneInfo("Europe/Moscow")
PAGE_SIZE = 30
ADMIN_HEADERS = {
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; "
    "frame-ancestors 'none'; base-uri 'none'",
}
MOTIVATIONS = {
    "gift": "Бальзам в подарок",
    "selection": "Товар или цена из подборки",
    "on_the_way": "Магазин по пути",
    "none": "Ничего из перечисленного",
    "other": "Другое",
}
BARRIERS = {
    "in_a_hurry": "Спешу",
    "out_of_the_way": "Магазин не по пути",
    "gift_uninteresting": "Подарок неинтересен",
    "no_cosmetics_needed": "Сейчас не нужна косметика",
    "unclear_terms": "Условия непонятны",
    "none": "Ничего не помешало бы",
}
RECALL = {"nothing": "Ничего", "did_not_view": "Не смотрел подборку"}


class SurveyResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    visit_id: UUID
    motivations: list[Literal["gift", "selection", "on_the_way", "none", "other"]] = Field(min_length=1, max_length=4)
    barriers: list[Literal[
        "in_a_hurry", "out_of_the_way", "gift_uninteresting", "no_cosmetics_needed", "unclear_terms", "none",
    ]] = Field(min_length=1, max_length=5)
    motivation_other: str = Field(default="", max_length=250)
    clarity: str = Field(min_length=1, max_length=1000)
    recall_kind: Literal["text", "nothing", "did_not_view"]
    recall_text: str = Field(default="", max_length=1000)

    @model_validator(mode="after")
    def validate_answers(self):
        for options in (self.motivations, self.barriers):
            if len(set(options)) != len(options) or ("none" in options and len(options) > 1):
                raise ValueError("options must be distinct and none must stand alone")
        if ("other" in self.motivations) != bool(self.motivation_other):
            raise ValueError("other requires explanatory text")
        if (self.recall_kind == "text") != bool(self.recall_text):
            raise ValueError("recall text is required only for a written answer")
        if any("\x00" in value for value in (self.motivation_other, self.clarity, self.recall_text)):
            raise ValueError("answers cannot contain null characters")
        return self


def initialize_survey() -> None:
    if not os.getenv("ANALYTICS_DB_HOST"):
        return
    with connect_analytics() as connection:
        connection.execute("SELECT pg_advisory_xact_lock(912412304)")
        connection.execute("""
            CREATE TABLE IF NOT EXISTS offer_survey_responses (
                visit_id uuid PRIMARY KEY,
                motivations text[] NOT NULL,
                barriers text[] NOT NULL,
                motivation_other text NOT NULL,
                clarity text NOT NULL,
                recall_kind text NOT NULL,
                recall_text text NOT NULL,
                recorded_at timestamptz NOT NULL DEFAULT now()
            )
        """)
        connection.execute("""
            CREATE INDEX IF NOT EXISTS offer_survey_responses_time
            ON offer_survey_responses (recorded_at DESC, visit_id DESC)
        """)
        connection.execute("""
            CREATE OR REPLACE VIEW offer_survey_selections AS
            SELECT recorded_at, 'motivation'::text AS question, unnest(motivations) AS option
            FROM offer_survey_responses
            UNION ALL
            SELECT recorded_at, 'barrier'::text AS question, unnest(barriers) AS option
            FROM offer_survey_responses
        """)
        connection.execute("GRANT SELECT ON offer_survey_selections TO analytics_reader")


@router.post("/api/survey/responses", status_code=204)
def save_survey(response: SurveyResponse) -> Response:
    try:
        with connect_analytics() as connection:
            connection.execute(
                """
                INSERT INTO offer_survey_responses (
                    visit_id, motivations, barriers, motivation_other, clarity, recall_kind, recall_text
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (visit_id) DO NOTHING
                """,
                (response.visit_id, response.motivations, response.barriers, response.motivation_other,
                 response.clarity, response.recall_kind, response.recall_text),
            )
    except psycopg.Error as error:
        logger.warning("Could not save survey response: %s", type(error).__name__)
        raise HTTPException(503, detail="survey_unavailable") from None
    return Response(status_code=204)


def require_admin(request: Request, credentials: Annotated[HTTPBasicCredentials | None, Depends(basic_auth)]) -> None:
    if os.getenv("SURVEY_ADMIN_HTTPS_ONLY") == "true" and request.headers.get("x-forwarded-proto") != "https":
        raise HTTPException(403, detail="https_required", headers=ADMIN_HEADERS)
    password = os.getenv("SURVEY_ADMIN_PASSWORD")
    if not password:
        raise HTTPException(503, detail="survey_admin_not_configured", headers=ADMIN_HEADERS)
    if (credentials is None or credentials.username != "admin"
            or not secrets.compare_digest(credentials.password.encode(), password.encode())):
        raise HTTPException(401, detail="authentication_required", headers={
            **ADMIN_HEADERS, "WWW-Authenticate": 'Basic realm="Rive Gauche survey"',
        })


def render_response(row) -> str:
    recorded_at, motivations, barriers, other, clarity, recall_kind, recall_text = row
    date = recorded_at.astimezone(MOSCOW)
    motivation_labels = ", ".join(MOTIVATIONS[option] for option in motivations)
    if other:
        motivation_labels += f" — {other}"
    answers = (
        ("Что побудило бы зайти", motivation_labels),
        ("Что помешало бы зайти", ", ".join(BARRIERS[option] for option in barriers)),
        ("Как получить бальзам", clarity),
        ("Что запомнилось из подборки", RECALL.get(recall_kind, recall_text)),
    )
    details = "".join(
        f"<div><dt>{label}</dt><dd>{escape(value)}</dd></div>" for label, value in answers
    )
    return f'<article><time datetime="{date.isoformat()}">{date:%d.%m.%Y, %H:%M}</time><dl>{details}</dl></article>'


@router.get("/admin/survey", response_class=HTMLResponse, include_in_schema=False, dependencies=[Depends(require_admin)])
def survey_admin(page: Annotated[int, Query(ge=1, le=100000)] = 1) -> HTMLResponse:
    try:
        with connect_analytics() as connection:
            total = connection.execute("SELECT count(*) FROM offer_survey_responses").fetchone()[0]
            last_page = max(1, (total + PAGE_SIZE - 1) // PAGE_SIZE)
            page = min(page, last_page)
            rows = connection.execute(
                """
                SELECT recorded_at, motivations, barriers, motivation_other, clarity, recall_kind, recall_text
                FROM offer_survey_responses
                ORDER BY recorded_at DESC, visit_id DESC
                LIMIT %s OFFSET %s
                """,
                (PAGE_SIZE, (page - 1) * PAGE_SIZE),
            ).fetchall()
    except psycopg.Error as error:
        logger.warning("Could not load survey responses: %s", type(error).__name__)
        raise HTTPException(503, detail="survey_unavailable", headers=ADMIN_HEADERS) from None

    results = "".join(map(render_response, rows)) or "<p>Пока нет ответов.</p>"
    prev_link = f'<a href="?page={page - 1}">Назад</a>' if page > 1 else ""
    next_link = f'<a href="?page={page + 1}">Вперёд</a>' if page < last_page else ""
    pagination = (
        f'<nav aria-label="Страницы">{prev_link}<span>{page} из {last_page}</span>{next_link}</nav>'
        if last_page > 1 else ""
    )
    return HTMLResponse(f"""<!doctype html>
<html lang="ru">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ответы на опрос — РИВ ГОШ</title>
<style>
  * {{ box-sizing: border-box }}
  body {{ margin: 0; background: #fdf9fa; color: #292024; font: 16px/1.55 system-ui, sans-serif }}
  main {{ width: min(100% - 32px, 1100px); margin: 48px auto }}
  h1 {{ margin: 0; font-size: clamp(30px, 5vw, 48px); line-height: 1.1; letter-spacing: -.035em }}
  header p, time {{ color: #66545c }}
  article {{ border-top: 1px solid #e7dde0; padding: 20px 0 }}
  time {{ font-size: .85rem; font-variant-numeric: tabular-nums }}
  dl {{ display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 20px; margin: 8px 0 0 }}
  dt {{ font-weight: 650 }}
  dd {{ margin: 5px 0 0; white-space: pre-wrap; overflow-wrap: anywhere }}
  nav {{ display: flex; flex-wrap: wrap; gap: 20px; margin-top: 20px }}
  a {{ color: #862b4c }}
  :focus-visible {{ outline: 2px solid #862b4c; outline-offset: 4px }}
  @media (max-width: 760px) {{ dl {{ grid-template-columns: repeat(2, minmax(0, 1fr)) }} }}
  @media (max-width: 440px) {{ dl {{ grid-template-columns: 1fr; gap: 12px }} }}
</style>
<main>
<header><h1>Ответы на опрос</h1><p>Всего ответов — {total}. Время московское.</p></header>
{results}{pagination}
</main>
</html>""", headers=ADMIN_HEADERS)
