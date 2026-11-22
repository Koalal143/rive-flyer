import React, { useLayoutEffect, useRef, useState } from 'react';
import { rubles, selection } from './catalog.js';

export function ProductCatalog({ onProduct }) {
  const [order, setOrder] = useState('default');
  const products = order === 'default'
    ? selection
    : [...selection].sort((a, b) => order === 'asc' ? a.price - b.price : b.price - a.price);

  return (
    <section className="wrap section selection" id="selection" aria-labelledby="selection-title">
      <div className="section-heading">
        <h2 id="selection-title">Бьюти-подборка</h2>
        <label className="sort">
          <span>Сортировка</span>
          <select value={order} onChange={(event) => setOrder(event.target.value)}>
            <option value="default">Как в подборке</option>
            <option value="asc">Сначала дешевле</option>
            <option value="desc">Сначала дороже</option>
          </select>
        </label>
      </div>
      <div className="product-grid">
        {products.map((product) => (
          <button className="product-card" key={product.id} type="button" onClick={() => onProduct(product)}>
            <span className={`product-media product-media--${product.id}`}>
              <img src={product.photos[0]} alt="" loading="lazy" />
            </span>
            <span className="product-brand">{product.brand}</span>
            <span className="product-name">{product.name}</span>
            <span className="product-type">{product.type}</span>
            <strong className="product-price">{rubles.format(product.price)}</strong>
          </button>
        ))}
      </div>
      <p className="fine-print">Цены из материалов проекта. В магазине цена может отличаться.</p>
    </section>
  );
}

export function ProductDialog({ product, onClose }) {
  const dialogRef = useRef(null);
  const [active, setActive] = useState(0);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  const fullName = `${product.brand} ${product.name}`;

  return (
    <dialog
      ref={dialogRef}
      className="quickview"
      aria-labelledby="quickview-title"
      onClose={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) dialogRef.current.close(); }}
    >
      <div className="quickview-layout">
        <form method="dialog" className="close-form">
          <button autoFocus type="submit" className="close-button" aria-label="Закрыть карточку">
            <span aria-hidden="true" />
          </button>
        </form>
        <div className="gallery">
          <div className="gallery-frame">
            <img src={product.photos[active]} alt={`${fullName}, фото ${active + 1}`} />
          </div>
          <div className="gallery-nav" aria-label="Фотографии товара">
            {product.photos.map((photo, index) => (
              <button
                key={photo}
                type="button"
                aria-label={`Фото ${index + 1}`}
                aria-pressed={active === index}
                onClick={() => setActive(index)}
              >
                <img src={photo} alt="" />
              </button>
            ))}
          </div>
        </div>
        <div className="quickview-copy">
          <p className="product-brand">{product.brand}</p>
          <h2 id="quickview-title">{product.name}</h2>
          <p className="quickview-type">{product.type}</p>
          <p>{product.detail}</p>
          <strong className="quickview-price">{product.price ? rubles.format(product.price) : 'В подарок'}</strong>
          <a href={product.url} className="button button-dark" target="_blank" rel="noopener noreferrer">На сайте РИВ ГОШ</a>
          <section className="quickview-description" aria-label="Описание товара">
            <p>{product.description}</p>
            <p className="fine-print">Артикул {product.code}</p>
          </section>
        </div>
      </div>
    </dialog>
  );
}
