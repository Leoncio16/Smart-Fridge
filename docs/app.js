const storageKey = "smart-fridge-web-items";

const els = {
  list: document.querySelector("#foodList"),
  empty: document.querySelector("#emptyState"),
  search: document.querySelector("#searchInput"),
  openAdd: document.querySelector("#openAdd"),
  dialog: document.querySelector("#foodDialog"),
  form: document.querySelector("#foodForm"),
  title: document.querySelector("#dialogTitle"),
  itemId: document.querySelector("#itemId"),
  barcode: document.querySelector("#barcodeInput"),
  lookup: document.querySelector("#lookupButton"),
  lookupStatus: document.querySelector("#lookupStatus"),
  scan: document.querySelector("#scanButton"),
  scannerPanel: document.querySelector("#scannerPanel"),
  scannerVideo: document.querySelector("#scannerVideo"),
  html5Reader: document.querySelector("#html5Reader"),
  stopScan: document.querySelector("#stopScanButton"),
  name: document.querySelector("#nameInput"),
  quantity: document.querySelector("#quantityInput"),
  date: document.querySelector("#dateInput"),
  category: document.querySelector("#categoryInput"),
  deleteButton: document.querySelector("#deleteButton"),
  total: document.querySelector("#totalCount"),
  soon: document.querySelector("#soonCount"),
  expired: document.querySelector("#expiredCount"),
  segments: document.querySelectorAll(".segment")
};

let items = loadItems();
let activeFilter = "all";
let scannerStream = null;
let scannerTimer = null;
let html5Scanner = null;

function loadItems() {
  const raw = localStorage.getItem(storageKey);
  if (raw) {
    return JSON.parse(raw);
  }

  const today = startOfDay(new Date());
  const samples = [
    {
      id: crypto.randomUUID(),
      name: "Jogurt naturalny",
      barcode: "5900783000424",
      quantity: "2 szt.",
      expirationDate: addDays(today, 1),
      category: "Nabial",
      createdAt: new Date().toISOString()
    },
    {
      id: crypto.randomUUID(),
      name: "Pomidory",
      quantity: "500 g",
      expirationDate: addDays(today, 4),
      category: "Warzywa",
      createdAt: new Date().toISOString()
    },
    {
      id: crypto.randomUUID(),
      name: "Sok jablkowy",
      quantity: "1 l",
      expirationDate: addDays(today, 9),
      category: "Napoje",
      createdAt: new Date().toISOString()
    }
  ];

  saveItems(samples);
  return samples;
}

function saveItems(nextItems = items) {
  localStorage.setItem(storageKey, JSON.stringify(nextItems));
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return toDateInputValue(next);
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysUntil(dateString) {
  const today = startOfDay(new Date());
  const target = startOfDay(new Date(`${dateString}T00:00:00`));
  return Math.round((target - today) / 86400000);
}

function statusFor(item) {
  const days = daysUntil(item.expirationDate);
  if (days > 5) return "fresh";
  if (days >= 2) return "soon";
  return "critical";
}

function subtitleFor(item) {
  const days = daysUntil(item.expirationDate);
  if (days < 0) return `Przeterminowane ${Math.abs(days)} d. temu`;
  if (days === 0) return "Termin mija dzis";
  if (days === 1) return "Zostaje 1 dzien";
  return `Zostaje ${days} dni`;
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(`${dateString}T00:00:00`));
}

function filteredItems() {
  const search = els.search.value.trim().toLowerCase();

  return [...items]
    .sort((a, b) => a.expirationDate.localeCompare(b.expirationDate))
    .filter((item) => {
      const searchable = `${item.name} ${item.barcode || ""} ${item.quantity || ""} ${item.category || ""}`.toLowerCase();
      const matchesSearch = !search || searchable.includes(search);
      const days = daysUntil(item.expirationDate);
      const matchesFilter =
        activeFilter === "all" ||
        (activeFilter === "soon" && days >= 0 && days <= 5) ||
        (activeFilter === "expired" && days < 0);

      return matchesSearch && matchesFilter;
    });
}

