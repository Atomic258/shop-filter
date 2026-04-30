// AliExpress site adapter
// Exposes window.SITE_ADAPTER for content.js to use.

(function () {
  const SORT_VALUES = {
    'none': undefined,
    'default': null,                       // remove sortType
    'orders': 'total_tranpro_desc',
    'price-asc': 'price_asc',
    'price-desc': 'price_desc',
    'newest': 'create_desc'
  };

  function isSearchPage() {
    // AliExpress search URLs: /w/wholesale-*.html or path containing /wholesale or query with SearchText
    const path = window.location.pathname;
    if (/\/w\/wholesale/i.test(path)) return true;
    if (/\/wholesale/i.test(path)) return true;
    if (window.location.search.includes('SearchText=')) return true;
    return false;
  }

  function getCandidates() {
    const candidates = new Set();
    // Primary AliExpress card selector (confirmed via DOM inspection)
    document.querySelectorAll('.search-item-card-wrapper-gallery').forEach(el => candidates.add(el));
    return candidates;
  }

  function getRating(el) {
    // Strategy 1 (most reliable): AliExpress wraps the numeric rating in a span
    // sibling to a row of star <img> elements. The rating span sits right after
    // the stars. We find these by looking for a span whose text is a 0-5 number
    // AND whose immediate parent contains <img> elements (the stars).
    const candidates = el.querySelectorAll('span');
    for (const span of candidates) {
      const t = (span.textContent || '').trim();
      // Must look like a rating: "4", "4.5", "5", "4,7" — single digit + optional decimal
      if (!/^[0-5](?:[.,]\d{1,2})?$/.test(t)) continue;
      // Must be in a context with star images (the visual rating)
      const parent = span.parentElement;
      if (!parent) continue;
      const hasStarImages = parent.querySelectorAll('img').length >= 3;
      if (hasStarImages) {
        const v = parseFloat(t.replace(',', '.'));
        if (v >= 0 && v <= 5) return v;
      }
    }

    // Strategy 2: aria-label fallback
    const ariaEl = el.querySelector('[aria-label*="star" i], [aria-label*="rating" i]');
    if (ariaEl) {
      const m = ariaEl.getAttribute('aria-label').match(/(\d+(?:[.,]\d+)?)/);
      if (m) {
        const v = parseFloat(m[1].replace(',', '.'));
        if (v >= 0 && v <= 5) return v;
      }
    }

    return null;
  }

  function getSoldCount(el) {
    // Strategy 1: look for a class containing "sold" or scan small text spans.
    // AliExpress wraps "N sold" in its own span (e.g. lw_kk).
    // Find a span whose text is exactly "N sold" pattern.
    const allSpans = el.querySelectorAll('span');
    for (const s of allSpans) {
      const t = (s.textContent || '').trim();
      // Strict match: "6 sold", "1.2K sold", "1,234+ sold" — span contains ONLY this
      const m = t.match(/^([\d.,]+)\s*([KkMm])?\+?\s*sold$/i);
      if (m) {
        let n = parseFloat(m[1].replace(/,/g, ''));
        if (isNaN(n)) continue;
        if (m[2]) {
          const suffix = m[2].toLowerCase();
          if (suffix === 'k') n *= 1000;
          else if (suffix === 'm') n *= 1000000;
        }
        return Math.floor(n);
      }
    }

    // Strategy 2: full-text fallback with word boundary at start to avoid
    // accidentally matching the rating digit (e.g. "4 | 7 sold" should match 7, not 4)
    const text = el.textContent || '';
    const m = text.match(/\b([\d.,]+)\s*([KkMm])?\+?\s*sold\b/);
    if (!m) return null;
    let n = parseFloat(m[1].replace(/,/g, ''));
    if (isNaN(n)) return null;
    if (m[2]) {
      const suffix = m[2].toLowerCase();
      if (suffix === 'k') n *= 1000;
      else if (suffix === 'm') n *= 1000000;
    }
    return Math.floor(n);
  }

  function isAd(el) {
    // AliExpress ads: small "Ad" badge in the upper-right corner of the tile.
    // Strategies in order of reliability:

    // 1. aria-label / title containing "Ad" or "Sponsored"
    const labeled = el.querySelector('[aria-label="Ad" i], [aria-label="Sponsored" i], [title="Ad" i], [title="Sponsored" i]');
    if (labeled) return true;

    // 2. Look for a span/div whose text is exactly "Ad" or "Sponsored"
    // (must be exact match — "Add to cart" should not trigger this)
    const spans = el.querySelectorAll('span, div, em, i');
    for (const s of spans) {
      // Use direct text only, not descendant text, to avoid false positives
      const directText = Array.from(s.childNodes)
        .filter(n => n.nodeType === Node.TEXT_NODE)
        .map(n => n.textContent.trim())
        .join('').trim();
      if (directText === 'Ad' || directText === 'Sponsored') return true;
    }

    return false;
  }

  function isAd(el) {
    // AliExpress marks ads with a small "Ad" badge in the corner of the image.
    // Detection strategies:
    // 1. Sponsored/ad text in attributes
    if (el.querySelector('[aria-label*="ad" i][aria-label$="Ad"], [aria-label="Ad"], [data-spm*="ad-"]')) return true;
    // 2. Look for a tiny element whose ONLY text is "Ad" (case-insensitive, exact match)
    //    AE renders this as a small overlay badge
    const smallEls = el.querySelectorAll('span, div');
    for (const s of smallEls) {
      const t = (s.textContent || '').trim();
      if (t === 'Ad' || t === 'AD') {
        // Verify it's badge-sized (small, not a paragraph mentioning "Ad")
        if (s.children.length === 0 && t.length <= 3) return true;
      }
    }
    return false;
  }

  // AliExpress URL: free shipping is usually shipFromCountry or shipping_options=freeshipping
  // The most reliable seems to be appending shipFromCountry filter or using ?shipping_options=freeshipping
  // Some regions use ?freeShipping=y
  function urlHasFreeShipping(url) {
    try {
      const u = new URL(url);
      return u.searchParams.has('freeShipping') ||
             u.searchParams.get('shipping_options') === 'freeshipping';
    } catch (e) { return false; }
  }

  function buildAdjustedUrl(settings) {
    if (!isSearchPage()) return null;

    const targetUrl = new URL(window.location.href);

    // Sort
    const sortVal = SORT_VALUES[settings.defaultSort];
    if (sortVal !== undefined) {
      const current = targetUrl.searchParams.get('sortType');
      if (!current && sortVal !== null) {
        targetUrl.searchParams.set('sortType', sortVal);
      }
    }

    // Price
    const minP = parseFloat(settings.minPrice) || 0;
    const maxP = parseFloat(settings.maxPrice) || 0;
    const hasManualPrice = targetUrl.searchParams.has('minPrice') || targetUrl.searchParams.has('maxPrice');
    if (!hasManualPrice) {
      if (minP > 0) targetUrl.searchParams.set('minPrice', String(minP));
      if (maxP > 0) targetUrl.searchParams.set('maxPrice', String(maxP));
    }

    // Free shipping
    if (settings.freeShipping && !urlHasFreeShipping(targetUrl.href)) {
      targetUrl.searchParams.set('shipping_options', 'freeshipping');
    }

    return targetUrl.href;
  }

  // Infinite scroll page tracker. Reset when a fresh search loads.
  let _pagesLoaded = 0;
  // Reset counter when location changes (fresh search)
  let _trackedUrl = window.location.href;

  function findNextLink(_scope) {
    // Reset counter if URL changed (new search)
    if (window.location.href !== _trackedUrl) {
      _trackedUrl = window.location.href;
      _pagesLoaded = 0;
    }
    try {
      const u = new URL(window.location.href);
      const currentPage = parseInt(u.searchParams.get('page') || '1', 10);
      _pagesLoaded += 1;
      u.searchParams.set('page', String(currentPage + _pagesLoaded));
      return u.href;
    } catch (e) { return null; }
  }

  function getResultsContainer() {
    // The grid container — children are the .search-item-card-wrapper-gallery tiles
    const firstTile = document.querySelector('.search-item-card-wrapper-gallery');
    if (firstTile && firstTile.parentElement) return firstTile.parentElement;
    return document.querySelector('main') || document.body;
  }

  function getPaginationElements() {
    return document.querySelectorAll('[class*="pagination"], [class*="comet-pagination"]');
  }

  function extractTilesFromDoc(doc) {
    return doc.querySelectorAll('.search-item-card-wrapper-gallery');
  }

  window.SITE_ADAPTER = {
    name: 'aliexpress',
    isSearchPage,
    getCandidates,
    getRating,
    getSoldCount,
    isAd,
    buildAdjustedUrl,
    findNextLink,
    getResultsContainer,
    getPaginationElements,
    extractTilesFromDoc,
    supports: {
      autoPrime: false,
      freeShipping: true,
      minSold: true,
      defaultSort: true,
      price: true,
      infiniteScroll: true,
      hideAds: true
    }
  };
})();
