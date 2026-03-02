/**
 * US Market Dashboard - Real-time API Fetcher
 * Version: 2.0.0
 * Feature: realtime-api + dynamic-charts
 */

const CACHE_KEY_DATA = "us_market_data_v3";
const CACHE_KEY_TIME = "us_market_last_sync_v3";

// Registry to hold Chart.js instances for later updates
const _chartRegistry = {};

/**
 * 캐시 만료 체크 로직:
 * 매일 아침 8시를 기점으로 캐시를 만료시킨다.
 */
function isCacheExpired(lastSyncTime) {
    if (!lastSyncTime) return true;
    const syncDate = new Date(parseInt(lastSyncTime, 10));
    const now = new Date();
    // 기준시각: 오늘 오전 8시. 단, 현재 시각이 8시 이전이면 어제 오전 8시를 기준시각으로 삼는다.
    const target8AM = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0);
    if (now < target8AM) {
        target8AM.setDate(target8AM.getDate() - 1);
    }
    // 동기화 시점이 기준시각 이전이라면 만료된 것
    if (syncDate < target8AM) return true;
    return false;
}

/**
 * 데이터를 JSON 파일로부터 가져온다 (캐시 포함)
 */
async function fetchMarketData(force = false) {
    const cachedDataStr = localStorage.getItem(CACHE_KEY_DATA);
    const lastSyncStr = localStorage.getItem(CACHE_KEY_TIME);

    // [New] If on web (http/https), always try fresh fetch unless explicit policy
    const isWeb = window.location.protocol.startsWith('http');

    if (!force && cachedDataStr && !isCacheExpired(lastSyncStr)) {
        console.log("Using cached market data:", new Date(parseInt(lastSyncStr, 10)).toLocaleString());
        try {
            return JSON.parse(cachedDataStr);
        } catch (e) {
            console.error("Cache corrupted, clearing...");
            localStorage.removeItem(CACHE_KEY_DATA);
        }
    }

    // 1. Try fetching from JSON (suitable for web servers / http://)
    try {
        console.log("Fetching market data JSON...");
        // Use a cache-busting query param if forced or on web to ensure freshness
        const timestamp = force ? `?t=${Date.now()}` : '';
        const response = await fetch('data/market_data.json' + timestamp);
        if (response.ok) {
            const newMarketData = await response.json();
            localStorage.setItem(CACHE_KEY_DATA, JSON.stringify(newMarketData));
            localStorage.setItem(CACHE_KEY_TIME, Date.now().toString());
            console.log("Market data fetched successfully.");
            return newMarketData;
        } else {
            console.warn("Server returned error, checking fallback...");
        }
    } catch (err) {
        console.warn("Fetch failed (CORS or Network), checking fallback:", err.message);
    }

    // 2. Fallback to script-loaded data (Guaranteed for local files)
    if (window.__MARKET_DATA_FALLBACK__) {
        console.log("Using script-loaded fallback data.");
        return window.__MARKET_DATA_FALLBACK__;
    }

    return null;
}

/**
 * Handle Refresh Button Click
 */
async function handleRefreshClick() {
    console.log("Refresh requested...");
    const data = await fetchMarketData(true);
    if (data) {
        await renderDashboard(data);
        showToast("최신 정보가 동기화되었습니다.");
    } else {
        showToast("데이터 업데이트에 실패했습니다.", true);
    }
}

/**
 * 통합 대시보드 렌더링 함수
 */
