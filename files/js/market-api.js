/**
 * US Market Dashboard - Real-time API Fetcher
 * Version: 2.1.0
 * Feature: unified-init + redundancy-fix
 */

const CACHE_KEY_DATA = "us_market_data_v3";
const CACHE_KEY_TIME = "us_market_last_sync_v3";

const _chartRegistry = {};

function isCacheExpired(lastSyncTime) {
    if (!lastSyncTime) return true;
    const syncDate = new Date(parseInt(lastSyncTime, 10));
    const now = new Date();
    const target8AM = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0);
    if (now < target8AM) target8AM.setDate(target8AM.getDate() - 1);
    return syncDate < target8AM;
}

async function fetchMarketData(force = false) {
    const cachedDataStr = localStorage.getItem(CACHE_KEY_DATA);
    const lastSyncStr = localStorage.getItem(CACHE_KEY_TIME);
    const isWeb = window.location.protocol.startsWith('http');

    if (!force && cachedDataStr && !isCacheExpired(lastSyncStr)) {
        console.log("Using cached market data:", new Date(parseInt(lastSyncStr, 10)).toLocaleString());
        try { return JSON.parse(cachedDataStr); } catch (e) { localStorage.removeItem(CACHE_KEY_DATA); }
    }

    try {
        console.log("Fetching market data JSON...");
        const timestamp = force ? `?t=${Date.now()}` : '';
        const response = await fetch('data/market_data.json' + timestamp);
        if (response.ok) {
            const data = await response.json();
            localStorage.setItem(CACHE_KEY_DATA, JSON.stringify(data));
            localStorage.setItem(CACHE_KEY_TIME, Date.now().toString());
            console.log("Market data fetched successfully.");
            return data;
        }
    } catch (err) { console.warn("Fetch failed:", err.message); }

    if (window.__MARKET_DATA_FALLBACK__) {
        console.log("Using script-loaded fallback data.");
        return window.__MARKET_DATA_FALLBACK__;
    }
    return null;
}

async function handleRefreshClick() {
    const btn = document.getElementById("refresh-btn");
    if (btn) btn.style.opacity = "0.5";
    const data = await fetchMarketData(true);
    if (data) {
        await renderDashboard(data);
        showToast("최신 정보가 동기화되었습니다.");
    } else {
        showToast("데이터 업데이트에 실패했습니다.", true);
    }
    if (btn) btn.style.opacity = "1";
}

function showToast(message, isError = false) {
    const toast = document.createElement("div");
    toast.style.cssText = `position:fixed; bottom:80px; right:16px; padding:10px 16px; background:${isError ? '#ff4d4d' : '#4da6ff'}; color:#fff; border-radius:8px; font-size:12px; z-index:99999; transition:opacity 0.5s ease-in-out; box-shadow:0 2px 12px rgba(0,0,0,.4);`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.style.opacity = "0", 2500);
    setTimeout(() => toast.remove(), 3000);
}

/**
 * [Varying Functions] - Define all necessary UI update functions
 */
