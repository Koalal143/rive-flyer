import React, { useEffect, useRef, useState } from 'react';
import { trackEvent } from './analytics.js';
import { ExperimentButton } from './ExperimentNotice.jsx';

const decimal = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
let loadingMaps;

function loadYandexMaps(key) {
  if (!loadingMaps) {
    const script = document.createElement('script');
    const url = new URL('https://api-maps.yandex.ru/v3/');
    url.search = new URLSearchParams({ apikey: key, lang: 'ru_RU' }).toString();
    script.src = url.href;
    script.referrerPolicy = 'origin';
    script.async = true;

    loadingMaps = new Promise((resolve, reject) => {
      const timeout = setTimeout(failed, 12000);

      function failed() {
        clearTimeout(timeout);
        reject(new Error('Яндекс Карты недоступны'));
      }

      script.onerror = failed;
      script.onload = () => {
        const maps = window.ymaps3;
        if (!maps?.ready) {
          failed();
          return;
        }
        maps.ready.then(() => {
          clearTimeout(timeout);
          resolve(maps);
        }, failed);
      };
      document.head.append(script);
    }).catch((error) => {
      script.remove();
      loadingMaps = undefined;
      throw error;
    });
  }
  return loadingMaps;
}

function StoreMap({ mapKey, places, selected, onSelect }) {
  const container = useRef(null);
  const markers = useRef([]);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    if (!mapKey) return;
    let map;
    let disposed = false;

    loadYandexMaps(mapKey).then((maps) => {
      if (disposed) return;
      const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapMarker } = maps;
      const { longitude, latitude } = places[0].store;
      map = new YMap(container.current, {
        location: { center: [longitude, latitude], zoom: places.length > 1 ? 12 : 16 },
      });
      map.addChild(new YMapDefaultSchemeLayer());
      map.addChild(new YMapDefaultFeaturesLayer());

      markers.current = places.map(({ store }, index) => {
        const button = document.createElement('button');
        const name = [store.name, store.address].filter(Boolean).join(', ');
        button.type = 'button';
        button.className = 'locator-marker';
        button.title = name;
        button.setAttribute('aria-label', name);
        button.setAttribute('aria-pressed', 'false');
        button.addEventListener('click', () => onSelect(index));

        const detail = document.createElement('span');
        detail.className = 'locator-pin';
        detail.setAttribute('aria-hidden', 'true');
        const brand = document.createElement('strong');
        brand.textContent = 'РИВ ГОШ';
        detail.append(brand);
        if (store.address) {
          const address = document.createElement('span');
          address.className = 'locator-pin-address';
          address.textContent = store.address;
          detail.append(address);
        }
        button.append(detail);

        const entity = new YMapMarker({
          coordinates: [store.longitude, store.latitude],
          blockEvents: true,
        }, button);
        map.addChild(entity);
        return { button, entity };
      });

      setStatus('ready');
      trackEvent('map_open');
    }).catch(() => {
      if (disposed) return;
      map?.destroy();
      map = undefined;
      markers.current = [];
      setStatus('error');
    });

    return () => {
      disposed = true;
      map?.destroy();
      markers.current = [];
    };
  }, [mapKey, places, onSelect]);

  useEffect(() => {
    markers.current.forEach(({ button, entity }, index) => {
      const pressed = String(index === selected);
      if (button.getAttribute('aria-pressed') === pressed) return;
      button.setAttribute('aria-pressed', pressed);
      entity.update({ zIndex: index === selected ? 1 : 0 });
    });
  }, [selected, status]);

  if (!mapKey) return null;

  return (
    <div className="locator-map-panel">
      <div className="locator-map" ref={container} role="region" aria-label="Магазины РИВ ГОШ на карте" hidden={status === 'error'} />
      {status === 'loading' && <p className="locator-map-note" role="status">Загружаем карту…</p>}
      {status === 'error' && <p className="locator-map-note" role="status">Карта не загрузилась. Адрес магазина указан выше.</p>}
      {status === 'ready' && (
        <div className="fine-print locator-map-meta">
          {places.length > 1 && <span>Нажмите на метку, чтобы выбрать магазин.</span>}
          {places.some(({ store }) => store.source === 'openstreetmap') && (
            <a className="locator-credit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap</a>
          )}
        </div>
      )}
    </div>
  );
}

function getPosition() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 12000, maximumAge: 60000 });
  });
}

