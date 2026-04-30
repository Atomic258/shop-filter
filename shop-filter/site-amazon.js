// Amazon site adapter
// Exposes window.SITE_ADAPTER for content.js to use.

(function () {
  const SORT_VALUES = {
    'none': undefined,
    'featured': null,
    'price-asc': 'price-asc-rank',
    'price-desc': 'price-desc-rank',
    'review': 'review-rank',
    'newest': 'date-desc-rank',
    'bestseller': 'exact-aware-popularity-rank'
  };

  function isSearchPage() {
    return /\/s(\?|\/|$)/.test(window.location.pathname + window.location.search);
  }

  function getCandidates() {
    const candidates = new Set();
    document.querySelectorAll('div[data-component-type="s-search-result"]').forEach(el => candidates.add(el));
    document.querySelectorAll('[data-asin]').forEach(el => {
      const asin = el.getAttribute('data-asin');
      if (asin && asin.length > 0) candidates.add(el);
    });
    return candidates;
  }

  function getRating(el) {
    const ariaEl = el.querySelector('[aria-label*="out of 5 stars"]');
    if (ariaEl) {
      const m = ariaEl.getAttribute('aria-label').match(/(\d+(?:[.,]\d+)?)\s*out of 5/i);
      if (m) return parseFloat(m[1].replace(',', '.'));
    }
    const text = el.textContent || '';
    const m = text.match(/(\d+(?:[.,]\d+)?)\s*out of 5\s*stars/i);
    if (m) return parseFloat(m[1].replace(',', '.'));
    return null;
  }

  // Amazon-specific extras: sold count not commonly shown — return null (filter ignored on Amazon)
  function getSoldCount(_el) { return null; }

  function isAd(el) {
    // Strict markers only — false positives break add-to-cart on legitimate listings.

    // 1. Sponsored info button (the (i) icon shown only on sponsored tiles)
    if (el.querySelector('[aria-label="View Sponsored information or leave ad feedback"]')) return true;

    // 2. Dedicated sponsored shelf component
    if (el.matches('[data-component-type="sp-sponsored-result"]')) return true;
    if (el.querySelector('[data-component-type="sp-sponsored-result"]')) return true;

    // 3. Specific "Sponsored" label class — must be the dedicated sponsored label,
    //    not the broader puis-label-popover (which is reused for non-sponsored tooltips).
    if (el.querySelector('.puis-sponsored-label-text, .puis-sponsored-label-info-icon')) return true;

    // Note: Earlier versions scanned for the literal text "Sponsored" or used overly
    // broad puis-* class matches. Both caused false positives that disabled
    // Add-to-cart on legitimate products.

    return false;
  }

  function urlHasPrimeFilter(url) {
    try {
      const u = new URL(url);
      const rh = u.searchParams.get('rh') || '';
      return /p_85|p_n_prime/i.test(rh);
    } catch (e) { return false; }
  }

  function findPrimeLinkUrl() {
    const links = document.querySelectorAll('a[href*="p_85"], a[href*="p_n_prime"]');
    for (const link of links) {
      const text = (link.textContent || '').trim();
      if (/\bprime\b/i.test(text) && urlHasPrimeFilter(link.href)) return link.href;
    }
    return null;
  }

  function buildAdjustedUrl(settings) {
    if (!isSearchPage()) return null;

    let baseUrl = window.location.href;

    // Prime
    if (settings.autoPrime && !urlHasPrimeFilter(baseUrl)) {
      const primeUrl = findPrimeLinkUrl();
      if (!primeUrl) return 'wait'; // sidebar not loaded yet — try again on next mutation
      baseUrl = primeUrl;
    }

    const targetUrl = new URL(baseUrl);

    // Sort
    const sortVal = SORT_VALUES[settings.defaultSort];
    if (sortVal !== undefined) {
      const currentSort = targetUrl.searchParams.get('s');
      if (currentSort === null && sortVal !== null) {
        targetUrl.searchParams.set('s', sortVal);
      }
    }

    // Price (Amazon canonicalizes to rh=p_36 — check both forms)
    const minP = parseFloat(settings.minPrice) || 0;
    const maxP = parseFloat(settings.maxPrice) || 0;
    const rhVal = targetUrl.searchParams.get('rh') || '';
    const hasManualPrice =
      targetUrl.searchParams.has('low-price') ||
      targetUrl.searchParams.has('high-price') ||
      /p_36/i.test(rhVal);
    if (!hasManualPrice) {
      if (minP > 0) targetUrl.searchParams.set('low-price', String(minP));
      if (maxP > 0) targetUrl.searchParams.set('high-price', String(maxP));
    }

    return targetUrl.href;
  }

  // Infinite scroll specifics
  function findNextLink(scope) {
    const link = (scope || document).querySelector('a.s-pagination-next');
    if (!link) return null;
    if (link.classList.contains('s-pagination-disabled')) return null;
    if (link.getAttribute('aria-disabled') === 'true') return null;
    return link.href;
  }

  function getResultsContainer() {
    return document.querySelector('.s-main-slot.s-result-list') ||
           document.querySelector('.s-main-slot') ||
           document.querySelector('[data-component-type="s-search-results"]');
  }

  function getPaginationElements() {
    return document.querySelectorAll('.s-pagination-container, [data-component-type="s-pagination"]');
  }

  function extractTilesFromDoc(doc) {
    return doc.querySelectorAll('div[data-component-type="s-search-result"]');
  }

  window.SITE_ADAPTER = {
    name: 'amazon',
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
      autoPrime: true,
      freeShipping: false,
      minSold: false,
      defaultSort: true,
      price: true,
      infiniteScroll: true,
      hideAds: true
    }
  };
})();
