/* script.js
   Dynamic Quote Generator with:
   - Advanced DOM manipulation
   - localStorage & sessionStorage
   - JSON import/export
   - category filtering (persisted)
   - simulated server sync + basic conflict handling (server wins, with undo)
*/

// ---------- Utility ----------
const qs = (s) => document.querySelector(s);
const qsa = (s) => Array.from(document.querySelectorAll(s));
const LS_KEY = 'dqg_quotes_v1';
const LS_FILTER_KEY = 'dqg_last_filter_v1';
const SESSION_LAST_QUOTE = 'dqg_last_viewed_quote_v1';

// ---------- DOM refs ----------
const quoteTextEl = qs('#quoteText');
const quoteMetaEl = qs('#quoteMeta');
const newQuoteBtn = qs('#newQuote');
const showAddFormBtn = qs('#showAddForm');
const addQuoteArea = qs('#addQuoteArea');
const addQuoteBtn = qs('#addQuoteBtn');
const newQuoteTextInput = qs('#newQuoteText');
const newQuoteCategoryInput = qs('#newQuoteCategory');
const categoryFilter = qs('#categoryFilter');
const exportJsonBtn = qs('#exportJson');
const importFileInput = qs('#importFile');
const notificationEl = qs('#notification');
const changesListEl = qs('#changesList');
const syncNowBtn = qs('#syncNow');
const undoSyncBtn = qs('#undoSync');

// ---------- App state ----------
let quotes = []; // { id, text, category, updatedAt }
let lastLocalStateBeforeSync = null; // for undo
let lastShownQuote = null;

// ---------- Default quotes (used only if nothing in storage) ----------
const defaultQuotes = [
  { id: 'q1', text: "The only limit to our realization of tomorrow is our doubts of today.", category: "inspiration", updatedAt: Date.now() },
  { id: 'q2', text: "Life is what happens when you're busy making other plans.", category: "life", updatedAt: Date.now() },
  { id: 'q3', text: "Do not wait to strike till the iron is hot; but make it hot by striking.", category: "motivation", updatedAt: Date.now() }
];

// ---------- Storage helpers ----------
function saveQuotes() {
  localStorage.setItem(LS_KEY, JSON.stringify(quotes));
  populateCategories();
}

function loadQuotes() {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) {
    quotes = defaultQuotes.slice();
    saveQuotes();
  } else {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) quotes = parsed;
      else quotes = defaultQuotes.slice();
    } catch (e) {
      console.error('Malformed quotes in storage; resetting to defaults.', e);
      quotes = defaultQuotes.slice();
    }
  }
  populateCategories();
}

function saveFilter(filter) {
  localStorage.setItem(LS_FILTER_KEY, filter);
}

function loadFilter() {
  return localStorage.getItem(LS_FILTER_KEY) || 'all';
}

// ---------- DOM population ----------
function populateCategories() {
  const categories = Array.from(new Set(quotes.map(q => q.category?.trim()?.toLowerCase() || 'uncategorized')));
  // clear existing (keep first "All Categories")
  categoryFilter.innerHTML = '';
  const optAll = document.createElement('option');
  optAll.value = 'all';
  optAll.textContent = 'All Categories';
  categoryFilter.appendChild(optAll);

  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat[0].toUpperCase() + cat.slice(1);
    categoryFilter.appendChild(opt);
  });

  // restore user's last selection
  const last = loadFilter();
  if (Array.from(categoryFilter.options).some(o => o.value === last)) {
    categoryFilter.value = last;
  } else {
    categoryFilter.value = 'all';
    saveFilter('all');
  }
}

function getFilteredQuotes() {
  const filter = categoryFilter.value || 'all';
  if (filter === 'all') return quotes;
  return quotes.filter(q => (q.category||'').toLowerCase() === filter.toLowerCase());
}

// ---------- Display functions ----------
function showQuoteObject(q) {
  if (!q) {
    quoteTextEl.textContent = 'No quote to display.';
    quoteMetaEl.textContent = '';
    return;
  }
  quoteTextEl.textContent = `"${q.text}"`;
  const cat = q.category || 'Uncategorized';
  const updated = new Date(q.updatedAt).toLocaleString();
  quoteMetaEl.textContent = `Category: ${cat} • ID: ${q.id} • Updated: ${updated}`;
  // save last viewed quote to session storage
  sessionStorage.setItem(SESSION_LAST_QUOTE, JSON.stringify(q));
  lastShownQuote = q;
}