async function renderDashboard(data) {
    if (!data) return;

    try {
        console.log("Rendering Dashboard Content...");
        // 1. Static DOM 업데이트
        updateDOMWithData(data);
        updateCommentaryWithData(data);
        // Assuming updateVixProgress is defined elsewhere or will be added
        // updateVixProgress(data);

        // 2. 비동기 포트폴리오 데이터
        fetchPortfolios().then(portfolioData => {
            // Assuming updatePortfoliosWithData is defined elsewhere or will be added
            // if (portfolioData) updatePortfoliosWithData(portfolioData);
        }).catch(err => console.warn("Portfolio load skipped:", err));

        // 3. 차트 및 동적 요소 업데이트
        requestAnimationFrame(() => {
            updateChartsWithData(data);
            updateSectorsWithData(data);
            updateYieldsWithData(data);
            // Assuming updateMag7WithData and updateListsWithData are defined elsewhere or will be added
            // updateMag7WithData(data);
            // updateListsWithData(data);
            console.log("Rendering cycle complete.");
        });
    } catch (err) {
        console.error("Critical rendering error:", err);
    }
}

// 전역 공개 (로컬 부트스트랩용)
window.renderDashboard = renderDashboard;

// 초기 로딩 시 진입점
document.addEventListener("DOMContentLoaded", async () => {
    console.log("Dashboard initializing...");
    const btnRefresh = document.getElementById("refresh-btn");
    if (btnRefresh) btnRefresh.addEventListener("click", handleRefreshClick);

    // 1. Pre-render with what we have (fastest TTI)
    if (window.__MARKET_DATA_FALLBACK__) {
        console.log("Initial boost: rendering fallback data.");
        renderDashboard(window.__MARKET_DATA_FALLBACK__);
    } else {
        const cached = localStorage.getItem(CACHE_KEY_DATA);
        if (cached) {
            try { renderDashboard(JSON.parse(cached)); } catch (e) { }
        }
    }

    // 2. Hot-swap with fresh data from server
    const data = await fetchMarketData(false);
    if (data) {
        console.log("Hot-swap: updating with fresh server data.");
        renderDashboard(data);
    }
});

/**
 * 받아온 JSON 데이터를 기반으로 가격/변동 DOM을 업데이트한다.
 */
function updateDOMWithData(data) {
    if (!data || !data.indices) return;

    const tickers = Object.keys(data.indices);
    tickers.forEach(symbol => {
        const priceEls = document.querySelectorAll(
            `.idx-val[data-ticker="${symbol}"], .metric-val[data-ticker="${symbol}"], .fx-val[data-ticker="${symbol}"]`
        );
        priceEls.forEach(priceEl => {
            let prefix = "";
            let suffix = "";
            const currentText = priceEl.textContent;
            if (currentText.includes("$")) prefix = "$";
            if (currentText.includes("%")) suffix = "%";
            priceEl.textContent = prefix + data.indices[symbol].price + suffix;

            // Remove 'dn' class if it was hidden initially
            const container = priceEl.closest('.idx-card, .mini-chart-card');
            if (container) container.classList.remove('dn');
        });

        const chgEls = document.querySelectorAll(
            `.idx-chg[data-ticker="${symbol}"], .metric-sub[data-ticker="${symbol}"], .fx-chg[data-ticker="${symbol}"]`
        );
        chgEls.forEach(chgEl => {
            chgEl.textContent = data.indices[symbol].changeText;
            chgEl.classList.remove('up', 'dn', 'warn', 'neu');
            if (data.indices[symbol].status === 'up') chgEl.classList.add('up');
            if (data.indices[symbol].status === 'down') chgEl.classList.add('dn');
            if (data.indices[symbol].status === 'warn') chgEl.classList.add('warn');
        });
    });

    // 최종 동기화 시간을 JSON 기반으로 표시 (모바일에서는 ID가 'last-sync-date' 또는 클래스로 부여될 수 있음)
    const timeLabel = document.getElementById("last-sync-time") || document.getElementById("last-sync-date");
    if (timeLabel && data.lastUpdated) {
        const d = new Date(data.lastUpdated);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        const day = days[d.getDay()];
        timeLabel.textContent = `${yyyy}.${mm}.${dd} (${day})`;
    }
}

/**
 * 차트 등록: HTML 스크립트에서 spark() 로 생성된 Chart.js 인스턴스를 등록한다.
 */
function registerChart(id, chartInstance) {
    _chartRegistry[id] = chartInstance;
}

