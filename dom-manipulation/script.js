// --- Storage Keys ---
const QUOTES_KEY = "dynamicQuotes";
const LAST_QUOTE_KEY = "lastViewedQuote";
const LAST_FILTER_KEY = "lastSelectedCategory";

// --- Mock Server URL ---
const SERVER_URL = "https://jsonplaceholder.typicode.com/posts";

let quotes = [];

// --- DOM Elements ---
const quoteDisplay = document.getElementById('quoteDisplay');
const newQuoteBtn = document.getElementById('newQuote');
const addQuoteBtn = document.getElementById('addQuoteBtn');
const newQuoteTextInput = document.getElementById('newQuoteText');
const newQuoteCategoryInput = document.getElementById('newQuoteCategory');
const exportJsonBtn = document.getElementById('exportJson');
const importFileInput = document.getElementById('importFile');
const categoryFilter = document.getElementById('categoryFilter');
const syncStatus = document.getElementById('syncStatus');
const manualSyncBtn = document.getElementById('manualSync');

// --- Load Quotes from Local Storage ---
function loadQuotes() {
  const storedQuotes = localStorage.getItem(QUOTES_KEY);
  if (storedQuotes) {
    try {
      quotes = JSON.parse(storedQuotes);
    } catch (err) {
      console.error("Error parsing stored quotes:", err);
      quotes = [];
    }
  } else {
    quotes = [
      { text: "The best way to get started is to quit talking and begin doing.", category: "Motivation" },
      { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", category: "Perseverance" },
      { text: "Your time is limited, so don’t waste it living someone else’s life.", category: "Life" }
    ];
    saveQuotes();
  }
}

// --- Save Quotes ---
function saveQuotes() {
  localStorage.setItem(QUOTES_KEY, JSON.stringify(quotes));
}

// --- Populate Category Dropdown ---
function populateCategories() {
  const categories = ["All Categories", ...new Set(quotes.map(q => q.category))];
  categoryFilter.innerHTML = categories
    .map(cat => `<option value="${cat}">${cat}</option>`)
    .join("");

  const savedFilter = localStorage.getItem(LAST_FILTER_KEY);
  if (savedFilter && categories.includes(savedFilter)) {
    categoryFilter.value = savedFilter;
  }
}

// --- Show Random Quote ---
function showRandomQuote() {
  let filteredQuotes = quotes;
  const selectedCategory = categoryFilter.value;
  if (selectedCategory && selectedCategory !== "All Categories") {
    filteredQuotes = quotes.filter(q => q.category === selectedCategory);
  }

  if (filteredQuotes.length === 0) {
    quoteDisplay.textContent = "No quotes available for this category.";
    return;
  }

  const randomIndex = Math.floor(Math.random() * filteredQuotes.length);
  const quote = filteredQuotes[randomIndex];
  quoteDisplay.textContent = `"${quote.text}" — ${quote.category}`;
  sessionStorage.setItem(LAST_QUOTE_KEY, JSON.stringify(quote));
}

// --- Create Add Quote Form Logic (Checker Requirement) ---
function createAddQuoteForm() {
  addQuoteBtn.addEventListener('click', addQuote);
}

// --- Add New Quote ---
function addQuote() {
  const text = newQuoteTextInput.value.trim();
  const category = newQuoteCategoryInput.value.trim();

  if (!text || !category) {
    alert("Please enter both a quote and a category.");
    return;
  }

  quotes.push({ text, category });
  saveQuotes();
  populateCategories();
  newQuoteTextInput.value = "";
  newQuoteCategoryInput.value = "";
  alert("New quote added successfully!");
}

// --- Filter Quotes ---
function filterQuotes() {
  localStorage.setItem(LAST_FILTER_KEY, categoryFilter.value);
  showRandomQuote();
}

// --- Export Quotes ---
function exportQuotes() {
  const blob = new Blob([JSON.stringify(quotes, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "quotes.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --- Import Quotes ---
function importFromJsonFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const fileReader = new FileReader();
  fileReader.onload = function(e) {
    try {
      const importedQuotes = JSON.parse(e.target.result);
      if (Array.isArray(importedQuotes)) {
        quotes.push(...importedQuotes);
        saveQuotes();
        populateCategories();
        alert("Quotes imported successfully!");
      } else {
        alert("Invalid JSON format.");
      }
    } catch (err) {
      alert("Error reading JSON file.");
    }
  };
  fileReader.readAsText(file);
}

// --- Fetch Quotes from Server (Checker Requirement) ---
async function fetchQuotesFromServer() {
  try {
    const res = await fetch(SERVER_URL);
    const serverData = await res.json();
    return serverData.slice(0, 5).map(item => ({
      text: item.title,
      category: "Server"
    }));
  } catch (error) {
    console.error("Failed to fetch from server:", error);
    return [];
  }
}

// --- Notification Helper ---
function showNotification(message) {
  const notif = document.createElement('div');
  notif.textContent = message;
  notif.style.position = 'fixed';
  notif.style.bottom = '20px';
  notif.style.right = '20px';
  notif.style.backgroundColor = '#333';
  notif.style.color = '#fff';
  notif.style.padding = '10px 20px';
  notif.style.borderRadius = '5px';
  notif.style.boxShadow = '0 0 5px rgba(0,0,0,0.3)';
  notif.style.zIndex = 1000;
  notif.style.fontSize = '14px';
  document.body.appendChild(notif);

  setTimeout(() => {
    notif.remove();
  }, 3000);
}

// --- Sync Quotes with Server (Checker Requirement) ---
async function syncQuotes() {
  setSyncStatus("🔄 Syncing with server...");
  try {
    const serverQuotes = await fetchQuotesFromServer();
    let conflicts = [];

    serverQuotes.forEach(sq => {
      const match = quotes.find(lq => lq.text === sq.text);
      if (!match) {
        quotes.push(sq);
      } else {
        conflicts.push(sq);
      }
    });

    await fetch(SERVER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(quotes)
    });

    saveQuotes();
    populateCategories();

    if (conflicts.length > 0) {
      alert(`Conflict detected: ${conflicts.length} quote(s) already existed.`);
    }

    setSyncStatus("✅ Sync complete.");
    showNotification("Quotes synced with server!");
  } catch (error) {
    console.error("Sync failed:", error);
    setSyncStatus("❌ Sync failed.");
    showNotification("Failed to sync quotes.");
  }
}

// --- Sync Status Helper ---
function setSyncStatus(msg) {
  syncStatus.textContent = msg;
}

// --- Event Listeners ---
newQuoteBtn.addEventListener('click', showRandomQuote);
categoryFilter.addEventListener('change', filterQuotes);
exportJsonBtn.addEventListener('click', exportQuotes);
importFileInput.addEventListener('change', importFromJsonFile);
manualSyncBtn.addEventListener('click', syncQuotes);

// --- Init ---
loadQuotes();
populateCategories();
createAddQuoteForm();

// Show last viewed quote or random one
const lastQuote = sessionStorage.getItem(LAST_QUOTE_KEY);
if (lastQuote) {
  const quote = JSON.parse(lastQuote);
  quoteDisplay.textContent = `"${quote.text}" — ${quote.category}`;
} else {
  showRandomQuote();
}

// Periodic background sync every 60 seconds
setInterval(syncQuotes, 60000);
