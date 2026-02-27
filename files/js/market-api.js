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

    if (!force && cachedDataStr && !isCacheExpired(lastSyncStr)) {
        console.log("Using cached market data:", new Date(parseInt(lastSyncStr, 10)).toLocaleString());
        return JSON.parse(cachedDataStr);
    }

    try {
        console.log("Fetching static market data JSON...");
        const response = await fetch('data/market_data.json');
        if (!response.ok) throw new Error(`Failed to load static market data: ${response.statusText}`);

        const newMarketData = await response.json();

        localStorage.setItem(CACHE_KEY_DATA, JSON.stringify(newMarketData));
        localStorage.setItem(CACHE_KEY_TIME, Date.now().toString());

        showToast("최신 정보가 동기화되었습니다.");
        return newMarketData;

    } catch (error) {
        console.error("Market data fetch error:", error);
        showToast("데이터를 불러오지 못했습니다. 이전 데이터를 표시합니다.", true);
        if (cachedDataStr) return JSON.parse(cachedDataStr);
        return null;
    }
}

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

    // 최종 동기화 시간을 JSON 기반으로 표시
    const timeLabel = document.getElementById("last-sync-time");
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
    if (briefEl && comm.brief) {
        briefEl.textContent = comm.brief;
    }

    // 2. Topics 업데이트
    const topicsContainer = document.getElementById('ai-topics');
    if (topicsContainer && comm.topics && Array.isArray(comm.topics)) {
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

// 초기 로딩 시 진입점
document.addEventListener("DOMContentLoaded", async () => {
    const btnRefresh = document.getElementById("refresh-btn");
    if (btnRefresh) btnRefresh.addEventListener("click", handleRefreshClick);

    const data = await fetchMarketData(false);
    if (data) {
        updateDOMWithData(data);
        updateCommentaryWithData(data);
        // 차트 초기화 완료 후 업데이트 (requestAnimationFrame으로 렌더 완료 대기)
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                updateChartsWithData(data);
            });
        });
    }
});