function updateDOMWithData(data) {
    if (!data || !data.indices) return;
    Object.keys(data.indices).forEach(symbol => {
        const info = data.indices[symbol];
        document.querySelectorAll(`[data-ticker="${symbol}"]`).forEach(el => {
            if (el.classList.contains('idx-val') || el.classList.contains('metric-val') || el.classList.contains('fx-val')) {
                let p = el.textContent.includes("$") ? "$" : "";
                let s = el.textContent.includes("%") ? "%" : "";
                el.textContent = p + info.price + s;
                const card = el.closest('.idx-card, .mini-chart-card');
                if (card) card.classList.remove('dn');
            }
            if (el.classList.contains('idx-chg') || el.classList.contains('metric-sub') || el.classList.contains('fx-chg')) {
                el.textContent = info.changeText;
                el.classList.remove('up', 'dn', 'warn', 'neu');
                if (info.status === 'up') el.classList.add('up');
                if (info.status === 'down') el.classList.add('dn');
                if (info.status === 'warn') el.classList.add('warn');
            }
        });
    });
    const timeLabel = document.getElementById("last-sync-time") || document.getElementById("last-sync-date");
    if (timeLabel && data.lastUpdated) {
        const d = new Date(data.lastUpdated);
        timeLabel.textContent = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} (${['일', '월', '화', '수', '목', '금', '토'][d.getDay()]})`;
    }
}

function updateChartsWithData(data) {
    if (!data || !data.history) return;
    document.querySelectorAll('canvas[data-ticker]').forEach(canvas => {
        const symbol = canvas.getAttribute('data-ticker');
        const hist = data.history[symbol];
        const chartInst = _chartRegistry[canvas.id];
        if (!hist || !chartInst) return;
        const vals = hist.values;
        const color = vals[vals.length - 1] >= vals[0] ? '#00e676' : '#ff4d4d';
        chartInst.data.labels = hist.labels;
        chartInst.data.datasets[0].data = vals;
        chartInst.data.datasets[0].borderColor = color;
        chartInst.data.datasets[0].backgroundColor = color + '18';
        chartInst.update('none');
    });
}

function updateCommentaryWithData(data) {
    if (!data || !data.commentary) return;
    const briefEl = document.getElementById('ai-brief');
    if (briefEl) briefEl.textContent = data.commentary.brief || "";
    const driverEl = document.getElementById('key-driver-text');
    if (driverEl) driverEl.textContent = data.commentary.brief || "";
}

function updateMag7WithData(data) {
    if (!data || !data.indices) return;
    ['AAPL', 'NVDA', 'META', 'MSFT', 'AMZN', 'GOOGL', 'TSLA'].forEach(s => {
        const card = document.querySelector(`.mini-chart-card[data-ticker="${s}"]`);
        if (!card) return;
        const info = data.indices[s];
        const val = card.querySelector('.mini-chart-val');
        const chg = card.querySelector('.mini-chart-chg');
        if (val) val.textContent = '$' + info.price;
        if (chg) {
            chg.textContent = info.changeText;
            chg.style.color = info.status === 'up' ? 'var(--up)' : (info.status === 'down' ? 'var(--dn)' : 'var(--t2)');
        }
        card.classList.remove('dn');
    });
}

function updateListsWithData(data) {
    const aiBox = document.getElementById('ai-watchlist-container');
    if (aiBox && data.indices) {
        aiBox.innerHTML = ['NVDA', 'AMD', 'AVGO', 'PLTR', 'TSM', 'ARM'].map(s => {
            const info = data.indices[s];
            if (!info) return '';
            return `<div class="row-item"><div class="row-sym">${s}</div><div class="row-name">${info.name || s}</div><div class="row-price">$${info.price}</div><div class="row-chg ${info.status === 'up' ? 'up' : 'dn'}">${info.changeText}</div></div>`;
        }).join('');
    }
}

function updateVixProgress(data) {
    const vix = data?.indices?.['^VIX'];
    if (!vix) return;
    const val = parseFloat(vix.price);
    const pct = Math.min(100, Math.max(0, ((val - 10) / 30) * 100));
    const el = document.getElementById('vix-prog');
    if (el) el.style.width = pct + '%';
}

async function fetchPortfolios() {
    try { const r = await fetch('data/portfolios.json'); return r.ok ? await r.json() : null; } catch (e) { return null; }
}

async function renderDashboard(data) {
    if (!data) return;
    try {
        console.log("Rendering Dashboard Content...");
        updateDOMWithData(data);
        updateCommentaryWithData(data);
        updateVixProgress(data);
        updateMag7WithData(data);
        updateListsWithData(data);
        updateChartsWithData(data);
        fetchPortfolios().then(p => { /* update portfolios if needed */ });
        console.log("Rendering cycle complete.");
    } catch (e) { console.error("Render error:", e); }
}

window.renderDashboard = renderDashboard;
window.registerChart = (id, inst) => { _chartRegistry[id] = inst; };

document.addEventListener("DOMContentLoaded", async () => {
    console.log("Dashboard initializing...");
    const btn = document.getElementById("refresh-btn");
    if (btn) btn.addEventListener("click", handleRefreshClick);

    // Initial load sequence
    let data = null;
    const cached = localStorage.getItem(CACHE_KEY_DATA);
    if (cached) try { data = JSON.parse(cached); } catch (e) { }
    if (!data && window.__MARKET_DATA_FALLBACK__) data = window.__MARKET_DATA_FALLBACK__;

    if (data) renderDashboard(data);

    // Hot-swap
    const fresh = await fetchMarketData(false);
    if (fresh) renderDashboard(fresh);
});