/**
 * 히스토리 데이터로 스파크라인 차트를 업데이트한다.
 * canvas 의 data-ticker 속성으로 매핑.
 */
function updateChartsWithData(data) {
    if (!data || !data.history) return;

    // 히스토리가 있는 모든 canvas 를 찾아 업데이트
    document.querySelectorAll('canvas[data-ticker]').forEach(canvas => {
        const symbol = canvas.getAttribute('data-ticker');
        const hist = data.history[symbol];
        if (!hist) return;

        const chartInst = _chartRegistry[canvas.id];
        if (!chartInst) return;

        if (chartInst.stop) chartInst.stop(); // Stop any pending initial animation

        const vals = hist.values;
        const last = vals[vals.length - 1];
        const first = vals[0];
        const color = last >= first ? '#00e676' : '#ff4d4d';

        chartInst.data.labels = hist.labels;
        chartInst.data.datasets[0].data = vals;
        chartInst.data.datasets[0].borderColor = color;
        chartInst.data.datasets[0].backgroundColor = color + '18';
        chartInst.update('none'); // no animation on data update
    });

    // 메인 S&P500 차트 업데이트
    const mainChart = _chartRegistry['mainChart'] || _chartRegistry['indexChart'] || _chartRegistry['chart-main'];
    const gspc = data.history['^GSPC'];
    if (mainChart && gspc) {
        if (mainChart.stop) mainChart.stop(); // Stop any pending initial animation

        const vals = gspc.values;
        const minY = Math.floor(Math.min(...vals) / 100) * 100 - 100;
        const maxY = Math.ceil(Math.max(...vals) / 100) * 100 + 100;

        mainChart.data.labels = gspc.labels;
        mainChart.data.datasets[0].data = vals;
        mainChart.options.scales.y.min = minY;
        mainChart.options.scales.y.max = maxY;
        mainChart.update('none');
    }
}

/**
 * AI 해설 데이터로 DOM을 업데이트한다.
 */
function updateCommentaryWithData(data) {
    if (!data || !data.commentary) return;

    const comm = data.commentary;

    // 1. Brief 업데이트
    const briefEl = document.getElementById('ai-brief');
    if (briefEl) {
        briefEl.textContent = comm.brief || "현재 생성된 요약 해설이 없습니다.";
    }

    // 2. Topics 업데이트
    const topicsContainer = document.getElementById('ai-topics');
    if (topicsContainer) {
        if (comm.topics && Array.isArray(comm.topics) && comm.topics.length > 0) {
            topicsContainer.innerHTML = '';
            const colors = ['var(--warn)', 'var(--cyan)', 'var(--gold)', 'var(--t1)'];
            comm.topics.forEach((topic, idx) => {
                const color = colors[idx % colors.length];
                const numStr = String(idx + 1).padStart(2, '0');
                const topicHtml = `
                  <div class="narr-item">
                    <div class="narr-head">
                      <div class="narr-num" style="color:${color}">${numStr}</div>
                      <div class="narr-title">${topic.title}</div>
                    </div>
                    <div class="narr-body">
                      ${topic.description}
                    </div>
                  </div>
                `;
                topicsContainer.insertAdjacentHTML('beforeend', topicHtml);
            });
        } else {
            topicsContainer.innerHTML = '<div style="padding:20px;text-align:center;color:var(--t3)">주요 토픽 데이터가 없습니다.</div>';
        }
    }

    // 3. Events 업데이트
    const eventsContainer = document.getElementById('ai-events-list');
    if (eventsContainer && comm.events && Array.isArray(comm.events)) {
        eventsContainer.innerHTML = '';
        const impacts = ['high', 'high', 'medium', 'low'];
        comm.events.forEach((ev, idx) => {
            const impactClass = impacts[idx % impacts.length];
            const eventHtml = `
              <div class="event-row">
                <div class="impact-dot ${impactClass}"></div>
                <div class="event-time">${ev.date}</div>
                <div class="event-body">
                  <div class="event-name">${ev.description}</div>
                </div>
              </div>
            `;
            eventsContainer.insertAdjacentHTML('beforeend', eventHtml);
        });
    }

    // 4. TODAY'S KEY DRIVER banner
    const keyDriverEl = document.getElementById('key-driver-text');
    if (keyDriverEl) {
        keyDriverEl.textContent = comm.brief || "시장 흐름을 분석 중입니다...";
    }
}