function render() {
  const visibleItems = filteredItems();
  els.list.innerHTML = "";

  els.total.textContent = items.length;
  els.soon.textContent = items.filter((item) => {
    const days = daysUntil(item.expirationDate);
    return days >= 0 && days <= 5;
  }).length;
  els.expired.textContent = items.filter((item) => daysUntil(item.expirationDate) < 0).length;

  els.empty.hidden = visibleItems.length !== 0;
  els.list.hidden = visibleItems.length === 0;

  for (const item of visibleItems) {
    const status = statusFor(item);
    const row = document.createElement("button");
    row.className = "food-row";
    row.type = "button";
    row.innerHTML = `
      <span class="status-dot ${status}-bg" aria-hidden="true"></span>
      <span class="food-main">
        <span class="food-name">${escapeHtml(item.name)}</span>
        <span class="food-meta">${escapeHtml([item.quantity, item.category].filter(Boolean).join(" · "))}</span>
      </span>
      <span class="food-side">
        <span class="food-date">${formatDate(item.expirationDate)}</span>
        <span class="food-days ${status}">${subtitleFor(item)}</span>
      </span>
    `;
    row.addEventListener("click", () => openEdit(item.id));
    els.list.appendChild(row);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function openAdd() {
  els.title.textContent = "Dodaj produkt";
  els.itemId.value = "";
  els.barcode.value = "";
  els.name.value = "";
  els.quantity.value = "";
  els.date.value = toDateInputValue(new Date());
  els.category.value = "Nabial";
  els.deleteButton.hidden = true;
  setLookupStatus("");
  stopScanner();
  els.dialog.showModal();
  els.barcode.focus();
}

function openEdit(id) {
  const item = items.find((entry) => entry.id === id);
  if (!item) return;

  els.title.textContent = "Edytuj produkt";
  els.itemId.value = item.id;
  els.barcode.value = item.barcode || "";
  els.name.value = item.name;
  els.quantity.value = item.quantity || "";
  els.date.value = item.expirationDate;
  els.category.value = item.category || "Inne";
  els.deleteButton.hidden = false;
  setLookupStatus("");
  stopScanner();
  els.dialog.showModal();
}

function handleSubmit(event) {
  event.preventDefault();

  const existingId = els.itemId.value;
  const payload = {
    id: existingId || crypto.randomUUID(),
    name: els.name.value.trim(),
    barcode: els.barcode.value.trim(),
    quantity: els.quantity.value.trim(),
    expirationDate: els.date.value,
    category: els.category.value,
    createdAt: existingId
      ? items.find((item) => item.id === existingId)?.createdAt || new Date().toISOString()
      : new Date().toISOString()
  };

  if (!payload.name) return;

  if (existingId) {
    items = items.map((item) => (item.id === existingId ? payload : item));
  } else {
    items.push(payload);
  }

  saveItems();
  els.dialog.close();
  stopScanner();
  render();
}

function deleteCurrent() {
  const id = els.itemId.value;
  if (!id) return;

  items = items.filter((item) => item.id !== id);
  saveItems();
  els.dialog.close();
  stopScanner();
  render();
}

async function lookupBarcode() {
  const barcode = els.barcode.value.trim();
  if (!barcode) {
    setLookupStatus("Wpisz albo zeskanuj kod kreskowy.", "error");
    return;
  }

  setLookupStatus("Pobieram dane z Open Food Facts...");
  els.lookup.disabled = true;

  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`);
    if (!response.ok) {
      throw new Error("network");
    }

    const data = await response.json();
    if (data.status !== 1 || !data.product) {
      setLookupStatus("Nie znaleziono produktu dla tego kodu.", "error");
      return;
    }

    applyProductData(data.product);
    setLookupStatus("Dane produktu zostaly pobrane.", "success");
  } catch {
    setLookupStatus("Nie udalo sie pobrac danych. Sprawdz polaczenie i kod.", "error");
  } finally {
    els.lookup.disabled = false;
  }
}

function applyProductData(product) {
  const productName = product.product_name_pl || product.product_name || product.generic_name || "";
  const quantity = product.quantity || "";
  const category = mapCategory(product.categories_tags || [], product.categories || "");

  if (productName) els.name.value = productName;
  if (quantity) els.quantity.value = quantity;
  els.category.value = category;
}

function mapCategory(tags, categoriesText) {
  const joined = `${tags.join(" ")} ${categoriesText}`.toLowerCase();
  if (joined.includes("dair") || joined.includes("nabial") || joined.includes("milk") || joined.includes("cheese")) return "Nabial";
  if (joined.includes("meat") || joined.includes("mieso") || joined.includes("fish")) return "Mieso";
  if (joined.includes("vegetable") || joined.includes("warzy")) return "Warzywa";
  if (joined.includes("fruit") || joined.includes("owoc")) return "Owoce";
  if (joined.includes("beverage") || joined.includes("drink") || joined.includes("napoj")) return "Napoje";
  if (joined.includes("meal") || joined.includes("dish") || joined.includes("ready")) return "Gotowe dania";
  return "Inne";
}

function setLookupStatus(message, kind = "") {
  els.lookupStatus.textContent = message;
  els.lookupStatus.className = `lookup-status ${kind}`;
}

async function startScanner() {
  stopScanner();

  if ("Html5Qrcode" in window) {
    await startHtml5Scanner();
    return;
  }

  if (!("BarcodeDetector" in window)) {
    setLookupStatus("Ta przegladarka nie obsluguje skanowania. Wpisz kod recznie.", "error");
    return;
  }

  try {
    scannerStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" }
    });
    els.scannerVideo.srcObject = scannerStream;
    els.scannerPanel.hidden = false;
    await els.scannerVideo.play();

    const detector = new BarcodeDetector({
      formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"]
    });

    scannerTimer = window.setInterval(async () => {
      const codes = await detector.detect(els.scannerVideo);
      if (codes.length === 0) return;

      els.barcode.value = codes[0].rawValue;
      stopScanner();
      await lookupBarcode();
    }, 600);
  } catch {
    setLookupStatus("Nie mozna uruchomic aparatu. Wpisz kod recznie.", "error");
    stopScanner();
  }
}

async function startHtml5Scanner() {
  try {
    els.scannerPanel.hidden = false;
    els.scannerVideo.hidden = true;
    html5Scanner = new Html5Qrcode("html5Reader");

    await html5Scanner.start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: { width: 260, height: 160 },
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128
        ]
      },
      async (decodedText) => {
        els.barcode.value = decodedText;
        await stopScanner();
        await lookupBarcode();
      }
    );
  } catch {
    setLookupStatus("Nie mozna uruchomic aparatu. Wpisz kod recznie.", "error");
    await stopScanner();
  }
}

async function stopScanner() {
  if (scannerTimer) {
    window.clearInterval(scannerTimer);
    scannerTimer = null;
  }

  if (html5Scanner) {
    try {
      await html5Scanner.stop();
      await html5Scanner.clear();
    } catch {
      // Scanner can already be stopped when the dialog closes.
    }
    html5Scanner = null;
  }

  if (scannerStream) {
    scannerStream.getTracks().forEach((track) => track.stop());
    scannerStream = null;
  }

  els.scannerVideo.srcObject = null;
  els.scannerVideo.hidden = false;
  els.html5Reader.innerHTML = "";
  els.scannerPanel.hidden = true;
}

els.openAdd.addEventListener("click", openAdd);
els.form.addEventListener("submit", handleSubmit);
els.deleteButton.addEventListener("click", deleteCurrent);
els.lookup.addEventListener("click", lookupBarcode);
els.scan.addEventListener("click", startScanner);
els.stopScan.addEventListener("click", stopScanner);
els.search.addEventListener("input", render);
els.dialog.addEventListener("close", stopScanner);

for (const segment of els.segments) {
  segment.addEventListener("click", () => {
    activeFilter = segment.dataset.filter;
    els.segments.forEach((entry) => entry.classList.toggle("active", entry === segment));
    render();
  });
}

render();

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("./service-worker.js");
}
