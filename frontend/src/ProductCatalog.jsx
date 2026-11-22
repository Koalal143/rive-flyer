import React, { useRef, useState } from 'react';
import { rubles, selection } from './catalog.js';

export function productPath(product) {
  return `?product=${product.id}`;
}

export function ProductCatalog() {
  const [order, setOrder] = useState(() => window.history.state?.catalogOrder ?? 'default');
  function changeOrder(event) {
    const value = event.target.value;
    window.history.replaceState({ ...window.history.state, catalogOrder: value }, '');
    setOrder(value);
  }

  const products = order === 'default'
    ? selection
    : [...selection].sort((a, b) => order === 'asc' ? a.price - b.price : b.price - a.price);

  return (
    <section className="wrap section selection" id="selection" aria-labelledby="selection-title">
      <div className="section-heading">
        <h2 id="selection-title">Бьюти-подборка</h2>
        <label className="sort">
          <span>Сортировка</span>
          <select value={order} onChange={changeOrder}>
            <option value="default">Как в подборке</option>
            <option value="asc">Сначала дешевле</option>
            <option value="desc">Сначала дороже</option>
          </select>
        </label>
      </div>
      <div className="product-grid">
        {products.map((product) => (
          <a className="product-card" key={product.id} href={productPath(product)} data-scroll-reveal="">
            <span className={`product-media product-media--${product.id}`}>
              <img src={product.photos[0]} alt="" loading="lazy" />
              {product.id === 'tangle' && <img src={product.photos[1]} alt="" loading="lazy" />}
            </span>
            <span className="product-info">
              <span className="product-brand" lang="en">{product.brand}</span>
              <span className="product-name" lang="en">{product.name}</span>
            </span>
            <strong className="product-price">{rubles.format(product.price)}</strong>
          </a>
        ))}
      </div>
      <p className="fine-print">Цены из материалов проекта. В магазине цена может отличаться.</p>
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
  const backHref = isGift ? './' : './#selection';
  const backLabel = isGift ? 'Вернуться к акции' : 'Вернуться к подборке';

  return (
    <div className="product-detail">
      <a className="skip-link" href="#product-main">К содержанию</a>
      <header className="detail-header">
        <div className="wrap detail-header-inner">
          <a className="detail-back" href={backHref}>{backLabel}</a>
          <a className="detail-campaign" href="./">Кофе и черешня</a>
          <a className="detail-store" href="https://rivegauche.ru/" target="_blank" rel="noopener noreferrer">Сайт РИВ ГОШ</a>
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
              <strong className="detail-price">{isGift ? 'В подарок по флаеру' : rubles.format(product.price)}</strong>
              <p className="detail-variant">{product.detail}</p>
            </div>
            {isGift && <a className="button button-dark" href="./#shops">Где забрать подарок</a>}
            <a href={product.url} className={isGift ? 'detail-pickup' : 'button button-dark'}
              target="_blank" rel="noopener noreferrer">Открыть на сайте РИВ ГОШ</a>
            {!isGift && <p className="fine-print">Цену и наличие в магазине можно уточнить на сайте РИВ ГОШ.</p>}
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
            <div><dt>Артикул</dt><dd>{product.code}</dd></div>
          </dl>
        </section>
      </main>
    </div>
  );
}