function positionError(error) {
  if (error.code === 1) {
    return 'Доступ к геолокации закрыт. Разрешите его в настройках сайта и попробуйте ещё раз.';
  }
  if (error.code === 3) {
    return 'Определение местоположения заняло слишком много времени. Попробуйте ещё раз.';
  }
  return 'Не удалось определить местоположение. Попробуйте ещё раз.';
}

export function StoreLocator() {
  const [config, setConfig] = useState(null);
  const [lookup, setLookup] = useState({ phase: 'idle' });
  const [selected, setSelected] = useState(0);
  const { phase, message, places } = lookup;
  const result = places?.[selected];

  useEffect(() => {
    const request = new AbortController();

    fetch('/api/maps/config', { signal: request.signal, cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('Не удалось получить настройки');
        return response.json();
      })
      .then(setConfig)
      .catch(() => {
        if (!request.signal.aborted) setConfig({ search_source: null });
      });

    return () => request.abort();
  }, []);

  async function locate() {
    if (!window.isSecureContext || !navigator.geolocation) {
      setLookup({ phase: 'error', message: 'Для геолокации откройте сайт по HTTPS.' });
      return;
    }

    setLookup({ phase: 'locating' });
    let position;
    try {
      position = await getPosition();
    } catch (error) {
      setLookup({ phase: 'error', message: positionError(error) });
      return;
    }

    setLookup({ phase: 'searching' });
    try {
      const { latitude, longitude } = position.coords;
      const response = await fetch('/api/stores/nearest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ latitude, longitude }),
      });
      if (response.status === 404) {
        setLookup({ phase: 'error', message: 'Поблизости не нашлось магазина РИВ ГОШ.' });
        return;
      }
      if (!response.ok) throw new Error('Поиск недоступен');
      const { store, distance_m, other_stores = [] } = await response.json();
      setSelected(0);
      setLookup({ phase: 'found', places: [{ store, distance_m }, ...other_stores] });
    } catch {
      setLookup({ phase: 'error', message: 'Поиск магазинов сейчас недоступен. Попробуйте ещё раз.' });
    }
  }

  const busy = phase === 'locating' || phase === 'searching';
  const status = phase === 'locating' ? 'Определяем местоположение…'
    : phase === 'searching' ? 'Ищем ближайший магазин…'
    : message;
  const distance = result && (result.distance_m < 1000
    ? `${decimal.format(result.distance_m)} м`
    : `${decimal.format(result.distance_m / 1000)} км`);
  const action = result ? 'Обновить местоположение' : 'Найти ближайший магазин';

  return (
    <div className="locator">
      <div className="locator-actions">
        <div>
          <h3 className="locator-title">{result && selected !== 0 ? 'Выбранный магазин' : 'Ближайший магазин'}</h3>
          <p className="locator-hint">{result ? 'Обновить местоположение' : 'По вашему местоположению'}</p>
        </div>
        <button className="locator-trigger" type="button" aria-label={action} title={action} onClick={locate} disabled={busy || !config?.search_source}>
          {busy ? <span className="locator-spinner" aria-hidden="true" /> : <span className="locator-chevron" aria-hidden="true" />}
        </button>
      </div>
      <div className={result ? 'visually-hidden' : 'locator-status'} role="status">
        {status}
        {config && !config.search_source && 'Поиск магазинов на сайте пока недоступен.'}
        {places && 'Ближайший магазин найден.'}
      </div>
      {result && (
        <div className="locator-result">
          <div aria-live="polite" aria-atomic="true">
            <p className="locator-distance">{distance} по прямой</p>
            <h3>{result.store.name}</h3>
            {result.store.address && <address className="locator-address">{result.store.address}</address>}
            {result.store.hours && <p>{result.store.hours}</p>}
          </div>
          <ExperimentButton className="button button-outline">
            Открыть в Яндекс Картах
          </ExperimentButton>
        </div>
      )}
      {places && <StoreMap places={places} selected={selected} onSelect={setSelected} mapKey={config?.map_key} />}
      {(phase === 'error' || (config && !config.search_source)) && (
        <ExperimentButton className="locator-external link-button">Поиск на Яндекс Картах</ExperimentButton>
      )}
      {config?.search_source === 'yandex' && (
        <p className="fine-print locator-privacy">Для поиска приблизительное местоположение передаётся Яндекс Картам.</p>
      )}
    </div>
  );
}