function showRandomQuote() {
  const pool = getFilteredQuotes();
  if (!pool.length) {
    showQuoteObject(null);
    return;
  }
  const idx = Math.floor(Math.random() * pool.length);
  showQuoteObject(pool[idx]);
}

// ---------- Add Quote / form ----------
function toggleAddForm() {
  addQuoteArea.style.display = addQuoteArea.style.display === 'none' ? 'block' : 'none';
  if (addQuoteArea.style.display === 'block') {
    newQuoteTextInput.focus();
  }
}

function addQuote() {
  const text = newQuoteTextInput.value && newQuoteTextInput.value.trim();
  const categoryRaw = (newQuoteCategoryInput.value || '').trim();
  const category = categoryRaw ? categoryRaw.toLowerCase() : 'uncategorized';
  if (!text) {
    alert('Please enter quote text.');
    return;
  }
  const id = 'q_' + Math.random().toString(36).slice(2,9);
  const obj = { id, text, category, updatedAt: Date.now() };
  quotes.push(obj);
  saveQuotes();
  populateCategories();
  newQuoteTextInput.value = '';
  newQuoteCategoryInput.value = '';
  showQuoteObject(obj);
  notify(`Quote added in category "${category}".`);
}

// ---------- Export / Import ----------
function exportToJson() {
  const json = JSON.stringify(quotes, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'quotes.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importFromJsonFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const imported = JSON.parse(ev.target.result);
      if (!Array.isArray(imported)) throw new Error('JSON must be an array of quote objects');
      // normalize & merge: avoid duplicate ids
      const incoming = imported.map((it,i) => ({
        id: it.id || `imp_${Date.now()}_${i}`,
        text: it.text || '',
        category: (it.category || 'uncategorized').toLowerCase(),
        updatedAt: it.updatedAt || Date.now()
      }));
      // merge logic: if id exists, keep latest updatedAt; otherwise add
      const map = new Map(quotes.map(q => [q.id, q]));
      incoming.forEach(iq => {
        if (!map.has(iq.id)) map.set(iq.id, iq);
        else {
          const local = map.get(iq.id);
          if ((iq.updatedAt || 0) > (local.updatedAt || 0)) map.set(iq.id, iq);
        }
      });
      quotes = Array.from(map.values());
      saveQuotes();
      notify(`Imported ${incoming.length} quotes.`);
    } catch (e) {
      alert('Error importing JSON: ' + e.message);
      console.error(e);
    }
  };
  reader.readAsText(file);
}

// ---------- Filter handling ----------
categoryFilter.addEventListener('change', () => {
  saveFilter(categoryFilter.value || 'all');
  // when filter changes, show a quote from that filter
  showRandomQuote();
});

// ---------- Notifications ----------
function notify(message, duration=4000) {
  notificationEl.style.display = 'block';
  notificationEl.textContent = message;
  setTimeout(() => {
    notificationEl.style.display = 'none';
    notificationEl.textContent = '';
  }, duration);
}

function showChangesList(changes) {
  // changes: array of strings
  if (!changes || !changes.length) {
    changesListEl.style.display = 'none';
    changesListEl.innerHTML = '';
    return;
  }
  changesListEl.style.display = 'block';
  changesListEl.innerHTML = changes.map(c => `<div>• ${escapeHtml(c)}</div>`).join('');
}

function escapeHtml(s){
  return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
}

// ---------- Simulated server sync ----------
/*
  Strategy:
  - Periodically fetch simulated quotes from JSONPlaceholder (posts) and map to quote objects.
  - Server takes precedence: for same id, server version replaces local if changed; new server quotes get added.
  - Keep a copy of local state before applying server changes to allow "undo".
  - Notify user and present simple changes summary.
*/
const SERVER_URL = 'https://jsonplaceholder.typicode.com/posts?_limit=6'; // mock API (CORS OK)
let syncIntervalId = null;
const SYNC_PERIOD_MS = 6 * 60 * 1000; // 6 minutes (you can adjust)
function mapServerPostToQuote(post) {
  // map post.id to id with prefix 'srv-' so no id clash with local UUIDs
  return {
    id: 'srv-' + post.id,
    text: post.body ? (post.body.split('\n')[0] || post.title) : post.title,
    category: (post.title || 'server').split(' ')[0].toLowerCase(),
    updatedAt: Date.now()
  };
}