/**
 * Sector Performance Chart 업데이트
 */
function updateSectorsWithData(data) {
    const chart = _chartRegistry['sectorChart'];
    if (!chart || !data || !data.sectors) return;

    const sectorMap = {
        "Technology": "기술",
        "Health Care": "헬스케어",
        "Financials": "금융",
        "Consumer Discretionary": "임의소비재",
        "Industrials": "산업재",
        "Communication": "통신",
        "Consumer Staples": "필수소비재",
        "Energy": "에너지",
        "Real Estate": "부동산",
        "Basic Materials": "원자재",
        "Utilities": "유틸리티"
    };

    const rawLabels = Object.keys(data.sectors);
    const labels = rawLabels.map(l => sectorMap[l] || l);
    const values = rawLabels.map(l => parseFloat(data.sectors[l].changePercent));

    chart.data.labels = labels;
    chart.data.datasets[0].data = values;
    chart.data.datasets[0].backgroundColor = values.map(v => v >= 0 ? '#00e67688' : '#ff4d4d88');
    chart.data.datasets[0].borderColor = values.map(v => v >= 0 ? '#00e676' : '#ff4d4d');
    chart.update('none');
}

/**
 * Yield Curve Chart 업데이트
 */
function updateYieldsWithData(data) {
    const chart = _chartRegistry['yieldChart'];
    if (!chart || !data || !data.yields) return;

    // Tickers: ^IRX(3M), ^FVX(5Y), ^TNX(10Y), ^TYX(30Y)
    const yieldTickers = ['^IRX', '^FVX', '^TNX', '^TYX'];
    const labels = ['3M', '5Y', '10Y', '30Y'];
    const values = yieldTickers.map(t => data.yields[t] ? parseFloat(data.yields[t].price) : 0);

    chart.data.labels = labels;
    chart.data.datasets[0].data = values;
    chart.update('none');
}

/**
 * Guru Portfolios (Buffett, ARK, etc.) 업데이트
 */
async function fetchPortfolios() {
    try {
        const response = await fetch('data/portfolios.json');
        if (!response.ok) {
            console.warn("Portfolios data not found (404), skipping portfolio updates.");
            return null;
        }
        return await response.json();
    } catch (e) {
        console.error("Error fetching portfolios:", e);
        return null;
    }
}

