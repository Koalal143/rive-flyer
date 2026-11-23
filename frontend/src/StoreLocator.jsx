import React, { useEffect, useRef, useState } from 'react';

const yandexSearch = 'https://yandex.ru/maps/?text=' + encodeURIComponent('РИВ ГОШ');
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

function StoreMap({ mapKey, store }) {
  const container = useRef(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    if (!mapKey) return;
    let map;
    let disposed = false;

    loadYandexMaps(mapKey).then((maps) => {
      if (disposed) return;
      const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapMarker } = maps;
      const coordinates = [store.longitude, store.latitude];
      const marker = document.createElement('span');
      marker.className = 'locator-pin';
      marker.textContent = 'РИВ ГОШ';
      marker.title = store.name;

      map = new YMap(container.current, {
        location: { center: coordinates, zoom: 16 },
      });
      map.addChild(new YMapDefaultSchemeLayer());
      map.addChild(new YMapDefaultFeaturesLayer());
      map.addChild(new YMapMarker({ coordinates }, marker));
      setStatus('ready');
    }).catch(() => {
      if (disposed) return;
      map?.destroy();
      map = undefined;
      setStatus('error');
    });

    return () => {
      disposed = true;
      map?.destroy();
    };
  }, [mapKey, store]);

  if (!mapKey) return null;

  return (
    <div className="locator-map-panel">
      <div className="locator-map" ref={container} role="region" aria-label={`Карта: ${store.name}`} hidden={status === 'error'} />
      {status === 'loading' && <p className="locator-map-note" role="status">Загружаем карту…</p>}
      {status === 'error' && <p className="locator-map-note" role="status">Карта не загрузилась. Откройте адрес по ссылке выше.</p>}
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
    return 'Доступ к геолокации закрыт. Разрешите его в настройках сайта или воспользуйтесь поиском на Яндекс Картах.';
  }
  if (error.code === 3) {
    return 'Определение местоположения заняло слишком много времени. Попробуйте ещё раз.';
  }
  return 'Не удалось определить местоположение. Попробуйте ещё раз или откройте Яндекс Карты.';
}

function storeLink(store) {
  const coordinates = `${store.longitude},${store.latitude}`;
  const url = new URL('https://yandex.ru/maps/');
  url.search = new URLSearchParams({ ll: coordinates, z: '17', pt: `${coordinates},pm2rdm` }).toString();
  return url.href;
}

export function StoreLocator() {
  const [config, setConfig] = useState(null);
  const [lookup, setLookup] = useState({ phase: 'idle' });
  const { phase, message, result } = lookup;

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
      setLookup({ phase: 'error', message: 'Для геолокации откройте сайт по HTTPS или воспользуйтесь Яндекс Картами.' });
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
      setLookup({ phase: 'found', result: await response.json() });
    } catch {
      setLookup({ phase: 'error', message: 'Поиск магазинов сейчас недоступен. Попробуйте ещё раз или откройте Яндекс Карты.' });
    }
  }

  const busy = phase === 'locating' || phase === 'searching';
  const status = phase === 'locating' ? 'Определяем местоположение…'
    : phase === 'searching' ? 'Ищем ближайший магазин…'
    : message;
  const distance = result && (result.distance_m < 1000
    ? `${decimal.format(result.distance_m)} м`
    : `${decimal.format(result.distance_m / 1000)} км`);

  return (
    <div className="locator">
      <div className="locator-actions">
        <button className="button button-dark" type="button" onClick={locate} disabled={busy || !config?.search_source}>
          {result ? 'Обновить местоположение' : 'Найти ближайший магазин'}
        </button>
        <a className="locator-external" href={yandexSearch} target="_blank" rel="noopener noreferrer">Поиск на Яндекс Картах</a>
      </div>
      <div className="locator-status" role="status">
        {status}
        {config && !config.search_source && 'Онлайн-поиск на сайте пока недоступен. Магазины можно посмотреть на Яндекс Картах.'}
        {result && 'Ближайший магазин найден.'}
      </div>
      {result && (
        <div className="locator-result">
          <div>
            <p className="locator-distance">{distance} по прямой</p>
            <h3>{result.store.name}</h3>
            {result.store.address && <p>{result.store.address}</p>}
            {result.store.hours && <p>{result.store.hours}</p>}
          </div>
          <a className="button button-outline" href={storeLink(result.store)} target="_blank" rel="noopener noreferrer">
            Открыть в Яндекс Картах
          </a>
        </div>
      )}
      {result && <StoreMap key={`${result.store.latitude},${result.store.longitude}`} store={result.store} mapKey={config.map_key} />}
      {config?.search_source === 'yandex' && (
        <p className="fine-print locator-privacy">Для поиска приблизительное местоположение передаётся Яндекс Картам.</p>
      )}
    </div>
  );
}
