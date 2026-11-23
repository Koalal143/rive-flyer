import React, { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { asset, gift, selection } from './catalog.js';
import { ProductCatalog, ProductPage, productPath } from './ProductCatalog.jsx';
import { StoreLocator } from './StoreLocator.jsx';
import { OfferSurvey } from './OfferSurvey.jsx';
import { startAnalytics } from './analytics.js';
import './styles.css';

const steps = [
  ['Возьмите флаер', 'Бариста выдаст его при покупке напитка, который участвует в акции.'],
  ['Найдите магазин', 'Выберите участвующую точку РИВ ГОШ и возьмите флаер с собой.'],
  ['Покажите QR-код', 'Сотрудник отсканирует QR на бумажном флаере. Один флаер даёт право на один бальзам.'],
];

const appStores = [
  ['App Store', 'https://apps.apple.com/ru/app/id1303445343', 'app-store.svg'],
  ['Google Play', 'https://play.google.com/store/apps/details?id=ru.rivegauche.app', 'google-play.png'],
  ['RuStore', 'https://www.rustore.ru/catalog/app/ru.rivegauche.app', 'rustore.png'],
];

function Brand() {
  return <a className="brand" href="#top" aria-label="РИВ ГОШ, начало страницы">РИВ<span />ГОШ</a>;
}

function App() {
  const mainRef = useRef(null);

  useEffect(() => {
    if (!('IntersectionObserver' in window) || !Element.prototype.animate) return;

    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const ready = new WeakSet();
    const cardThreshold = 0.16;
    const flyerThreshold = 0.32;
    let pendingHero;

    function playReveal(element, frames, duration, delay = 0) {
      const animation = element.animate(frames, {
        duration,
        delay,
        easing: 'cubic-bezier(.22, .62, .31, 1)',
        fill: 'backwards',
      });
      animation.id = 'scroll-reveal';
    }

    async function revealHero(target) {
      const coffee = target.querySelector('.coffee');
      const balm = target.querySelector('.balm');
      const decoded = Promise.allSettled([coffee.decode(), balm.decode()]);
      pendingHero = decoded;
      await decoded;
      if (pendingHero !== decoded || reducedMotion.matches) return;
      pendingHero = null;

      const resting = { opacity: 1, translate: '0 0', rotate: '0deg' };
      playReveal(coffee, [{ opacity: 0, translate: '-14px 24px', rotate: '-5deg' }, resting], 820);
      playReveal(balm, [{ opacity: 0, translate: '15px 19px', rotate: '8deg' }, resting], 740, 130);
    }

    const observer = new IntersectionObserver((entries) => {
      for (const { isIntersecting, intersectionRatio, target } of entries) {
        const kind = target.dataset.scrollReveal;
        if (!isIntersecting) {
          ready.add(target);
          if (kind === 'hero') pendingHero = null;
          for (const animation of target.getAnimations({ subtree: kind === 'hero' })) {
            if (animation.id === 'scroll-reveal') animation.cancel();
          }
          continue;
        }
        const threshold = kind === 'flyer' ? flyerThreshold : cardThreshold;
        if (intersectionRatio < threshold || !ready.delete(target)) continue;
        if (reducedMotion.matches || target.matches(':focus-within')) continue;

        if (kind === 'hero') {
          void revealHero(target);
          continue;
        }

        const isFlyer = kind === 'flyer';
        const delay = parseFloat(getComputedStyle(target).getPropertyValue('--reveal-delay')) || 0;
        playReveal(target, [
          { opacity: 0, transform: isFlyer ? 'translateY(13px) scale(.95)' : 'translateY(14px)' },
          { opacity: 1, transform: 'none' },
        ], isFlyer ? 620 : 480, delay);
      }
    }, { threshold: [0, cardThreshold, flyerThreshold] });

    for (const target of mainRef.current.querySelectorAll('[data-scroll-reveal]')) {
      const rect = target.getBoundingClientRect();
      if (target.dataset.scrollReveal === 'hero' || rect.bottom <= 0 || rect.top >= window.innerHeight) {
        ready.add(target);
      }
      observer.observe(target);
    }

    return () => {
      pendingHero = null;
      observer.disconnect();
    };
  }, []);

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
          <a className="header-shop" href="#shops">Где забрать</a>
        </div>
      </header>
      <main id="main" ref={mainRef} onFocus={(event) => {
        event.target.getAnimations?.().find(({ id }) => id === 'scroll-reveal')?.cancel();
      }}>
        <section className="hero" aria-labelledby="hero-title">
          <div className="wrap hero-layout">
            <div className="hero-content">
              <p className="pilot-label">Учебный эксперимент</p>
              <h1 id="hero-title">Кофе с собой.<br />Бальзам в подарок.</h1>
              <p className="hero-copy">Покажите флаер из кофейни и заберите черешневый бальзам Eva Mosaic в РИВ ГОШ.</p>
              <p className="hero-note">Без покупки в магазине, регистрации и карты лояльности.</p>
              <div className="hero-actions">
                <a className="button button-dark" href="#shops">Где забрать подарок</a>
                <a className="text-button" href={productPath(gift)}>О бальзаме</a>
              </div>
            </div>
            <div className="hero-art" data-scroll-reveal="hero">
              <div className="hero-orbit" aria-hidden="true" />
              <img className="coffee" src={asset('coffee')} alt="Холодный кофе в розовом стакане Surf Coffee" fetchPriority="high" />
              <img className="balm" src={asset('balm')} alt="Черешневый бальзам Eva Mosaic" fetchPriority="high" data-analytics-product={gift.id} />
            </div>
          </div>
        </section>
        <ProductCatalog />
        <section className="section how" id="how" aria-labelledby="how-title">
          <div className="wrap how-layout">
            <div className="how-intro">
              <h2 id="how-title">Как получить подарок</h2>
              <span className="how-flyer" aria-hidden="true" data-scroll-reveal="flyer">
                <span className="how-flyer-ticket">
                  <span className="how-flyer-print" />
                  <span className="how-flyer-code" />
                </span>
              </span>
            </div>
            <ol className="steps">
              {steps.map(([title, text]) => <li key={title}><h3>{title}</h3><p>{text}</p></li>)}
            </ol>
          </div>
        </section>
        <section className="wrap section shops" id="shops" aria-labelledby="shops-title">
          <div className="section-heading">
            <div>
              <h2 id="shops-title">Где забрать подарок</h2>
              <p>Проверьте наличие подарка перед визитом.</p>
            </div>
            <a className="button button-outline" href="https://rivegauche.ru/shops" target="_blank" rel="noopener noreferrer">Все магазины РИВ ГОШ</a>
          </div>
          <StoreLocator />
        </section>
        <OfferSurvey />
      </main>
      <footer className="footer">
        <div className="wrap footer-inner">
          <div><Brand /><p>Учебный проект</p></div>
          <div className="footer-links">
            <a href="https://rivegauche.ru/" target="_blank" rel="noopener noreferrer">Сайт РИВ ГОШ</a>
            <div className="app-links" aria-label="Магазины приложений">
              {appStores.map(([name, url, badge]) => (
                <a className="app-badge" key={name} href={url} target="_blank" rel="noopener noreferrer">
                  <img src={`${import.meta.env.BASE_URL}store-badges/${badge}`} alt={`Приложение РИВ ГОШ в ${name}`} />
                </a>
              ))}
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

function TrackedPage() {
  useEffect(() => startAnalytics(product?.id), []);
  return product ? <ProductPage product={product} /> : <App />;
}

createRoot(document.getElementById('root')).render(<TrackedPage />);