async function fetchServerQuotesOnce() {
  try {
    const res = await fetch(SERVER_URL);
    if (!res.ok) throw new Error('Server returned ' + res.status);
    const posts = await res.json();
    const serverQuotes = posts.map(mapServerPostToQuote);
    // compute changes
    const localMap = new Map(quotes.map(q => [q.id, q]));
    const serverMap = new Map(serverQuotes.map(sq => [sq.id, sq]));
    const changes = [];
    // capture before state for undo
    lastLocalStateBeforeSync = JSON.parse(JSON.stringify(quotes));
    // apply server precedence:
    serverQuotes.forEach(sq => {
      const local = localMap.get(sq.id);
      if (!local) {
        quotes.push(sq);
        changes.push(`Added server quote "${shorten(sq.text)}" (id: ${sq.id})`);
      } else if (local.text !== sq.text || local.category !== sq.category) {
        // server wins -> replace
        localMap.set(sq.id, sq);
        changes.push(`Replaced local quote id ${sq.id} with server version.`);
      }
    });
    // rebuild quotes array with server precedence applied to overlapping ids,
    // and keep other local quotes
    const merged = [];
    const handledIds = new Set();
    // first add/replace server entries
    serverMap.forEach((sq, id) => {
      merged.push(sq);
      handledIds.add(id);
    });
    // then add local-only entries
    quotes.forEach(lq => {
      if (!handledIds.has(lq.id)) merged.push(lq);
    });
    quotes = merged;
    saveQuotes();
    if (changes.length) {
      notify(`Server sync applied: ${changes.length} changes.`);
      showChangesList(changes);
      undoSyncBtn.style.display = 'inline-block';
    } else {
      notify('Server sync: no changes.');
      showChangesList([]);
      undoSyncBtn.style.display = 'none';
    }
    return { applied: changes.length, details: changes };
  } catch (e) {
    console.error('Server sync failed', e);
    notify('Server sync failed. See console for details.');
    return { applied: 0, details: [] };
  }
}

function shorten(s, n=60) {
  return s.length > n ? s.slice(0,n-1)+'…' : s;
}

function startPeriodicSync() {
  if (syncIntervalId) clearInterval(syncIntervalId);
  syncIntervalId = setInterval(fetchServerQuotesOnce, SYNC_PERIOD_MS);
}

// manual revert
function revertLastSync() {
  if (!lastLocalStateBeforeSync) {
    alert('No sync to revert.');
    return;
  }
  quotes = lastLocalStateBeforeSync;
  saveQuotes();
  lastLocalStateBeforeSync = null;
  showChangesList([]);
  undoSyncBtn.style.display = 'none';
  notify('Reverted last sync.');
}

// ---------- Initialization ----------
function init() {
  // bind events
  newQuoteBtn.addEventListener('click', showRandomQuote);
  showAddFormBtn.addEventListener('click', toggleAddForm);
  addQuoteBtn.addEventListener('click', addQuote);
  exportJsonBtn.addEventListener('click', exportToJson);
  importFileInput.addEventListener('change', (ev) => {
    const f = ev.target.files && ev.target.files[0];
    if (f) importFromJsonFile(f);
    // reset input so same file can be reselected later
    importFileInput.value = '';
  });
  syncNowBtn.addEventListener('click', () => fetchServerQuotesOnce());
  undoSyncBtn.addEventListener('click', revertLastSync);

  // load data
  loadQuotes();

  // restore session last quote if present
  const sess = sessionStorage.getItem(SESSION_LAST_QUOTE);
  if (sess) {
    try {
      const q = JSON.parse(sess);
      showQuoteObject(q);
    } catch (e) {
      console.warn('bad session last quote', e);
      showRandomQuote();
    }
  } else {
    showRandomQuote();
  }

  // start periodic sync (simulated)
  startPeriodicSync();
}

// run
init();
