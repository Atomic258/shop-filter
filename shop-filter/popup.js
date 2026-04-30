// Popup logic — handles both Amazon and AliExpress tabs.

const SITES = {
  amazon: {
    storageKey: 'siteSettings_amazon',
    statusEl: document.getElementById('az-status'),
    ratingLabelEl: document.getElementById('az-ratingLabel'),
    fields: {
      enabled: 'az-enabled',
      mode: 'az-mode',
      minRating: 'az-minRating',
      hideUnrated: 'az-hideUnrated',
      minPrice: 'az-minPrice',
      maxPrice: 'az-maxPrice',
      autoPrime: 'az-autoPrime',
      defaultSort: 'az-defaultSort',
      infiniteScroll: 'az-infiniteScroll',
      hideAds: 'az-hideAds',
      mustHave: 'az-mustHave',
      keywords: 'az-keywords'
    },
    defaults: {
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
      hideAds: false
    }
  },
  aliexpress: {
    storageKey: 'siteSettings_aliexpress',
    statusEl: document.getElementById('ae-status'),
    ratingLabelEl: document.getElementById('ae-ratingLabel'),
    fields: {
      enabled: 'ae-enabled',
      mode: 'ae-mode',
      minRating: 'ae-minRating',
      hideUnrated: 'ae-hideUnrated',
      minSold: 'ae-minSold',
      minPrice: 'ae-minPrice',
      maxPrice: 'ae-maxPrice',
      freeShipping: 'ae-freeShipping',
      infiniteScroll: 'ae-infiniteScroll',
      defaultSort: 'ae-defaultSort',
      hideAds: 'ae-hideAds',
      mustHave: 'ae-mustHave',
      keywords: 'ae-keywords',
      debugMode: 'ae-debugMode'
    },
    defaults: {
      keywords: [],
      mustHave: [],
      mode: 'hide',
      enabled: true,
      minRating: 0,
      hideUnrated: false,
      minSold: 0,
      freeShipping: false,
      infiniteScroll: false,
      defaultSort: 'none',
      minPrice: 0,
      maxPrice: 0,
      hideAds: false,
      debugMode: false
    }
  }
};

// --- Tab switching (with persistence) ---

const TAB_KEY = 'activeTab';

function activateTab(target) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === target));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `panel-${target}`));
  chrome.storage.local.set({ [TAB_KEY]: target });
}

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => activateTab(tab.dataset.tab));
});

// Restore last used tab on open
chrome.storage.local.get([TAB_KEY], (data) => {
  if (data[TAB_KEY] && (data[TAB_KEY] === 'amazon' || data[TAB_KEY] === 'aliexpress')) {
    activateTab(data[TAB_KEY]);
  }
});

// --- Helpers ---

function getEl(id) { return document.getElementById(id); }
function getVal(id) {
  const el = getEl(id);
  if (!el) return null;
  if (el.type === 'checkbox') return el.checked;
  return el.value;
}
function setVal(id, value) {
  const el = getEl(id);
  if (!el) return;
  if (el.type === 'checkbox') el.checked = !!value;
  else el.value = value === undefined || value === null ? '' : value;
}

function updateRatingDisplay(siteKey) {
  const cfg = SITES[siteKey];
  const v = parseFloat(getEl(cfg.fields.minRating).value) || 0;
  const lbl = cfg.ratingLabelEl;
  if (v <= 0) {
    lbl.textContent = '(disabled)';
    lbl.style.color = '#888';
  } else {
    const filled = Math.floor(v);
    const fracIsHalf = (v - filled) >= 0.25 && (v - filled) < 0.75;
    const fullExtra = (v - filled) >= 0.75 ? 1 : 0;
    const stars = '★'.repeat(filled + fullExtra) + (fracIsHalf ? '½' : '') + '☆'.repeat(Math.max(0, 5 - filled - fullExtra - (fracIsHalf ? 1 : 0)));
    lbl.textContent = `${stars} (${v.toFixed(1)}+)`;
    lbl.style.color = '#f0c14b';
  }
}

function showSaved(siteKey) {
  SITES[siteKey].statusEl.classList.add('show');
  setTimeout(() => SITES[siteKey].statusEl.classList.remove('show'), 1400);
}

function loadSite(siteKey) {
  const cfg = SITES[siteKey];
  chrome.storage.local.get([cfg.storageKey], (data) => {
    const stored = data[cfg.storageKey] || {};
    const merged = { ...cfg.defaults, ...stored };

    // Populate form fields
    for (const [key, id] of Object.entries(cfg.fields)) {
      const v = merged[key];
      if (key === 'keywords' || key === 'mustHave') {
        setVal(id, Array.isArray(v) ? v.join('\n') : '');
      } else if (key === 'minRating') {
        setVal(id, (typeof v === 'number' ? v : 0).toFixed(1));
      } else if (key === 'minPrice' || key === 'maxPrice' || key === 'minSold') {
        setVal(id, (typeof v === 'number' && v > 0) ? v : '');
      } else {
        setVal(id, v);
      }
    }
    if (cfg.fields.minRating) updateRatingDisplay(siteKey);
  });
}

function saveSite(siteKey) {
  const cfg = SITES[siteKey];
  const out = { ...cfg.defaults };

  for (const [key, id] of Object.entries(cfg.fields)) {
    const raw = getVal(id);
    if (key === 'keywords' || key === 'mustHave') {
      out[key] = (raw || '').split('\n').map(s => s.trim()).filter(Boolean);
    } else if (key === 'minRating') {
      let n = parseFloat(raw); if (isNaN(n) || n < 0) n = 0; if (n > 5) n = 5;
      out[key] = n;
    } else if (key === 'minPrice' || key === 'maxPrice' || key === 'minSold') {
      let n = parseFloat(raw); if (isNaN(n) || n < 0) n = 0;
      out[key] = n;
    } else if (typeof cfg.defaults[key] === 'boolean') {
      out[key] = !!raw;
    } else {
      out[key] = raw;
    }
  }

  chrome.storage.local.set({ [cfg.storageKey]: out }, () => showSaved(siteKey));
}

// --- Wire up listeners ---

function wireSite(siteKey) {
  const cfg = SITES[siteKey];

  // Save button
  document.querySelector(`.save-btn[data-site="${siteKey}"]`).addEventListener('click', () => saveSite(siteKey));

  // Auto-save on change for all controls in this site
  for (const id of Object.values(cfg.fields)) {
    const el = getEl(id);
    if (!el) continue;
    if (el.tagName === 'TEXTAREA') {
      // Save on blur to avoid spam
      el.addEventListener('blur', () => saveSite(siteKey));
    } else {
      el.addEventListener('change', () => saveSite(siteKey));
    }
  }

  // Live rating preview
  if (cfg.fields.minRating) {
    getEl(cfg.fields.minRating).addEventListener('input', () => updateRatingDisplay(siteKey));
  }
}

// Init
loadSite('amazon');
loadSite('aliexpress');
wireSite('amazon');
wireSite('aliexpress');

// Ctrl/Cmd+S saves the active tab
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    const activeTab = document.querySelector('.tab.active').dataset.tab;
    saveSite(activeTab);
  }
});