function updatePortfoliosWithData(portfolioData) {
    if (!portfolioData) return;

    // 1. Buffett Top 10
    const buffettContainer = document.getElementById('buffett-list');
    if (buffettContainer && portfolioData.buffett) {
        const holdings = portfolioData.buffett.holdings;
        buffettContainer.innerHTML = holdings.map(h => `
            <div class="row-item">
                <div class="row-rank">${h.rank}</div>
                <div class="row-name">${h.name} <span class="row-sub">${h.ticker}</span></div>
                <div class="row-weight">${h.weight}</div>
                <div class="row-action ${h.action}">${h.actionText}</div>
            </div>
        `).join('');
    }

    // 2. Buffett Changes
    const changeContainer = document.getElementById('buffett-changes');
    if (changeContainer && portfolioData.buffett.changes) {
        changeContainer.innerHTML = portfolioData.buffett.changes.map(c => `
            <div class="change-item">
                <span class="badge badge-${c.type}">${c.label}</span>
                <span class="change-text">${c.text}</span>
            </div>
        `).join('');
    }

    // 3. ARK Trades
    const arkContainer = document.getElementById('ark-trades');
    if (arkContainer && portfolioData.ark) {
        arkContainer.innerHTML = portfolioData.ark.trades.map(t => `
            <div class="row-item">
                <div class="row-etf">${t.etf}</div>
                <div class="row-ticker">${t.ticker}</div>
                <div class="row-name">${t.name}</div>
                <div class="row-val ${t.type}">${t.value}</div>
            </div>
        `).join('');
    }

    // 4. Pie Chart (Buffett Sector)
    const pieChart = _chartRegistry['pieChart'];
    if (pieChart && portfolioData.buffett && portfolioData.buffett.sectors) {
        pieChart.data.labels = portfolioData.buffett.sectors.map(s => s.label);
        pieChart.data.datasets[0].data = portfolioData.buffett.sectors.map(s => s.value);
        pieChart.update('none');
    }

    // 5. Guru Portfolios (Burry, Druckenmiller)
    const burryContainer = document.getElementById('burry-list');
    if (burryContainer && portfolioData.burry) {
        burryContainer.innerHTML = portfolioData.burry.holdings.map(h => `
            <div class="guru-row">
                <div class="guru-rank">${h.rank}</div>
                <div class="guru-tick">${h.ticker}</div>
                <div class="guru-name">${h.name}</div>
                <div class="guru-w">${h.weight}</div>
                <div class="guru-act ${h.action}">${h.actionText}</div>
            </div>
        `).join('');
    }

    const druckContainer = document.getElementById('druckenmiller-list');
    if (druckContainer && portfolioData.druckenmiller) {
        druckContainer.innerHTML = portfolioData.druckenmiller.holdings.map(h => `
            <div class="guru-row">
                <div class="guru-rank">${h.rank}</div>
                <div class="guru-tick">${h.ticker}</div>
                <div class="guru-name">${h.name}</div>
                <div class="guru-w">${h.weight}</div>
                <div class="guru-act ${h.action}">${h.actionText}</div>
            </div>
        `).join('');
    }
}

/**
 * Mag 7 Mini Cards 업데이트
 */
function updateMag7WithData(data) {
    if (!data || !data.indices) return;
    const mag7 = ['AAPL', 'NVDA', 'META', 'MSFT', 'AMZN', 'GOOGL', 'TSLA'];
    mag7.forEach(symbol => {
        const card = document.querySelector(`.mini-chart-card[data-ticker="${symbol}"]`);
        if (!card) return;

        const info = data.indices[symbol];
        if (!info) return;

        const priceEl = card.querySelector('.mini-chart-val');
        const chgEl = card.querySelector('.mini-chart-chg');

        if (priceEl) priceEl.textContent = '$' + info.price;
        if (chgEl) {
            chgEl.textContent = info.changeText;
            chgEl.style.color = info.status === 'up' ? 'var(--up)' : (info.status === 'down' ? 'var(--dn)' : 'var(--t2)');
        }
    });
}

/**
 * 주간 무버 및 워치리스트 업데이트
 */
function updateListsWithData(data) {
    if (!data || !data.indices) return;

    // AI Watchlist
    const aiContainer = document.getElementById('ai-watchlist-container');
    if (aiContainer) {
        const aiTickers = ['NVDA', 'AMD', 'AVGO', 'PLTR', 'TSM', 'ARM'];
        aiContainer.innerHTML = aiTickers.map(symbol => {
            const info = data.indices[symbol];
            if (!info) return '';
            return `
                <div class="row-item">
                    <div class="row-sym">${symbol}</div>
                    <div class="row-name">${info.name || symbol}</div>
                    <div class="row-price">$${info.price}</div>
                    <div class="row-chg ${info.status === 'up' ? 'up' : 'dn'}">${info.changeText}</div>
                </div>
            `;
        }).join('');
    }

    // Top Movers (Sample - in production we'd get this from backend/script)
    const moversContainer = document.getElementById('top-movers-list');
    if (moversContainer) {
        const moverTickers = ['PLTR', 'TSLA', 'COIN', 'MSTR', 'SMCI'];
        moversContainer.innerHTML = moverTickers.map(symbol => {
            const info = data.indices[symbol];
            if (!info) return '';
            return `
                <div class="row-item">
                    <div class="row-sym">${symbol}</div>
                    <div class="row-name">${info.name || symbol}</div>
                    <div class="row-price">$${info.price}</div>
                    <div class="row-chg ${info.status === 'up' ? 'up' : 'dn'}">${info.changeText}</div>
                </div>
            `;
        }).join('');
    }
}

