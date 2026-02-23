/**
 * US Market Dashboard - Real-time API Fetcher
 * Version: 1.0.0
 * Feature: realtime-api
 */

const API_KEY = "demo"; // For public/free APIs or proxy configuration
const CACHE_KEY_DATA = "us_market_data_v2";
const CACHE_KEY_TIME = "us_market_last_sync_v2";

/**
 * 캐시 만료 체크 로직:
 * 매일 아침 8시를 기점으로 캐시를 만료시킨다.
 * 1. 현재 시간이 아침 8시 이전이면 -> 통과 (어제 데이터도 OK)
 * 2. 현재 시간이 아침 8시 이후인데 최근 동기화 시점이 오늘 8시 이전이면 -> 만료
 */
function isCacheExpired(lastSyncTime) {
    if (!lastSyncTime) return true;

    const syncDate = new Date(parseInt(lastSyncTime, 10));
    const now = new Date();

    // 오늘 오전 8시 객체 생성
    const today8AM = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0);

    // 현재 시간이 8시 이후이고, 캐시 시간이 8시 이전인 경우 만료
    if (now >= today8AM && syncDate < today8AM) {
        return true;
    }

    return false;
}

/**
 * 데이터를 API로부터 가져온다 (Fallback 처리 포장)
 */
async function fetchMarketData(force = false) {
    const cachedDataStr = localStorage.getItem(CACHE_KEY_DATA);
    const lastSyncStr = localStorage.getItem(CACHE_KEY_TIME);

    // 명시적 갱신(force)이 아니면서 캐시가 유효하다면 캐시 반환
    if (!force && cachedDataStr && !isCacheExpired(lastSyncStr)) {
        console.log("Using cached market data:", new Date(parseInt(lastSyncStr, 10)).toLocaleString());
        return JSON.parse(cachedDataStr);
    }

    try {
        console.log("Fetching static market data JSON...");

        // Fetch from local GitHub representation
        // Note: For actual deployment, you might need an absolute path or accurate relative path
        // depending on the project setup. Using a relative path for simplicity.
        const response = await fetch('data/market_data.json');

        if (!response.ok) {
            throw new Error(`Failed to load static market data: ${response.statusText}`);
        }

        const newMarketData = await response.json();

        // 로컬스토리지 갱신
        localStorage.setItem(CACHE_KEY_DATA, JSON.stringify(newMarketData));
        localStorage.setItem(CACHE_KEY_TIME, Date.now().toString());

        showToast("최신 정보가 동기화되었습니다.");
        return newMarketData;

    } catch (error) {
        console.error("Market data fetch error:", error);
        showToast("데이터를 불러오지 못했습니다. 이전 데이터를 표시합니다.", true);

        // 실패 시 로컬 스토리지에 데이터가 있으면 그거라도 반환
        if (cachedDataStr) {
            return JSON.parse(cachedDataStr);
        }
        return null; // 아예 없으면 널 반환 (HTML 하드코딩 값 유지)
    }
}

/**
 * 받아온 JSON 데이터를 기반으로 DOM을 업데이트한다.
 * HTML 상에 <element data-ticker="^GSPC"> 형태로 식별된 엘리먼트를 찾음.
 */
function updateDOMWithData(data) {
    if (!data || !data.indices) return;

    const tickers = Object.keys(data.indices);
    tickers.forEach(symbol => {
        // 1. 가격 요소 업데이트
        const priceEls = document.querySelectorAll(`.idx-val[data-ticker="${symbol}"], .metric-val[data-ticker="${symbol}"], .fx-val[data-ticker="${symbol}"]`);
        priceEls.forEach(priceEl => {
            let prefix = "";
            let suffix = "";
            const currentText = priceEl.textContent;
            if (currentText.includes("$")) prefix = "$";
            if (currentText.includes("%")) suffix = "%";
            priceEl.textContent = prefix + data.indices[symbol].price + suffix;
        });

        // 2. 등락률 요소 업데이트
        const chgEls = document.querySelectorAll(`.idx-chg[data-ticker="${symbol}"], .metric-sub[data-ticker="${symbol}"], .fx-chg[data-ticker="${symbol}"]`);
        chgEls.forEach(chgEl => {
            chgEl.textContent = data.indices[symbol].changeText;
            chgEl.classList.remove('up', 'dn', 'warn', 'neu'); // 기존 제거
            if (data.indices[symbol].status === 'up') chgEl.classList.add('up');
            if (data.indices[symbol].status === 'down') chgEl.classList.add('dn');
            if (data.indices[symbol].status === 'warn') chgEl.classList.add('warn');
        });
    });

    // 최종 동기화 시간 헤더에 표시
    const timeLabel = document.getElementById("last-sync-time");
    if (timeLabel) {
        const lastSyncStr = localStorage.getItem(CACHE_KEY_TIME);
        if (lastSyncStr) {
            const date = new Date(parseInt(lastSyncStr, 10));
            timeLabel.textContent = `기준: ${date.toLocaleString()}`;
        }
    }
}

/**
 * 수동 Refresh 버튼 핸들러
 */
async function handleRefreshClick() {
    const btn = document.getElementById("refresh-btn");
    if (btn) btn.style.opacity = "0.5"; // 로딩 시각 피드백

    const data = await fetchMarketData(true); // 강제 갱신 트리거
    if (data) updateDOMWithData(data);

    if (btn) btn.style.opacity = "1";
}

/**
 * 화면 구석에 작은 알림창 띄우기 (간이 구현)
 */
function showToast(message, isError = false) {
    const toast = document.createElement("div");
    toast.style.position = "fixed";
    toast.style.bottom = "20px";
    toast.style.right = "20px";
    toast.style.padding = "10px 16px";
    toast.style.background = isError ? "var(--red)" : "var(--blue)";
    toast.style.color = "#fff";
    toast.style.borderRadius = "4px";
    toast.style.fontSize = "12px";
    toast.style.zIndex = "99999";
    toast.style.transition = "opacity 0.5s ease-in-out";
    toast.textContent = message;

    document.body.appendChild(toast);
    setTimeout(() => toast.style.opacity = "0", 2500);
    setTimeout(() => toast.remove(), 3000);
}

// 초기 로딩 시 진입점
document.addEventListener("DOMContentLoaded", async () => {
    // 1. 버튼 클릭 이벤트 연동
    const btnRefresh = document.getElementById("refresh-btn");
    if (btnRefresh) {
        btnRefresh.addEventListener("click", handleRefreshClick);
    }

    // 2. 초기 로드 체크 수행
    const data = await fetchMarketData(false);
    if (data) {
        updateDOMWithData(data);
    }
});
