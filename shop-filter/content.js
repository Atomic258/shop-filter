// Shop Filter - shared content script
// Uses window.SITE_ADAPTER (set by site-amazon.js or site-aliexpress.js).

(function () {
  const adapter = window.SITE_ADAPTER;
  if (!adapter) {
    console.warn('[Shop Filter] No site adapter loaded.');
    return;
  }

  const SITE_KEY = adapter.name; // 'amazon' or 'aliexpress'
  const STORAGE_KEY = `siteSettings_${SITE_KEY}`;

  const DEFAULTS_AMAZON = {
    keywords: ['20v', 'battery', 'electric', 'hedge', 'cordless', 'saw', 'saws'],
    mustHave: [],
    mode: 'hide',
    enabled: true,
    minRating: 0,
    hideUnrated: false,
    autoPrime: false,
    infiniteScroll: true,
    defaultSort: 'none',
    minPrice: 0,
    maxPrice: 0,
    minSold: 0,
    freeShipping: false,
    hideAds: false
  };

  const DEFAULTS_ALIEXPRESS = {
    keywords: [],
    mustHave: [],
    mode: 'hide',
    enabled: true,
    minRating: 0,
    hideUnrated: false,
    autoPrime: false,
    infiniteScroll: false,
    defaultSort: 'none',
    minPrice: 0,
    maxPrice: 0,
    minSold: 0,
    freeShipping: false,
    debugMode: false,
    hideAds: false
  };

  const DEFAULTS = SITE_KEY === 'aliexpress' ? DEFAULTS_ALIEXPRESS : DEFAULTS_AMAZON;
  let settings = { ...DEFAULTS };
  let regexes = [];
  let mustHaveRegexes = [];

  // --- Regex helpers ---

  function buildRegex(keyword) {
    const trimmed = (keyword || '').trim();
    if (!trimmed) return null;
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try { return new RegExp(`\\b${escaped}\\b`, 'i'); } catch (e) { return null; }
  }

  function rebuildRegexes() {
    regexes = (settings.keywords || []).map(buildRegex).filter(r => r);
    mustHaveRegexes = (settings.mustHave || []).map(buildRegex).filter(r => r);
  }

  function matchesAnyKeyword(text) {
    return regexes.some(r => r.test(text));
  }

  // --- Filter decision ---

  function shouldHideElement(el) {
    // Ad check first — cheapest test, and ads often skip price/sort filters
    if (settings.hideAds && adapter.supports.hideAds && adapter.isAd(el)) return true;

    let text = null;

    if (mustHaveRegexes.length > 0) {
      text = el.textContent || '';
      for (const re of mustHaveRegexes) {
        if (!re.test(text)) return true;
      }
    }

    if (regexes.length > 0) {
      if (text === null) text = el.textContent || '';
      if (matchesAnyKeyword(text)) return true;
    }

    if (settings.minRating > 0) {
      const rating = adapter.getRating(el);
      if (rating === null) {
        if (settings.hideUnrated) return true;
      } else if (rating < settings.minRating) {
        return true;
      }
    }

    if (adapter.supports.minSold && settings.minSold > 0) {
      const sold = adapter.getSoldCount(el);
      if (sold === null || sold < settings.minSold) return true;
    }

    return false;
  }

  // Debug overlay — shows detected rating/sold values on each tile
  function applyDebugOverlay(el) {
    let badge = el.querySelector(':scope > .akf-debug-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'akf-debug-badge';
      const pos = window.getComputedStyle(el).position;
      if (pos === 'static') el.style.position = 'relative';
      el.appendChild(badge);
    }
    // Always re-style so values re-render correctly even after AE's React replaces parts of the tile
    badge.style.cssText = `
      position: absolute !important; top: 4px; left: 4px;
      background: rgba(255,200,0,0.95); color: #000;
      font: 11px monospace; padding: 2px 5px; border-radius: 3px;
      z-index: 9999; pointer-events: none;
    `;
    const rating = adapter.getRating(el);
    const sold = adapter.supports.minSold ? adapter.getSoldCount(el) : null;
    const parts = [];
    parts.push(`★${rating === null ? '?' : rating}`);
    if (adapter.supports.minSold) parts.push(`#${sold === null ? '?' : sold}`);
    badge.textContent = parts.join(' ');
  }

  function clearDebugOverlays() {
    document.querySelectorAll('.akf-debug-badge').forEach(el => el.remove());
  }

  function setHidden(el, hide) {
    if (hide) {
      if (settings.mode === 'hide') {
        // Use visibility + width/height collapse instead of display:none.
        // display:none breaks AliExpress's grid layout and causes weird gaps/overflow.
        el.style.setProperty('visibility', 'hidden', 'important');
        el.style.setProperty('height', '0', 'important');
        el.style.setProperty('min-height', '0', 'important');
        el.style.setProperty('max-height', '0', 'important');
        el.style.setProperty('overflow', 'hidden', 'important');
        el.style.setProperty('margin', '0', 'important');
        el.style.setProperty('padding', '0', 'important');
        el.style.setProperty('border', '0', 'important');
        el.dataset.akfState = 'hidden';
      } else {
        el.style.setProperty('opacity', '0.2', 'important');
        el.style.setProperty('pointer-events', 'none', 'important');
        el.dataset.akfState = 'greyed';
      }
    } else {
      el.style.removeProperty('visibility');
      el.style.removeProperty('height');
      el.style.removeProperty('min-height');
      el.style.removeProperty('max-height');
      el.style.removeProperty('overflow');
      el.style.removeProperty('margin');
      el.style.removeProperty('padding');
      el.style.removeProperty('border');
      el.style.removeProperty('opacity');
      el.style.removeProperty('pointer-events');
      delete el.dataset.akfState;
    }
  }

  function filterPage() {
    const noFilters =
      !settings.enabled ||
      (regexes.length === 0 && mustHaveRegexes.length === 0 && settings.minRating <= 0 && (!adapter.supports.minSold || settings.minSold <= 0) && !settings.hideAds);

    if (noFilters && !settings.debugMode) {
      document.querySelectorAll('[data-akf-state]').forEach(el => setHidden(el, false));
      clearDebugOverlays();
      return;
    }

    const candidates = adapter.getCandidates();

    if (settings.debugMode) {
      candidates.forEach(el => applyDebugOverlay(el));
    } else {
      clearDebugOverlays();
    }

    if (!noFilters) {
      candidates.forEach(el => setHidden(el, shouldHideElement(el)));
    }
  }

  // --- URL adjustments (sort, price, prime/free-shipping) ---

  let urlAdjustAttempted = false;
  const REDIRECT_KEY = `akf_last_redirect_${SITE_KEY}`;

  function applyUrlAdjustments() {
    if (!settings.enabled || urlAdjustAttempted) return;
    if (!adapter.isSearchPage()) return;

    const target = adapter.buildAdjustedUrl(settings);
    if (target === null) return;
    if (target === 'wait') return; // adapter wants to retry on next mutation

    urlAdjustAttempted = true;
    if (target === window.location.href) return;

    try {
      if (sessionStorage.getItem(REDIRECT_KEY) === target) return;
      sessionStorage.setItem(REDIRECT_KEY, target);
    } catch (e) { /* ignore */ }

    window.location.href = target;
  }

  // --- Reactive scheduling ---

  let filterTimer = null;
  function scheduleFilter() {
    if (filterTimer) clearTimeout(filterTimer);
    filterTimer = setTimeout(() => {
      filterPage();
      applyUrlAdjustments();
    }, 150);
  }

  const observer = new MutationObserver(() => {
    scheduleFilter();
    if (adapter.supports.infiniteScroll && !infScroll.initialized) tryInitInfiniteScroll();
  });

  function startObserving() {
    if (!document.body) return;
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // --- Infinite scroll (only used when adapter.supports.infiniteScroll) ---

  const infScroll = {
    loading: false, done: false, nextUrl: null, pageNumber: 1, initialized: false
  };

  function setPaginationVisible(visible) {
    adapter.getPaginationElements().forEach(el => {
      if (visible) el.style.removeProperty('display');
      else el.style.setProperty('display', 'none', 'important');
    });
  }

  function makeMarker(text, color) {
    const div = document.createElement('div');
    div.className = 'akf-infscroll-marker';
    div.style.cssText = `
      grid-column: 1 / -1 !important; width: 100% !important; flex-basis: 100% !important;
      text-align: center !important; padding: 14px 16px !important; margin: 12px 0 !important;
      font-size: 13px !important; font-weight: 600 !important; color: ${color || '#666'} !important;
      background: rgba(0,0,0,0.03) !important; border-radius: 6px !important; box-sizing: border-box !important;
    `;
    div.textContent = text;
    return div;
  }

  async function loadMore() {
    if (!settings.enabled || !settings.infiniteScroll) return;
    if (!adapter.supports.infiniteScroll) return;
    if (infScroll.loading || infScroll.done) return;

    const url = infScroll.nextUrl || adapter.findNextLink(document);
    if (!url) { infScroll.done = true; return; }

    const container = adapter.getResultsContainer();
    if (!container) return;

    infScroll.loading = true;
    const loadingMarker = makeMarker(`Loading page ${infScroll.pageNumber + 1}…`, '#888');
    container.appendChild(loadingMarker);

    try {
      const response = await fetch(url, { credentials: 'include', headers: { 'Accept': 'text/html' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const newTiles = adapter.extractTilesFromDoc(doc);

      loadingMarker.remove();

      if (newTiles.length === 0) {
        infScroll.done = true;
        container.appendChild(makeMarker('— End of results —', '#888'));
        return;
      }

      infScroll.pageNumber++;
      container.appendChild(makeMarker(`— Page ${infScroll.pageNumber} —`, '#4a90e2'));
      newTiles.forEach(tile => container.appendChild(document.adoptNode(tile)));

      infScroll.nextUrl = adapter.findNextLink(doc);
      if (!infScroll.nextUrl) {
        infScroll.done = true;
        container.appendChild(makeMarker('— End of results —', '#888'));
      }

      filterPage();
    } catch (err) {
      console.error('[Shop Filter] Infinite scroll error:', err);
      loadingMarker.textContent = `Failed to load next page (${err.message}). Scroll up and back down to retry.`;
      loadingMarker.style.setProperty('color', '#c00', 'important');
    } finally {
      infScroll.loading = false;
    }
  }

  let scrollThrottle = null;
  function onScroll() {
    if (scrollThrottle) return;
    scrollThrottle = setTimeout(() => {
      scrollThrottle = null;
      if (!settings.infiniteScroll) return;
      const remaining = document.documentElement.scrollHeight - (window.scrollY + window.innerHeight);
      if (remaining < 1500) loadMore();
    }, 200);
  }

  function tryInitInfiniteScroll() {
    if (infScroll.initialized) return;
    if (!adapter.supports.infiniteScroll) return;
    if (!settings.enabled || !settings.infiniteScroll) return;
    if (!adapter.isSearchPage()) return;
    if (!adapter.getResultsContainer()) return;

    infScroll.initialized = true;
    infScroll.nextUrl = adapter.findNextLink(document);
    if (!infScroll.nextUrl) infScroll.done = true;

    setPaginationVisible(false);
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  function teardownInfiniteScroll() {
    window.removeEventListener('scroll', onScroll);
    setPaginationVisible(true);
    document.querySelectorAll('.akf-infscroll-marker').forEach(el => el.remove());
    infScroll.initialized = false;
    infScroll.nextUrl = null;
    infScroll.done = false;
    infScroll.loading = false;
    infScroll.pageNumber = 1;
  }

  // --- Storage init / sync ---

  chrome.storage.local.get([STORAGE_KEY], (data) => {
    if (data[STORAGE_KEY] && typeof data[STORAGE_KEY] === 'object') {
      settings = { ...DEFAULTS, ...data[STORAGE_KEY] };
    }
    rebuildRegexes();
    filterPage();
    applyUrlAdjustments();
    tryInitInfiniteScroll();
    startObserving();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (!changes[STORAGE_KEY]) return;
    const newVal = changes[STORAGE_KEY].newValue || {};
    const prevInfScroll = settings.infiniteScroll;
    settings = { ...DEFAULTS, ...newVal };
    rebuildRegexes();
    urlAdjustAttempted = false;
    filterPage();
    applyUrlAdjustments();

    if (adapter.supports.infiniteScroll) {
      if (settings.infiniteScroll && !prevInfScroll) tryInitInfiniteScroll();
      else if (!settings.infiniteScroll && prevInfScroll) teardownInfiniteScroll();
    }
  });
})();
