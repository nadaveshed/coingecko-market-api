const form = document.querySelector("#search-form");
const statusEl = document.querySelector("#status");
const resultEl = document.querySelector("#result");
const button = form.querySelector("button");
const currencySelect = document.querySelector("#currency");
const pageInput = document.querySelector("#page");
const perPageInput = document.querySelector("#per-page");
const limitInput = document.querySelector("#limit");

loadUiDefaults();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  button.disabled = true;
  showStatus("טוען נתוני שוק...");
  resultEl.hidden = true;
  const params = new URLSearchParams({
    currency: currencySelect.value,
    page: pageInput.value,
    per_page: perPageInput.value,
    limit: limitInput.value,
  });
  try {
    const response = await fetch(`/api/market/overview?${params}`);
    const data = await response.json();
    if (!response.ok) {
      showStatus(data.detail || "הבקשה נכשלה", true);
      return;
    }
    render(data);
  } catch {
    showStatus("לא ניתן להתחבר לשרת", true);
  } finally {
    button.disabled = false;
  }
});

async function loadUiDefaults() {
  try {
    const response = await fetch("/api/config/ui");
    if (!response.ok) return;
    const config = await response.json();
    for (const cur of config.allowedCurrencies) {
      const opt = document.createElement("option");
      opt.value = cur;
      opt.textContent = cur.toUpperCase();
      if (cur === config.currency) opt.selected = true;
      currencySelect.appendChild(opt);
    }
    pageInput.value = String(config.page);
    perPageInput.value = String(config.perPage);
    perPageInput.max = String(config.maxPerPage);
    limitInput.value = String(config.limit);
    limitInput.max = String(config.maxLimit);
  } catch {}
}

function render(data) {
  statusEl.hidden = true;
  resultEl.hidden = false;
  const u = data.universe;
  const f = data.fetch;
  const currency = data.meta.currency;
  resultEl.innerHTML = `
    <div class="meta-row">
      <span class="pill ${data.meta.cache === "hit" ? "hit" : ""}">cache: ${data.meta.cache}</span>
      ${data.meta.coalesced ? '<span class="pill">coalesced</span>' : ""}
      ${f.degraded ? '<span class="pill degraded">degraded</span>' : '<span class="pill ok">תקין</span>'}
      <span class="pill">${f.per_page} לעמוד</span>
      <span class="pill">עמודים: ${f.fetched_pages.join(", ") || "—"}${f.failed_pages.length ? " | נכשלו: " + f.failed_pages.join(", ") : ""}</span>
    </div>

    <div class="stats">
      ${stat("מטבעות בסריקה", u.count)}
      ${stat("Market Cap כולל", money(u.market_cap, currency))}
      ${stat("Volume 24h", money(u.volume_24h, currency))}
      ${stat("עלו", u.up, "up")}
      ${stat("ירדו", u.down, "down")}
      ${stat("ללא שינוי", u.flat)}
      ${u.unknown_change ? stat("שינוי לא ידוע", u.unknown_change) : ""}
      ${stat("מעל $1B", u.market_cap_gte_1b)}
      ${stat("Large Cap", u.large_cap)}
      ${stat("Mid Cap", u.mid_cap)}
      ${stat("Small Cap", u.small_cap)}
      ${u.unknown_market_cap ? stat("Market Cap לא ידוע", u.unknown_market_cap) : ""}
    </div>

    ${coinTable("Top Market Cap", data.top_market_cap, "cap", currency)}
    ${coinTable("Top Volume 24h", data.top_volume, "volume", currency)}
    ${coinTable("Top Gainers 24h", data.top_gainers, "change", currency)}
    ${coinTable("Top Losers 24h", data.top_losers, "change", currency)}
  `;
}

function stat(label, value, type) {
  let cls = "";
  if (type === "up") cls = " stat-up";
  else if (type === "down") cls = " stat-down";
  return `<article class="card stat${cls}"><span>${label}</span><strong>${value}</strong></article>`;
}

function coinTable(title, rows, mode, currency) {
  if (!rows || rows.length === 0) return "";
  const headers = { cap: "Market Cap", volume: "Volume 24h", change: "שינוי 24h" };
  const body = rows
    .map((row) => {
      let extra = "";
      if (mode === "cap") extra = money(row.market_cap, currency);
      else if (mode === "volume") extra = money(row.volume_24h, currency);
      else extra = pctBadge(row.change_24h_pct);
      return `<tr>
        <td class="rank">${row.rank ?? "—"}</td>
        <td class="name-cell"><strong>${esc(row.name)}</strong> <span class="symbol">${esc(row.symbol).toUpperCase()}</span></td>
        <td class="price">${money(row.price, currency)}</td>
        <td class="extra">${extra}</td>
      </tr>`;
    })
    .join("");
  return `<section class="card table-card">
    <h2>${title}</h2>
    <table>
      <thead><tr><th>#</th><th>מטבע</th><th>מחיר</th><th>${headers[mode]}</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
  </section>`;
}

function money(value, currency) {
  if (value == null) return "—";
  return Intl.NumberFormat("en", {
    style: "currency",
    currency: currency.toUpperCase(),
    notation: Math.abs(value) >= 1 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(value) >= 1 ? 2 : 6,
  }).format(value);
}

function pctBadge(value) {
  if (value == null) return "—";
  const cls = value > 0 ? "pct-up" : value < 0 ? "pct-down" : "";
  const sign = value > 0 ? "+" : "";
  return `<span class="pct ${cls}">${sign}${value.toFixed(2)}%</span>`;
}

function showStatus(message, isError = false) {
  statusEl.hidden = false;
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function esc(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
