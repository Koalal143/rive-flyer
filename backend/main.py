import json
import logging
import os
import re
from contextlib import asynccontextmanager
from math import asin, cos, radians, sin, sqrt
from pathlib import Path
from typing import Literal

import httpx
from fastapi import FastAPI, HTTPException, Request, Response
from pydantic import BaseModel, Field, TypeAdapter
from starlette.concurrency import run_in_threadpool

from analytics import router as analytics_router
from survey import initialize_survey, router as survey_router

SEARCH_URL = "https://search-maps.yandex.ru/v1/"
SEARCH_RADII_KM = (12, 50, 150)
EARTH_RADIUS_M = 6_371_008.8
FALLBACK_CATALOG = Path(__file__).with_name("data") / "stores-catalog.json"
logger = logging.getLogger("uvicorn.error")


class Coordinates(BaseModel):
    latitude: float = Field(ge=-90, le=90, allow_inf_nan=False)
    longitude: float = Field(ge=-180, le=180, allow_inf_nan=False)


class Store(Coordinates):
    name: str = Field(min_length=1)
    address: str | None = None
    hours: str | None = None
    gift_stock: int | None = Field(default=None, ge=0, strict=True)
    source: Literal["openstreetmap", "malls", "totadres", "directory"] | None = None
    source_url: str | None = None


class NearestStore(BaseModel):
    store: Store
    distance_m: int


class StoreLookup(NearestStore):
    other_stores: list[NearestStore]


class MapConfig(BaseModel):
    map_key: str | None
    search_source: str | None


def distance_m(origin: Coordinates, destination: Coordinates) -> float:
    lat1, lat2 = radians(origin.latitude), radians(destination.latitude)
    delta_lat = lat2 - lat1
    delta_lon = radians(destination.longitude - origin.longitude)
    a = sin(delta_lat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(delta_lon / 2) ** 2
    return 2 * EARTH_RADIUS_M * asin(sqrt(min(1, a)))


def nearest_store(origin: Coordinates, candidates: list[Store]) -> NearestStore | None:
    if not candidates:
        return None
    meters, store = min(
        ((distance_m(origin, store), store) for store in candidates),
        key=lambda result: result[0],
    )
    return NearestStore(store=store, distance_m=round(meters))


def nearby_fallback(origin: Coordinates, candidates: list[Store]) -> NearestStore | None:
    result = nearest_store(origin, candidates)
    if result is not None and result.distance_m <= SEARCH_RADII_KM[-1] * 1000:
        return result
    return None


def parse_search_results(payload: dict) -> list[Store]:
    features = payload["features"]
    if not isinstance(features, list):
        raise TypeError("Expected a GeoJSON feature list")

    stores = []
    for feature in features:
        try:
            company = feature["properties"]["CompanyMetaData"]
            name = company["name"]
            normalized = re.sub(r"[\W_]+", "", name.casefold())
            if not normalized.startswith(("ривгош", "домривгош", "rivegauche")):
                continue
            if "салонкрасоты" in normalized:
                continue
            geometry = feature["geometry"]
            if geometry["type"] != "Point":
                continue
            longitude, latitude = geometry["coordinates"]
            stores.append(Store(
                name=name,
                address=company.get("address") or (company.get("Address") or {}).get("formatted"),
                hours=(company.get("Hours") or {}).get("text"),
                latitude=latitude,
                longitude=longitude,
            ))
        except (AttributeError, KeyError, TypeError, ValueError):
            continue
    return stores


async def search_yandex(client: httpx.AsyncClient, key: str, origin: Coordinates) -> NearestStore | None:
    # Approximate the search centre for Yandex. Rank the returned stores using
    # the original coordinates, which stay in this request.
    centre = f"{origin.longitude:.3f},{origin.latitude:.3f}"
    for radius in SEARCH_RADII_KM:
        latitude_span = radius * 2 / 110.5 + 0.004
        longitude_span = min(360, latitude_span / max(0.01, cos(radians(origin.latitude))))
        response = await client.get(SEARCH_URL, params={
            "apikey": key,
            "text": "РИВ ГОШ",
            "type": "biz",
            "lang": "ru_RU",
            "ll": centre,
            "spn": f"{longitude_span:.5f},{latitude_span:.5f}",
            "rspn": 1,
            "results": 50,
        })
        response.raise_for_status()
        result = nearest_store(origin, parse_search_results(response.json()))
        if result is not None and result.distance_m <= radius * 1000:
            return result
    return None


@asynccontextmanager
async def lifespan(app: FastAPI):
    catalog_path = os.getenv("STORE_CATALOG_PATH", "").strip()
    catalog_type = TypeAdapter(list[Store])
    app.state.catalog = catalog_type.validate_json(Path(catalog_path).read_bytes()) if catalog_path else None
    app.state.fallback_catalog = catalog_type.validate_json(FALLBACK_CATALOG.read_bytes()) if FALLBACK_CATALOG.is_file() else []

    app.state.map_key = os.getenv("YANDEX_MAPS_API_KEY", "").strip() or None
    app.state.search_key = os.getenv("YANDEX_SEARCH_API_KEY", "").strip() or None
    await run_in_threadpool(initialize_survey)

    async with httpx.AsyncClient(timeout=httpx.Timeout(5, connect=3)) as client:
        app.state.search_client = client
        yield


app = FastAPI(title="RiveGaucheMVP — поиск магазинов", lifespan=lifespan)
app.include_router(analytics_router)
app.include_router(survey_router)


@app.get("/api/maps/config", response_model=MapConfig)
async def map_config(request: Request, response: Response) -> MapConfig:
    response.headers["Cache-Control"] = "no-store"
    source = None
    if request.app.state.catalog is not None:
        source = "catalog"
    elif request.app.state.search_key:
        source = "yandex"
    elif request.app.state.fallback_catalog:
        source = "catalog"
    return MapConfig(map_key=request.app.state.map_key, search_source=source)


@app.post("/api/stores/nearest", response_model=StoreLookup)
async def find_nearest(origin: Coordinates, request: Request, response: Response) -> StoreLookup:
    response.headers["Cache-Control"] = "no-store"
    state = request.app.state
    if state.catalog is not None:
        result = nearest_store(origin, state.catalog)
    elif state.search_key:
        try:
            result = await search_yandex(state.search_client, state.search_key, origin)
        except (httpx.HTTPError, json.JSONDecodeError, KeyError, TypeError) as error:
            reason = f"HTTP {error.response.status_code}" if isinstance(error, httpx.HTTPStatusError) else type(error).__name__
            logger.warning("Yandex organization search failed: %s", reason)
            result = nearby_fallback(origin, state.fallback_catalog)
            if result is None:
                raise HTTPException(502, detail="search_unavailable") from None
    elif state.fallback_catalog:
        result = nearby_fallback(origin, state.fallback_catalog)
    else:
        raise HTTPException(503, detail="search_not_configured")

    if result is None:
        raise HTTPException(404, detail="no_store_found")
    catalog = state.catalog if state.catalog is not None else state.fallback_catalog
    match = nearest_store(result.store, catalog)
    # The live search and the catalog may place the same shop at different entrances.
    duplicate = match.store if match and match.distance_m <= 80 else None
    other_stores = [
        NearestStore(store=store, distance_m=round(distance_m(origin, store)))
        for store in catalog
        if store != duplicate
    ]
    other_stores.sort(key=lambda entry: entry.distance_m)
    return StoreLookup(store=result.store, distance_m=result.distance_m, other_stores=other_stores)
