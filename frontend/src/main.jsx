import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { asset, gift, selection } from './catalog.js';
import { ProductCatalog, ProductPage, productPath } from './ProductCatalog.jsx';
import './styles.css';

const steps = [
  ['Возьмите флаер', 'Бариста выдаст его при покупке напитка, который участвует в акции.'],
  ['Найдите магазин', 'Выберите участвующую точку РИВ ГОШ и возьмите флаер с собой.'],
  ['Покажите QR-код', 'Сотрудник отсканирует QR на бумажном флаере. Один флаер даёт право на один бальзам.'],
];

const demoShops = [
  { id: 'center', name: 'Центр', stock: '12 бальзамов' },
  { id: 'north', name: 'Север', stock: '6 бальзамов' },
  { id: 'south', name: 'Юг', stock: '0 бальзамов' },
];

const appStores = [
  ['App Store', 'https://apps.apple.com/ru/app/id1303445343'],
  ['Google Play', 'https://play.google.com/store/apps/details?id=ru.rivegauche.app'],
  ['RuStore', 'https://www.rustore.ru/catalog/app/ru.rivegauche.app'],
];

function Brand() {
  return <a className="brand" href="#top" aria-label="РИВ ГОШ, начало страницы">РИВ<span />ГОШ</a>;
}

function DemoMap({ disclosureRef }) {
  const [selected, setSelected] = useState(demoShops[0].id);
  const shop = demoShops.find(({ id }) => id === selected);

  return (
    <details ref={disclosureRef} className="map-disclosure">
      <summary>Посмотреть демо-карту</summary>
      <div className="map-layout">
        <div className="map-art" role="group" aria-label="Условная схема точек в Санкт-Петербурге">
          <span className="map-city">Санкт-Петербург</span>
          <span className="river" aria-hidden="true" />
          <span className="road road-a" aria-hidden="true" />
          <span className="road road-b" aria-hidden="true" />
          <span className="road road-c" aria-hidden="true" />
          <span className="road road-d" aria-hidden="true" />
          {demoShops.map(({ id, name }, index) => (
            <button key={id} type="button" className={`pin pin-${id}`} aria-label={name}
              aria-pressed={selected === id} onClick={() => setSelected(id)}>{index + 1}</button>
          ))}
        </div>
        <div className="map-panel">
          <label htmlFor="shop-choice">Демонстрационная точка</label>
          <select id="shop-choice" value={selected} onChange={(event) => setSelected(event.target.value)}>
            {demoShops.map(({ id, name }, index) => <option key={id} value={id}>{index + 1}. {name}</option>)}
          </select>
          <p role="status">Тестовый остаток: {shop.stock}</p>
          <p className="fine-print">Точки и остатки условные.</p>
        </div>
      </div>
    </details>
  );
}

function App() {
  const mapRef = useRef(null);

  function openMap() {
    mapRef.current.open = true;
  }

  return (
    <>
      <a className="skip-link" href="#main">К содержанию</a>
      <header className="site-header" id="top">
        <div className="wrap header-inner">
          <Brand />
          <nav aria-label="Навигация">
            <a href="#how">Как получить</a>
            <a href="#selection">Подборка</a>
          </nav>
          <a className="header-shop" href="#shops" onClick={openMap}>Где забрать</a>
        </div>
      </header>
      <main id="main">
        <section className="hero" aria-labelledby="hero-title">
          <div className="wrap hero-layout">
            <div className="hero-content">
              <p className="pilot-label">Учебный эксперимент</p>
              <h1 id="hero-title">Кофе с собой.<br />Бальзам в подарок.</h1>
              <p className="hero-copy">Покажите флаер из кофейни и заберите черешневый бальзам Eva Mosaic в РИВ ГОШ.</p>
              <p className="hero-note">Без покупки в магазине, регистрации и карты лояльности.</p>
              <div className="hero-actions">
                <a className="button button-dark" href="#shops" onClick={openMap}>Где забрать подарок</a>
                <a className="text-button" href={productPath(gift)}>О бальзаме</a>
              </div>
            </div>
            <div className="hero-art">
              <div className="hero-orbit" aria-hidden="true" />
              <img className="coffee" src={asset('coffee')} alt="Холодный кофе в розовом стакане" fetchPriority="high" />
              <img className="balm" src={asset('balm')} alt="Черешневый бальзам Eva Mosaic" fetchPriority="high" />
            </div>
          </div>
        </section>
        <ProductCatalog />
        <section className="section how" id="how" aria-labelledby="how-title">
          <div className="wrap how-layout">
            <h2 id="how-title">Как получить подарок</h2>
            <ol className="steps">
              {steps.map(([title, text]) => <li key={title}><h3>{title}</h3><p>{text}</p></li>)}
            </ol>
          </div>
        </section>
        <section className="wrap section shops" id="shops" aria-labelledby="shops-title">
          <div className="section-heading">
            <div>
              <h2 id="shops-title">Где забрать подарок</h2>
              <p>Список участвующих магазинов уточняется.</p>
            </div>
            <a className="button button-outline" href="https://rivegauche.ru/shops" target="_blank" rel="noopener noreferrer">Все магазины РИВ ГОШ</a>
          </div>
          <DemoMap disclosureRef={mapRef} />
        </section>
      </main>
      <footer className="footer">
        <div className="wrap footer-inner">
          <div><Brand /><p>Учебный проект</p></div>
          <div className="footer-links">
            <a href="https://rivegauche.ru/" target="_blank" rel="noopener noreferrer">Сайт РИВ ГОШ</a>
            <div className="app-links" aria-label="Магазины приложений">
              {appStores.map(([name, url]) => <a key={name} href={url} target="_blank" rel="noopener noreferrer">{name}</a>)}
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}

const productId = new URLSearchParams(window.location.search).get('product');
const product = [gift, ...selection].find(({ id }) => id === productId);
if (product) document.title = `${product.brand} ${product.name} — Кофе и черешня`;
createRoot(document.getElementById('root')).render(product ? <ProductPage product={product} /> : <App />);