/**
 * VIX progress bar dynamic update.
 */
function updateVixProgress(data) {
    if (!data || !data.indices || !data.indices['^VIX']) return;
    const vixVal = parseFloat(data.indices['^VIX'].price);
    if (isNaN(vixVal)) return;
    const pct = Math.min(100, Math.max(0, ((vixVal - 10) / 30) * 100));
    const vixProg = document.getElementById('vix-prog');
    if (vixProg) vixProg.style.width = pct.toFixed(0) + '%';
}

/**
 * 수동 Refresh 버튼 핸들러
 */
async function handleRefreshClick() {
    const btn = document.getElementById("refresh-btn");
    if (btn) btn.style.opacity = "0.5";

    const data = await fetchMarketData(true);
    if (data) {
        updateDOMWithData(data);
        updateChartsWithData(data);
        updateCommentaryWithData(data);
        updateVixProgress(data);
        updateSectorsWithData(data);
        updateYieldsWithData(data);
        updateMag7WithData(data);
        updateListsWithData(data);
    }

    const portfolioData = await fetchPortfolios();
    if (portfolioData) {
        updatePortfoliosWithData(portfolioData);
    }

    if (btn) btn.style.opacity = "1";
}

/**
 * 화면 구석에 작은 알림창 띄우기
 */
function showToast(message, isError = false) {
    const toast = document.createElement("div");
    toast.style.cssText = `
        position:fixed; bottom:80px; right:16px; padding:10px 16px;
        background:${isError ? '#ff4d4d' : '#4da6ff'}; color:#fff;
        border-radius:8px; font-size:12px; z-index:99999;
        transition:opacity 0.5s ease-in-out; box-shadow:0 2px 12px rgba(0,0,0,.4);
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.style.opacity = "0", 2500);
    setTimeout(() => toast.remove(), 3000);
}

/**
 * 통합 대시보드 렌더링 함수
 */
async function renderDashboard(data) {
    if (!data) return;

    // 1. Static DOM 업데이트
    updateDOMWithData(data);
    updateCommentaryWithData(data);
    updateVixProgress(data);

    // 2. 비동기 포트폴리오 데이터 (선택 사항)
    fetchPortfolios().then(portfolioData => {
        if (portfolioData) updatePortfoliosWithData(portfolioData);
    });

    // 3. 차트 및 동적 요소 업데이트 (requestAnimationFrame으로 성능 확보)
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            updateChartsWithData(data);
            updateSectorsWithData(data);
            updateYieldsWithData(data);
            updateMag7WithData(data);
            updateListsWithData(data);
        });
    });
}

// 전역 공개 (로컬 부트스트랩용)
window.renderDashboard = renderDashboard;

// 초기 로딩 시 진입점
document.addEventListener("DOMContentLoaded", async () => {
    const btnRefresh = document.getElementById("refresh-btn");
    if (btnRefresh) btnRefresh.addEventListener("click", handleRefreshClick);

    // 1. 로컬 데이터 우선 렌더링 (CORS 우회)
    if (window.__MARKET_DATA_FALLBACK__) {
        console.log("Init: Using local fallback data.");
        renderDashboard(window.__MARKET_DATA_FALLBACK__);
        // 로컬 파일 경로면 fetch 시도 자체가 무의미하므로 종료
        if (window.location.protocol === 'file:') return;
    }

    // 2. Web/Server 환경에서는 fetch 시도
    const data = await fetchMarketData(false);
    if (data) renderDashboard(data);
});
