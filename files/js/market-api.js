/**
 * US Market Dashboard - Real-time API Fetcher
 * Version: 2.0.0
 * Feature: realtime-api + dynamic-charts
 */

const CACHE_KEY_DATA = "us_market_data_v4";
const CACHE_KEY_TIME = "us_market_last_sync_v4";

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
    const today8AM = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0);
    if (now >= today8AM && syncDate < today8AM) return true;
    return false;
}

/**
 * 데이터를 JSON 파일로부터 가져온다.
 * Stale-While-Revalidate 전략: 캐시가 있으면 즉시 반환하고, 백그라운드에서 fetch를 수행한다.
 */
async function fetchMarketData(force = false) {
    const cachedDataStr = localStorage.getItem(CACHE_KEY_DATA);
    const lastSyncStr = localStorage.getItem(CACHE_KEY_TIME);

    // 강제 새로고침(Refresh 버튼)이 아니고 캐시가 있는 경우
    if (!force && cachedDataStr) {
        const cachedData = JSON.parse(cachedDataStr);

        // 캐시가 만료되지 않았으면 그냥 사용
        if (!isCacheExpired(lastSyncStr)) {
            console.log("Using fresh cached data:", new Date(parseInt(lastSyncStr, 10)).toLocaleString());
            return cachedData;
        }

        // 캐시가 만료되었더라도 일단 반환 (Stale)
        // 호출부에서 별도의 비동기 fetch를 수행하도록 설계
        console.log("Using stale cached data (expired)...");
        return cachedData;
    }

    return await performFetch();
}

/**
 * 실제로 서버에서 데이터를 가져오고 캐시를 업데이트한다.
 */
async function performFetch() {
    try {
        console.log("Fetching live market data JSON...");
        const response = await fetch('data/market_data.json');
        if (!response.ok) throw new Error(`Failed to load market data: ${response.statusText}`);

        const newMarketData = await response.json();

        localStorage.setItem(CACHE_KEY_DATA, JSON.stringify(newMarketData));
        localStorage.setItem(CACHE_KEY_TIME, Date.now().toString());

        console.log("Market data synchronized at:", new Date().toLocaleTimeString());
        return newMarketData;

    } catch (error) {
        console.error("Market data fetch error:", error);
        // 폴백 1: 현재 v4 캐시
        const cached = localStorage.getItem(CACHE_KEY_DATA);
        if (cached) {
            console.log("Falling back to localStorage v4 cache");
            return JSON.parse(cached);
        }
        // 폴백 2: 이전 v3 캐시
        const oldCached = localStorage.getItem('us_market_data_v3');
        if (oldCached) {
            console.log("Falling back to localStorage v3 cache");
            return JSON.parse(oldCached);
        }
        showToast("데이터를 불러오지 못했습니다.", true);
        return null;
    }
}

/**
 * 받아온 JSON 데이터를 기반으로 가격/변동 DOM을 업데이트한다.
 */
function updateDOMWithData(data) {
    if (!data || !data.indices) return;

    // 1. Alert Band 업데이트
    const alertMsgEl = document.getElementById("ai-alert-msg");
    if (alertMsgEl && data.alert) {
        alertMsgEl.textContent = data.alert.message || "";
    }

    // 2. 지수 및 상세 지표 업데이트
    const tickers = Object.keys(data.indices);
    tickers.forEach(symbol => {
        const item = data.indices[symbol];

        // 가격(Price) 업데이트
        const priceEls = document.querySelectorAll(
            `.idx-val[data-ticker="${symbol}"], .metric-val[data-ticker="${symbol}"], .fx-val[data-ticker="${symbol}"]`
        );
        priceEls.forEach(priceEl => {
            let prefix = "";
            let suffix = "";
            const currentText = priceEl.textContent;
            if (currentText.includes("$")) prefix = "$";
            if (currentText.includes("%")) suffix = "%";
            priceEl.textContent = prefix + item.price + suffix;
        });

        // 변동(Change/Sub) 업데이트
        const chgEls = document.querySelectorAll(
            `.idx-chg[data-ticker="${symbol}"], .metric-sub[data-ticker="${symbol}"], .fx-chg[data-ticker="${symbol}"]`
        );
        chgEls.forEach(chgEl => {
            chgEl.textContent = item.changeText;
            chgEl.classList.remove('up', 'dn', 'warn', 'neu');
            if (item.status === 'up') chgEl.classList.add('up');
            else if (item.status === 'down') chgEl.classList.add('dn');
            else if (item.status === 'warn') chgEl.classList.add('warn');
            else chgEl.classList.add('neu');
        });

        // 3. 프로그레스 바 업데이트 (지표용)
        if (item.value !== undefined) {
            const progFill = document.querySelector(`.metric-box:has([data-ticker="${symbol}"]) .prog-fill`);
            if (progFill) {
                progFill.style.width = item.value + '%';
                // 상태에 따른 색상 변경
                progFill.style.background = ''; // CSS 기본값 우선
                if (item.status === 'up') progFill.style.background = 'var(--up)';
                else if (item.status === 'down') progFill.style.background = 'var(--dn)';
                else if (item.status === 'warn') progFill.style.background = 'var(--warn)';
            }
        }
    });

    // 최종 동기화 시간 표시
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
    const mainChart = _chartRegistry['mainChart'];
    const gspc = data.history['^GSPC'];
    if (mainChart && gspc) {
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

    // F5와 동일하게 performFetch() 직접 호출 → 항상 서버에서 최신 데이터
    const data = await performFetch();
    if (data) {
        updateDOMWithData(data);
        updateChartsWithData(data);
        updateCommentaryWithData(data);
        showToast("최신 데이터로 업데이트되었습니다.");
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

    // 항상 서버에서 최신 데이터를 한 번만 가져와서 렌더링
    // F5와 Refresh 버튼이 항상 동일한 데이터를 보여주도록 서버 직접 fetch
    const data = await performFetch();
    if (data) {
        updateDOMWithData(data);
        updateCommentaryWithData(data);
        // 차트 렌더 대기 후 업데이트
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                updateChartsWithData(data);
            });
        });
    }
});
