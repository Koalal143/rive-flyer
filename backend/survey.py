import logging
import os
import secrets
from html import escape
from typing import Annotated, Literal
from uuid import UUID, uuid4
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
PRICE_LEVEL = {
    "much_lower": "Значительно ниже", "lower": "Скорее ниже", "same": "Примерно такой же",
    "higher": "Скорее выше", "much_higher": "Значительно выше", "unsure": "Затрудняюсь ответить",
}
PRICE_EXPECTATIONS = {
    "much_lower": "Значительно ниже ожидаемых", "lower": "Немного ниже ожидаемых",
    "same": "Соответствуют ожиданиям", "higher": "Немного выше ожидаемых",
    "much_higher": "Значительно выше ожидаемых", "unsure": "У меня не было определённых ожиданий",
}
VISIT_MOTIVATIONS = {
    "prices": "Цены на представленные товары", "assortment": "Ассортимент товаров",
    "gift": "Бальзам в подарок", "location": "Удобное расположение магазина",
    "none": "Ничего из перечисленного", "other": "Другое",
}
PriceChoice = Literal["much_lower", "lower", "same", "higher", "much_higher", "unsure"]


class GiftSurveyResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    visit_id: UUID
    price_level: PriceChoice
    affordability: int = Field(ge=1, le=5, strict=True)
    purchase_intent: int = Field(ge=1, le=5, strict=True)
    price_expectations: PriceChoice
    motivations: list[Literal["prices", "assortment", "gift", "location", "none", "other"]] = Field(
        min_length=1, max_length=5,
    )
    motivation_other: str = Field(default="", max_length=250)
    barrier: str = Field(min_length=1, max_length=1000)

    @model_validator(mode="after")
    def validate_answers(self):
        if len(set(self.motivations)) != len(self.motivations) or (
            "none" in self.motivations and len(self.motivations) > 1
        ):
            raise ValueError("motivations must be distinct and none must stand alone")
        if self.motivation_other and "other" not in self.motivations:
            raise ValueError("motivation_other requires other")
        if "\x00" in self.motivation_other or "\x00" in self.barrier:
            raise ValueError("answers cannot contain null characters")
        return self


class GiftCode(BaseModel):
    gift_code: UUID


def initialize_survey() -> None:
    if not os.getenv("ANALYTICS_DB_HOST"):
        return
    with connect_analytics() as connection:
        connection.execute("SELECT pg_advisory_xact_lock(912412304)")
        connection.execute("""
            CREATE TABLE IF NOT EXISTS offer_survey_v2 (
                visit_id uuid PRIMARY KEY,
                price_level text NOT NULL,
                affordability smallint NOT NULL CHECK (affordability BETWEEN 1 AND 5),
                purchase_intent smallint NOT NULL CHECK (purchase_intent BETWEEN 1 AND 5),
                price_expectations text NOT NULL,
                motivations text[] NOT NULL,
                motivation_other text NOT NULL,
                barrier text NOT NULL,
                gift_code uuid UNIQUE NOT NULL,
                recorded_at timestamptz NOT NULL DEFAULT now()
            )
        """)
        connection.execute("""
            CREATE INDEX IF NOT EXISTS offer_survey_v2_time ON offer_survey_v2 (recorded_at DESC, visit_id DESC)
        """)
        connection.execute("""
            CREATE OR REPLACE VIEW offer_survey_v2_selections AS
            SELECT s.recorded_at, answer.question, answer.option
            FROM offer_survey_v2 AS s
            CROSS JOIN LATERAL (
                VALUES ('price_level', s.price_level), ('affordability', s.affordability::text),
                       ('purchase_intent', s.purchase_intent::text), ('price_expectations', s.price_expectations)
            ) AS answer(question, option)
            UNION ALL
            SELECT recorded_at, 'motivation', unnest(motivations) FROM offer_survey_v2
        """)
        connection.execute("GRANT SELECT ON offer_survey_v2_selections TO analytics_reader")


