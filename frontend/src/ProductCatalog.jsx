import React, { useEffect, useRef, useState } from 'react';
import { rubles, selection } from './catalog.js';
import { ExperimentButton } from './ExperimentNotice.jsx';
import { withMetricsPreference } from './analytics.js';

const featuredProducts = selection.slice(0, 2);
const otherProducts = selection.slice(2);
const comparisonDelay = 700;
const comparisonThreshold = 0.24;

export function productPath(product) {
  return withMetricsPreference(`?product=${product.id}`);
}

function CompetitorPrice({ price }) {
  return (
    <span className="competitor-tag">
      <span className="competitor-label">У конкурента</span>
      <strong>{rubles.format(price)}</strong>
    </span>
  );
}

function ProductCard({ product, featured = false }) {
  return (
    <a className={`product-card${featured ? ' product-card--featured' : ''}`}
      href={productPath(product)} data-analytics-product={product.id}>
      <span className={`product-media product-media--${product.id}`}>
        <img src={product.photos[0]} alt="" loading="lazy" />
        {product.id === 'tangle' && <img src={product.photos[1]} alt="" loading="lazy" />}
      </span>
      <span className="product-card-body">
        <span className="product-info">
          <span className="product-brand" lang="en">{product.brand}</span>
          <span className="product-name" lang="en">{product.name}</span>
          {featured && <span className="product-variant">{product.detail}</span>}
        </span>
        <span className="product-pricing">
          <span className="product-primary-price">
            <span className="product-price-label">В РИВ ГОШ</span>
            <strong className="product-price">{rubles.format(product.price)}</strong>
          </span>
          {product.competitorPrice != null && (
            <CompetitorPrice price={product.competitorPrice} />
          )}
        </span>
      </span>
      {featured && <span className="product-card-arrow chevron" aria-hidden="true" />}
    </a>
  );
}

