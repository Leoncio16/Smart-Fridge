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
  photoScan: document.querySelector("#photoScanButton"),
  photoScanInput: document.querySelector("#photoScanInput"),
  scannerPanel: document.querySelector("#scannerPanel"),
  scannerVideo: document.querySelector("#scannerVideo"),
  scannerCanvas: document.querySelector("#scannerCanvas"),
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
  await stopScanner();

  if (!navigator.mediaDevices?.getUserMedia) {
    setLookupStatus("Ta przegladarka nie udostepnia aparatu. Uzyj Zdjecie kodu albo wpisz kod recznie.", "error");
    return;
  }

  try {
    scannerStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });
    els.scannerVideo.srcObject = scannerStream;
    els.scannerPanel.hidden = false;
    els.scannerVideo.hidden = false;
    await els.scannerVideo.play();

    setLookupStatus("Widze obraz z aparatu. Ustaw kod poziomo w srodku kadru.");

    scannerTimer = window.setInterval(async () => {
      const decodedCode = decodeBarcodeFromSource(els.scannerVideo);
      if (!decodedCode) return;

      els.barcode.value = decodedCode;
      await stopScanner();
      setLookupStatus("Kod zostal zeskanowany.", "success");
      await lookupBarcode();
    }, 500);
  } catch {
    setLookupStatus("Nie mozna uruchomic aparatu. Uzyj Zdjecie kodu albo wpisz kod recznie.", "error");
    await stopScanner();
  }
}

async function scanBarcodeFromPhoto(event) {
  const file = event.target.files?.[0];
  event.target.value = "";

  if (!file) {
    return;
  }

  await stopScanner();
  els.scannerPanel.hidden = false;
  els.scannerVideo.hidden = true;
  setLookupStatus("Odczytuje kod ze zdjecia...");

  try {
    const image = await loadImageFromFile(file);
    const decodedCode = decodeBarcodeFromSource(image);

    if (!decodedCode) {
      throw new Error("not-found");
    }

    els.barcode.value = decodedCode;
    setLookupStatus("Kod zostal odczytany ze zdjecia.", "success");
    await lookupBarcode();
  } catch {
    setLookupStatus("Nie udalo sie odczytac kodu ze zdjecia. Sprobuj zrobic zdjecie blizej i ostrzej.", "error");
  }
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("image-load"));
    };
    image.src = objectUrl;
  });
}

function decodeBarcodeFromSource(source) {
  const canvas = els.scannerCanvas;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const sourceWidth = source.videoWidth || source.naturalWidth || source.width;
  const sourceHeight = source.videoHeight || source.naturalHeight || source.height;

  if (!sourceWidth || !sourceHeight) {
    return null;
  }

  const targetWidth = 640;
  const targetHeight = Math.max(180, Math.round(targetWidth * sourceHeight / sourceWidth));
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  context.drawImage(source, 0, 0, targetWidth, targetHeight);

  const scanLines = [
    0.45,
    0.50,
    0.55,
    0.40,
    0.60
  ];

  for (const ratio of scanLines) {
    const y = Math.min(targetHeight - 1, Math.max(0, Math.round(targetHeight * ratio)));
    const imageData = context.getImageData(0, y, targetWidth, 1).data;
    const grayscale = [];

    for (let x = 0; x < targetWidth; x += 1) {
      const index = x * 4;
      grayscale.push((imageData[index] * 0.299) + (imageData[index + 1] * 0.587) + (imageData[index + 2] * 0.114));
    }

    const decoded = decodeEanLine(grayscale);
    if (decoded) {
      return decoded;
    }
  }

  return null;
}

function decodeEanLine(grayscale) {
  const threshold = otsuThreshold(grayscale);
  const bits = grayscale.map((value) => value < threshold);
  const runs = [];
  let current = bits[0];
  let length = 1;

  for (let i = 1; i < bits.length; i += 1) {
    if (bits[i] === current) {
      length += 1;
    } else {
      runs.push({ color: current ? 1 : 0, length });
      current = bits[i];
      length = 1;
    }
  }
  runs.push({ color: current ? 1 : 0, length });

  for (let start = 0; start < runs.length - 59; start += 1) {
    if (!looksLikeStartGuard(runs, start)) continue;

    const moduleWidth = (runs[start].length + runs[start + 1].length + runs[start + 2].length) / 3;
    if (moduleWidth < 1.2) continue;

    const decoded = decodeEanFromRuns(runs, start, moduleWidth);
    if (decoded && isValidEan13(decoded)) {
      return decoded;
    }
  }

  return null;
}

function looksLikeStartGuard(runs, index) {
  return runs[index]?.color === 1
    && runs[index + 1]?.color === 0
    && runs[index + 2]?.color === 1;
}