@router.post("/api/survey/v2/responses", response_model=GiftCode)
def save_gift_survey(response: GiftSurveyResponse) -> GiftCode:
    try:
        with connect_analytics() as connection:
            saved = connection.execute(
                """
                INSERT INTO offer_survey_v2 (
                    visit_id, price_level, affordability, purchase_intent, price_expectations,
                    motivations, motivation_other, barrier, gift_code
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (visit_id) DO NOTHING RETURNING gift_code
                """,
                (response.visit_id, response.price_level, response.affordability, response.purchase_intent,
                 response.price_expectations, response.motivations, response.motivation_other,
                 response.barrier, uuid4()),
            ).fetchone()
            if saved is None:
                saved = connection.execute(
                    "SELECT gift_code FROM offer_survey_v2 WHERE visit_id = %s", (response.visit_id,),
                ).fetchone()
    except psycopg.Error as error:
        logger.warning("Could not save gift survey: %s", type(error).__name__)
        raise HTTPException(503, detail="survey_unavailable") from None
    return GiftCode(gift_code=saved[0])


@router.get("/gift/{gift_code}", response_class=HTMLResponse, include_in_schema=False)
def verify_gift(gift_code: UUID) -> HTMLResponse:
    try:
        with connect_analytics() as connection:
            issued = connection.execute(
                "SELECT 1 FROM offer_survey_v2 WHERE gift_code = %s", (gift_code,),
            ).fetchone()
    except psycopg.Error as error:
        logger.warning("Could not verify gift code: %s", type(error).__name__)
        raise HTTPException(503, detail="gift_verification_unavailable") from None
    title = "Демонстрационный код подтверждён" if issued else "Код не найден"
    message = ("Код создан в учебном прототипе и не даёт права на получение подарка в РИВ ГОШ."
               if issued else "Проверьте QR-код, выданный после опроса.")
    return HTMLResponse(f"""<!doctype html>
<html lang="ru">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} — Учебный эксперимент</title>
<main style="max-width:34rem;margin:12vh auto;padding:1.5rem;font:1rem/1.5 system-ui,sans-serif;color:#292024">
<p style="font-weight:700;color:#862b4c">Учебный эксперимент</p>
<h1>{title}</h1>
<p>{message}</p>
<a href="/#survey" style="color:#862b4c">На лендинг</a>
</main>
</html>""", status_code=200 if issued else 404, headers=ADMIN_HEADERS)


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
    recorded_at, price_level, affordability, intent, expectations, motivations, other, barrier = row
    date = recorded_at.astimezone(MOSCOW)
    motivation_labels = ", ".join(VISIT_MOTIVATIONS[option] for option in motivations)
    if other:
        motivation_labels += f" — {other}"
    answers = (
        ("Уровень цен", PRICE_LEVEL[price_level]),
        ("Доступность цен", f"{affordability} из 5"),
        ("Готовность рассмотреть магазин", f"{intent} из 5"),
        ("Цены и ожидания", PRICE_EXPECTATIONS[expectations]),
        ("Что побудило бы зайти", motivation_labels),
        ("Что помешало бы зайти", barrier),
    )
    details = "".join(
        f"<div><dt>{label}</dt><dd>{escape(value)}</dd></div>" for label, value in answers
    )
    return f'<article><time datetime="{date.isoformat()}">{date:%d.%m.%Y, %H:%M}</time><dl>{details}</dl></article>'


@router.get("/admin/survey", response_class=HTMLResponse, include_in_schema=False, dependencies=[Depends(require_admin)])
def survey_admin(page: Annotated[int, Query(ge=1, le=100000)] = 1) -> HTMLResponse:
    try:
        with connect_analytics() as connection:
            total = connection.execute("SELECT count(*) FROM offer_survey_v2").fetchone()[0]
            last_page = max(1, (total + PAGE_SIZE - 1) // PAGE_SIZE)
            page = min(page, last_page)
            rows = connection.execute(
                """
                SELECT recorded_at, price_level, affordability, purchase_intent, price_expectations,
                       motivations, motivation_other, barrier
                FROM offer_survey_v2
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