export function ProductCatalog() {
  const previewRef = useRef(null);
  const panelRef = useRef(null);
  const toggleRef = useRef(null);
  const [comparisonReady, setComparisonReady] = useState(false);
  const [order, setOrder] = useState(() => window.history.state?.catalogOrder ?? 'default');
  const [{ expanded, animate }, setDisclosure] = useState(() => ({
    expanded: window.location.hash === '#selection-more' || window.history.state?.catalogExpanded !== false,
    animate: false,
  }));

  useEffect(() => {
    if (comparisonReady) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motion.matches || !('IntersectionObserver' in window)) {
      setComparisonReady(true);
      return;
    }

    let timer;
    const preview = previewRef.current;
    const observer = new IntersectionObserver((entries) => {
      clearTimeout(timer);
      if (entries.at(-1).intersectionRatio >= comparisonThreshold && !document.hidden) {
        timer = setTimeout(() => setComparisonReady(true), comparisonDelay);
      }
    }, { threshold: comparisonThreshold, rootMargin: '-76px 0px 0px' });

    function syncVisibility() {
      clearTimeout(timer);
      if (document.hidden) observer.unobserve(preview);
      else observer.observe(preview);
    }

    function onMotionChange() {
      if (motion.matches) setComparisonReady(true);
    }

    syncVisibility();
    document.addEventListener('visibilitychange', syncVisibility);
    motion.addEventListener('change', onMotionChange);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      document.removeEventListener('visibilitychange', syncVisibility);
      motion.removeEventListener('change', onMotionChange);
    };
  }, [comparisonReady]);

  useEffect(() => {
    if (window.location.hash === '#selection-more') {
      panelRef.current.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
  }, []);

  function changeOrder(event) {
    const value = event.target.value;
    window.history.replaceState({ ...window.history.state, catalogOrder: value }, '');
    setOrder(value);
  }

  function setExpanded(value, shouldAnimate) {
    const hash = !value && window.location.hash === '#selection-more' ? '#selection' : undefined;
    window.history.replaceState({ ...window.history.state, catalogExpanded: value }, '', hash);
    setDisclosure({ expanded: value, animate: shouldAnimate });
  }

  function collapseFromEnd(event) {
    setExpanded(false, event.detail > 0);
    toggleRef.current.focus({ preventScroll: true });
    toggleRef.current.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }

  const products = order === 'default'
    ? otherProducts
    : [...otherProducts].sort((a, b) => order === 'asc' ? a.price - b.price : b.price - a.price);

  return (
    <section className="wrap section selection" id="selection" aria-labelledby="selection-title">
      <div className="selection-preview" ref={previewRef} data-comparison-ready={comparisonReady}>
        <div className="selection-intro">
          <h2 id="selection-title">Бьюти-подборка</h2>
          <p>Два средства для макияжа до 500 ₽</p>
        </div>
        <div className="selection-feature">
          {featuredProducts.map((product) => <ProductCard key={product.id} product={product} featured />)}
        </div>
      </div>

      <div className="selection-controls" data-animated={animate}>
        <button className="selection-toggle" type="button" ref={toggleRef}
          aria-expanded={expanded} aria-controls="selection-more"
          onClick={(event) => setExpanded(!expanded, event.detail > 0)}>
          {expanded ? 'Скрыть остальные товары' : `Показать ещё ${otherProducts.length} товаров`}
          <span className="selection-toggle-icon" aria-hidden="true" />
        </button>
        <p className="fine-print">Цены для учебного сравнения. Цены и наличие могут меняться.</p>
      </div>

      <div className="selection-panel" id="selection-more" role="region" ref={panelRef}
        aria-labelledby="selection-more-title" inert={!expanded} data-expanded={expanded} data-animated={animate}>
        <div className="selection-panel-clip">
          <div className="selection-panel-content">
            <div className="selection-more-heading">
              <h3 id="selection-more-title">Ещё {otherProducts.length} товаров</h3>
              <label className="sort">
                <span className="visually-hidden">Сортировка остальных товаров</span>
                <select value={order} onChange={changeOrder}>
                  <option value="default">Как в подборке</option>
                  <option value="asc">Сначала дешевле</option>
                  <option value="desc">Сначала дороже</option>
                </select>
              </label>
            </div>
            <div className="product-list">
              {products.map((product) => <ProductCard key={product.id} product={product} />)}
            </div>
            <button className="selection-collapse text-button" type="button" onClick={collapseFromEnd}>Свернуть подборку</button>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductGallery({ product }) {
  const [{ index: active, animate }, setPhoto] = useState({ index: 0, animate: false });
  const touchStart = useRef(null);
  const total = product.photos.length;
  const fullName = `${product.brand} ${product.name}`;

  function changePhoto(direction, shouldAnimate) {
    setPhoto(({ index }) => ({ index: (index + direction + total) % total, animate: shouldAnimate }));
  }

  function handleGalleryKey(event) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    changePhoto(event.key === 'ArrowRight' ? 1 : -1, false);
  }

  function beginSwipe(event) {
    if (event.pointerType !== 'touch' || !event.isPrimary) return;
    touchStart.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function endSwipe(event) {
    const start = touchStart.current;
    if (!start || start.id !== event.pointerId) return;
    touchStart.current = null;
    const xDistance = event.clientX - start.x;
    const yDistance = event.clientY - start.y;
    if (Math.abs(xDistance) >= 44 && Math.abs(xDistance) > Math.abs(yDistance) * 1.25) {
      changePhoto(xDistance < 0 ? 1 : -1, true);
    }
  }

  function cancelSwipe(event) {
    if (touchStart.current?.id === event.pointerId) touchStart.current = null;
  }

  return (
    <section className="gallery" aria-label="Фотографии товара" onKeyDown={handleGalleryKey}>
      <div className="gallery-frame">
        <div className="gallery-stage" data-animate={animate}
          onPointerDown={beginSwipe} onPointerUp={endSwipe}
          onPointerCancel={cancelSwipe} onLostPointerCapture={cancelSwipe}>
          {product.photos.map((photo, index) => (
            <img key={photo} src={photo} aria-hidden={active !== index} draggable="false"
              alt={`${fullName}, фото ${index + 1} из ${total}`} />
          ))}
        </div>
        {total > 1 && (
          <div className="gallery-footer">
            <div className="gallery-nav" role="group" aria-label="Выбор фотографии">
              {product.photos.map((photo, index) => (
                <button key={photo} type="button" aria-label={`Фото ${index + 1}`}
                  aria-pressed={active === index} onClick={(event) => setPhoto({ index, animate: event.detail > 0 })}>
                  <img src={photo} alt="" />
                </button>
              ))}
            </div>
            <div className="gallery-controls">
              <button className="photo-control photo-prev" aria-label="Предыдущее фото" type="button"
                onClick={(event) => changePhoto(-1, event.detail > 0)} />
              <span className="gallery-count" aria-hidden="true">{active + 1} / {total}</span>
              <button className="photo-control photo-next" aria-label="Следующее фото" type="button"
                onClick={(event) => changePhoto(1, event.detail > 0)} />
            </div>
          </div>
        )}
      </div>
      <p className="visually-hidden" role="status">Фото {active + 1} из {total}</p>
    </section>
  );
}

export function ProductPage({ product }) {
  const isGift = product.price === 0;
  const backHref = isGift ? './' : featuredProducts.includes(product) ? './#selection' : './#selection-more';
  const backLabel = isGift ? 'Вернуться к акции' : 'Вернуться к подборке';

  return (
    <div className="product-detail">
      <a className="skip-link" href="#product-main">К содержанию</a>
      <header className="detail-header">
        <div className="wrap detail-header-inner">
          <a className="detail-back" href={withMetricsPreference(backHref)}>{backLabel}</a>
          <a className="detail-campaign" href={withMetricsPreference("./")}>Кофе и черешня</a>
          <ExperimentButton className="detail-store link-button" eventKind="site_click">Сайт РИВ ГОШ</ExperimentButton>
        </div>
      </header>
      <main className="wrap product-page" id="product-main">
        <div className="product-overview">
          <div className="detail-intro">
            <p className="detail-brand">{product.brand}</p>
            <h1 lang="en">{product.name}</h1>
            <p className="detail-type">{product.type}</p>
          </div>
          <ProductGallery product={product} />
          <div className="detail-purchase">
            <div className="detail-price-row">
              <strong className="detail-price">{isGift ? 'Подарок в прототипе' : rubles.format(product.price)}</strong>
              <p className="detail-variant">{product.detail}</p>
            </div>
            {product.competitorPrice != null && (
              <div className="detail-comparison">
                <CompetitorPrice price={product.competitorPrice} />
              </div>
            )}
            {isGift && <a className="button button-dark" href={withMetricsPreference("./#survey")}>Пройти опрос</a>}
            <ExperimentButton className={isGift ? 'detail-pickup link-button' : 'button button-dark'}
              eventKind="site_click">Открыть на сайте РИВ ГОШ</ExperimentButton>
            {!isGift && <p className="fine-print">Цена приведена для демонстрации подборки.</p>}
          </div>
        </div>
        <section className="product-specs" aria-labelledby="specs-title">
          <div className="specs-description">
            <h2 id="specs-title">О товаре</h2>
            <p>{product.description}</p>
          </div>
          <dl aria-label="Характеристики">
            <div><dt>Тип товара</dt><dd>{product.type}</dd></div>
            <div><dt>{product.detailLabel}</dt><dd>{product.detail}</dd></div>
            {product.code && <div><dt>Артикул</dt><dd>{product.code}</dd></div>}
          </dl>
        </section>
      </main>
    </div>
  );
}
