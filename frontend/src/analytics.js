const visitKey = 'rg-analytics-visit';
const idleLimit = 30 * 60 * 1000;
const qrFormat = /^[A-Za-z0-9_-]{1,100}$/;
const appHosts = {
  'apps.apple.com': 'app_store',
  'play.google.com': 'google_play',
  'www.rustore.ru': 'rustore',
};
let currentVisit;

function newId() {
  return crypto.randomUUID?.() ?? Array.from(crypto.getRandomValues(new Uint8Array(16)),
    byte => byte.toString(16).padStart(2, '0')).join('');
}

function loadVisit(qr) {
  try {
    const previous = JSON.parse(sessionStorage.getItem(visitKey));
    if (previous?.id && Date.now() - previous.lastSeen < idleLimit && (!qr || qr === previous.qr)) {
      return previous;
    }
  } catch {
    // Analytics still works in this document when browser storage is unavailable.
  }
  return { id: newId(), qr };
}

function getVisit() {
  if (currentVisit) return currentVisit;
  const code = new URLSearchParams(location.search).get('qr');
  currentVisit = loadVisit(code && qrFormat.test(code) ? code : null);
  return currentVisit;
}

function saveVisit(visit) {
  visit.lastSeen = Date.now();
  try {
    sessionStorage.setItem(visitKey, JSON.stringify(visit));
  } catch {
    // A blocked session storage must not affect the page or event delivery.
  }
}

function eventRequest(kind, details = {}, id = newId()) {
  const visit = getVisit();
  saveVisit(visit);
  return fetch('/api/analytics/events', {
    method: 'POST',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, visit_id: visit.id, kind, ...details }),
  });
}

export function trackEvent(kind, details, id) {
  void eventRequest(kind, details, id).catch(() => {});
}

export function hasCompletedSurvey() {
  return getVisit().offerSurveyCompleted === true;
}

export async function submitOfferSurvey(answers) {
  const visit = getVisit();
  const response = await fetch('/api/survey/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visit_id: visit.id, ...answers }),
  });
  if (!response.ok) throw new Error('Не удалось сохранить ответы');
  visit.offerSurveyCompleted = true;
  saveVisit(visit);
}

export function startAnalytics(productId) {
  const visit = getVisit();

  function outbound(event) {
    if (event.defaultPrevented || (event.type === 'auxclick' && event.button !== 1)) return;
    const anchor = event.target.closest?.('a[href]');
    if (!anchor) return;
    const url = new URL(anchor.href, location.href);
    if (url.hostname === 'rivegauche.ru' || url.hostname === 'www.rivegauche.ru') {
      trackEvent('site_click');
    } else if (Object.hasOwn(appHosts, url.hostname)) {
      trackEvent('app_click', { target: appHosts[url.hostname] });
    }
  }

  let visibleSince = null;
  let opened = false;
  const cards = document.querySelectorAll('[data-analytics-product]');
  const viewed = new Set();
  const pending = new Map();
  const observer = 'IntersectionObserver' in window && new IntersectionObserver(entries => {
    for (const { target, intersectionRatio } of entries) {
      if (intersectionRatio < 0.5) {
        clearTimeout(pending.get(target));
        pending.delete(target);
      } else if (visibleSince !== null && !viewed.has(target) && !pending.has(target)) {
        pending.set(target, setTimeout(() => {
          pending.delete(target);
          viewed.add(target);
          trackEvent('product_impression', { target: target.dataset.analyticsProduct });
        }, 750));
      }
    }
  }, { threshold: 0.5 });

  function flush() {
    if (visibleSince === null) return;
    const now = performance.now();
    const duration = Math.min(30000, Math.round(now - visibleSince));
    visibleSince = now;
    if (duration > 0) trackEvent('active_time', { duration_ms: duration });
  }

  function pause() {
    flush();
    visibleSince = null;
    observer && observer.disconnect();
    for (const timer of pending.values()) clearTimeout(timer);
    pending.clear();
  }

  function resume() {
    if (document.hidden || visibleSince !== null) return;
    visibleSince = performance.now();
    trackEvent('visit', { qr: visit.qr }, visit.id);
    if (productId && !opened) {
      trackEvent('product_open', { target: productId });
      opened = true;
    }
    if (observer) for (const card of cards) if (!viewed.has(card)) observer.observe(card);
  }

  function visibilityChanged() {
    if (document.hidden) pause();
    else resume();
  }

  const interval = setInterval(flush, 15000);
  document.addEventListener('visibilitychange', visibilityChanged);
  document.addEventListener('click', outbound);
  document.addEventListener('auxclick', outbound);
  window.addEventListener('pagehide', pause);
  window.addEventListener('pageshow', resume);
  resume();

  return () => {
    pause();
    clearInterval(interval);
    document.removeEventListener('visibilitychange', visibilityChanged);
    document.removeEventListener('click', outbound);
    document.removeEventListener('auxclick', outbound);
    window.removeEventListener('pagehide', pause);
    window.removeEventListener('pageshow', resume);
  };
}