function decodeEanFromRuns(runs, start, moduleWidth) {
  let offset = start + 3;
  const leftDigits = [];
  const parity = [];

  for (let digit = 0; digit < 6; digit += 1) {
    const pattern = readSevenModulePattern(runs, offset, moduleWidth);
    if (!pattern) return null;

    const decoded = decodeLeftDigit(pattern);
    if (!decoded) return null;

    leftDigits.push(decoded.digit);
    parity.push(decoded.parity);
    offset += pattern.runCount;
  }

  if (!looksLikeMiddleGuard(runs, offset)) return null;
  offset += 5;

  const rightDigits = [];
  for (let digit = 0; digit < 6; digit += 1) {
    const pattern = readSevenModulePattern(runs, offset, moduleWidth);
    if (!pattern) return null;

    const decoded = rightDigitPatterns[pattern.bits];
    if (!decoded) return null;

    rightDigits.push(decoded);
    offset += pattern.runCount;
  }

  const firstDigit = parityPatterns[parity.join("")];
  if (firstDigit === undefined) return null;

  return `${firstDigit}${leftDigits.join("")}${rightDigits.join("")}`;
}

function looksLikeMiddleGuard(runs, index) {
  return runs[index]?.color === 0
    && runs[index + 1]?.color === 1
    && runs[index + 2]?.color === 0
    && runs[index + 3]?.color === 1
    && runs[index + 4]?.color === 0;
}

function readSevenModulePattern(runs, offset, moduleWidth) {
  let modules = 0;
  let bits = "";
  let runCount = 0;

  while (offset + runCount < runs.length && modules < 7 && runCount < 4) {
    const run = runs[offset + runCount];
    const count = Math.max(1, Math.round(run.length / moduleWidth));
    bits += String(run.color).repeat(count);
    modules += count;
    runCount += 1;
  }

  if (bits.length < 7) return null;
  if (bits.length > 7) bits = bits.slice(0, 7);

  return { bits, runCount };
}

function decodeLeftDigit(pattern) {
  if (leftOddDigitPatterns[pattern.bits] !== undefined) {
    return { digit: leftOddDigitPatterns[pattern.bits], parity: "L" };
  }

  if (leftEvenDigitPatterns[pattern.bits] !== undefined) {
    return { digit: leftEvenDigitPatterns[pattern.bits], parity: "G" };
  }

  return null;
}

function otsuThreshold(values) {
  const histogram = new Array(256).fill(0);
  values.forEach((value) => {
    histogram[Math.max(0, Math.min(255, Math.round(value)))] += 1;
  });

  const total = values.length;
  let sum = 0;
  for (let i = 0; i < 256; i += 1) sum += i * histogram[i];

  let sumBackground = 0;
  let weightBackground = 0;
  let maxVariance = 0;
  let threshold = 128;

  for (let i = 0; i < 256; i += 1) {
    weightBackground += histogram[i];
    if (weightBackground === 0) continue;

    const weightForeground = total - weightBackground;
    if (weightForeground === 0) break;

    sumBackground += i * histogram[i];
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sum - sumBackground) / weightForeground;
    const variance = weightBackground * weightForeground * Math.pow(meanBackground - meanForeground, 2);

    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = i;
    }
  }

  return threshold;
}

function isValidEan13(code) {
  if (!/^\d{13}$/.test(code)) return false;

  const digits = code.split("").map(Number);
  const check = digits.pop();
  const sum = digits.reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10 === check;
}

const leftOddDigitPatterns = {
  "0001101": "0",
  "0011001": "1",
  "0010011": "2",
  "0111101": "3",
  "0100011": "4",
  "0110001": "5",
  "0101111": "6",
  "0111011": "7",
  "0110111": "8",
  "0001011": "9"
};

const leftEvenDigitPatterns = {
  "0100111": "0",
  "0110011": "1",
  "0011011": "2",
  "0100001": "3",
  "0011101": "4",
  "0111001": "5",
  "0000101": "6",
  "0010001": "7",
  "0001001": "8",
  "0010111": "9"
};

const rightDigitPatterns = {
  "1110010": "0",
  "1100110": "1",
  "1101100": "2",
  "1000010": "3",
  "1011100": "4",
  "1001110": "5",
  "1010000": "6",
  "1000100": "7",
  "1001000": "8",
  "1110100": "9"
};

const parityPatterns = {
  "LLLLLL": "0",
  "LLGLGG": "1",
  "LLGGLG": "2",
  "LLGGGL": "3",
  "LGLLGG": "4",
  "LGGLLG": "5",
  "LGGGLL": "6",
  "LGLGLG": "7",
  "LGLGGL": "8",
  "LGGLGL": "9"
};

async function stopScanner() {
  if (scannerTimer) {
    window.clearInterval(scannerTimer);
    scannerTimer = null;
  }

  if (scannerStream) {
    scannerStream.getTracks().forEach((track) => track.stop());
    scannerStream = null;
  }

  els.scannerVideo.srcObject = null;
  els.scannerVideo.hidden = false;
  els.scannerPanel.hidden = true;
}

els.openAdd.addEventListener("click", openAdd);
els.form.addEventListener("submit", handleSubmit);
els.deleteButton.addEventListener("click", deleteCurrent);
els.lookup.addEventListener("click", lookupBarcode);
els.scan.addEventListener("click", startScanner);
els.photoScan.addEventListener("click", () => els.photoScanInput.click());
els.photoScanInput.addEventListener("change", scanBarcodeFromPhoto);
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
