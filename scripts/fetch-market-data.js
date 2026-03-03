const fs = require('fs');
const path = require('path');

const SECTOR_TICKERS = {
    'Energy': 'XLE',
    'Utilities': 'XLU',
    'Health Care': 'XLV',
    'Financials': 'XLF',
    'Materials': 'XLB',
    'Industrials': 'XLI',
    'Real Estate': 'XLRE',
    'Consumer Staples': 'XLP',
    'Consumer Discretionary': 'XLY',
    'Communication': 'VOX',
    'Technology': 'XLK'
};

const YIELD_TICKERS = ['^IRX', '^FVX', '^TNX', '^TYX']; // 13W, 5Y, 10Y, 30Y
const MAG7_TICKERS = ['AAPL', 'NVDA', 'META', 'MSFT', 'AMZN', 'GOOGL', 'TSLA'];

const TICKERS = [
    '^GSPC', '^IXIC', '^DJI', '^VIX', '^RUT', // Indices
    'CL=F', 'BZ=F', 'GC=F', 'SI=F', // Commodities
    'BTC-USD', 'ETH-USD', // Crypto
    'KRW=X', 'DX-Y.NYB', 'EURUSD=X', 'JPY=X', 'GBPUSD=X', // FX
    '^TNX', '^TYX', '^FVX', '^IRX', // Yields
    ...MAG7_TICKERS, // Mag 7
    'AMD', 'AVGO', 'PLTR', 'TSM', 'ARM', // AI Watchlist
    'COIN', 'MSTR', 'SMCI', // Top Movers
    ...Object.values(SECTOR_TICKERS) // Sectors
];

// Tickers that need historical chart data (main chart + sparklines)
const HISTORY_TICKERS = ['^GSPC', '^IXIC', '^DJI', '^VIX', '^RUT', 'BTC-USD', ...MAG7_TICKERS];

async function fetchMarketData() {
    const newMarketData = {
        lastUpdated: new Date().toISOString(),
        indices: {},
        history: {}, // 10-day OHLC history for chart tickers
        sectors: {}, // Sector ETF daily performance
        yields: {},  // Yield curve data (3M, 5Y, 10Y, 30Y)
        macros: {}, // Macro indicators: RSI, CPI, Unemployment, FedRate, PCE
        commentary: {
            brief: "AI 브리핑 생성 중입니다. 잠시 후 새로고침 해주세요.",
            topics: [],
            events: []
        }
    };

    try {
        console.log("Fetching live market data from Yahoo Finance...");

        // --- Fetch latest snapshot for all tickers ---
        const fetchPromises = TICKERS.map(async (symbol) => {
            try {
                const response = await fetch(`https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d`);
                if (!response.ok) throw new Error("API response not ok for " + symbol);
                const result = await response.json();

                const meta = result.chart.result[0].meta;
                const price = meta.regularMarketPrice;
                const prevClose = meta.previousClose || meta.chartPreviousClose;

                const changeObj = { price: "0.00", changeText: "", changePercent: "0.00", status: "neu" };

                if (price && prevClose) {
                    const diff = price - prevClose;
                    const pctDiff = (diff / prevClose) * 100;

                    const isVix = symbol === '^VIX';
                    const isYield = ['^TNX', '^TYX', '^FVX', '^IRX'].includes(symbol);
                    const isCrypto = symbol.includes('-USD');
                    const isFX = symbol.includes('=X') || symbol === 'DX-Y.NYB';

                    let decimals = 2;
                    if (isVix || isYield || isFX) decimals = 2;
                    if (isCrypto && price < 10) decimals = 4;
                    if (symbol === 'KRW=X') decimals = 1;

                    changeObj.price = price.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
                    changeObj.changePercent = (diff >= 0 ? "+" : "") + pctDiff.toFixed(2);

                    if (isVix) {
                        changeObj.changeText = diff >= 0 ? "⚠ 경계" : "안정";
                        changeObj.status = diff >= 0 ? "warn" : "down";
                    } else if (isYield) {
                        changeObj.changeText = (diff >= 0 ? "▲ " : "▼ ") + Math.abs(diff * 100).toFixed(1) + "bp";
                        changeObj.status = diff >= 0 ? "warn" : "down";
                    } else {
                        changeObj.changeText = (diff >= 0 ? "▲ " : "▼ ") + Math.abs(pctDiff).toFixed(1) + "%";
                        changeObj.status = diff >= 0 ? "up" : "down";
                    }
                }

                return { symbol, data: changeObj };
            } catch (err) {
                console.warn("Failed to fetch " + symbol, err.message);
                return null;
            }
        });

        const results = await Promise.all(fetchPromises);
        let successCount = 0;

        results.forEach(res => {
            if (res) {
                newMarketData.indices[res.symbol] = res.data;
                successCount++;
            }
        });

        if (successCount === 0) {
            throw new Error("All API requests failed");
        }

        // --- Populate sectors and yields from indices ---
        Object.entries(SECTOR_TICKERS).forEach(([name, ticker]) => {
            if (newMarketData.indices[ticker]) {
                newMarketData.sectors[name] = newMarketData.indices[ticker];
            }
        });

        YIELD_TICKERS.forEach(ticker => {
            if (newMarketData.indices[ticker]) {
                newMarketData.yields[ticker] = newMarketData.indices[ticker];
            }
        });

        // --- Fetch 10-day history for chart tickers ---
        console.log("Fetching 10-day history for chart tickers...");
        const historyPromises = HISTORY_TICKERS.map(async (symbol) => {
            try {
                // 1mo range with 1d interval gives ~22 trading days (enough for ~10 data points)
                const response = await fetch(`https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1mo`);
                if (!response.ok) throw new Error("History API response not ok for " + symbol);
                const result = await response.json();

                const chartResult = result.chart.result[0];
                const timestamps = chartResult.timestamp;
                const closes = chartResult.indicators.quote[0].close;

                // Build label/value pairs, filter out null closes, take last 10
                const points = [];
                for (let i = 0; i < timestamps.length; i++) {
                    if (closes[i] !== null && closes[i] !== undefined) {
                        const d = new Date(timestamps[i] * 1000);
                        const label = `${d.getMonth() + 1}/${d.getDate()}`;
                        points.push({ label, close: parseFloat(closes[i].toFixed(2)) });
                    }
                }
                const last10 = points.slice(-10);
                const firstClose = points.length > 0 ? points[0].close : null;

                return {
                    symbol,
                    labels: last10.map(p => p.label),
                    values: last10.map(p => p.close),
                    firstClose
                };
            } catch (err) {
                console.warn("Failed to fetch history for " + symbol, err.message);
                return null;
            }
        });

        const histResults = await Promise.all(historyPromises);

        // 1개월 변동률 계산을 위해 저장소 추가
        const oneMonthChanges = {};

        histResults.forEach(res => {
            if (res) {
                newMarketData.history[res.symbol] = {
                    labels: res.labels,
                    values: res.values
                };
                // Calculate 1-month return based on the oldest vs newest close in the 1mo data
                if (res.values.length > 0 && res.firstClose) {
                    const firstClose = res.firstClose;
                    const lastClose = res.values[res.values.length - 1];
                    const change = ((lastClose - firstClose) / firstClose * 100).toFixed(2);
                    oneMonthChanges[res.symbol] = change;
                }
            }
        });

        // --- Fetch Latest News Headlines ---
        console.log("Fetching latest news headlines...");
        let marketNews = [];
        let cryptoNews = [];
        try {
            const spyNewsReq = await fetch('https://query2.finance.yahoo.com/v1/finance/search?q=SPY&newsCount=5');
            const spyNewsRes = await spyNewsReq.json();
            marketNews = spyNewsRes.news.slice(0, 5).map(n => n.title);

            const btcNewsReq = await fetch('https://query2.finance.yahoo.com/v1/finance/search?q=BTC-USD&newsCount=3');
            const btcNewsRes = await btcNewsReq.json();
            cryptoNews = btcNewsRes.news.slice(0, 3).map(n => n.title);
        } catch (err) {
            console.warn("Failed to fetch news:", err.message);
        }

        // --- Calculate RSI(14) from S&P 500 History ---
        try {
            const spxHistory = newMarketData.history['^GSPC'];
            if (spxHistory && spxHistory.values.length >= 15) {
                const prices = spxHistory.values;
                const gains = [], losses = [];
                for (let i = 1; i < prices.length; i++) {
                    const diff = prices[i] - prices[i - 1];
                    gains.push(diff > 0 ? diff : 0);
                    losses.push(diff < 0 ? Math.abs(diff) : 0);
                }
                const period = 14;
                const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
                const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;
                const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
                const rsi = parseFloat((100 - 100 / (1 + rs)).toFixed(1));
                let rsiLabel = '중립권';
                if (rsi >= 70) rsiLabel = '과매수 ⚠';
                else if (rsi >= 60) rsiLabel = '강세권';
                else if (rsi <= 30) rsiLabel = '과매도 ✓';
                else if (rsi <= 40) rsiLabel = '약세권';
                newMarketData.macros.rsi = { value: rsi, label: rsiLabel };
                console.log(`RSI(14) calculated: ${rsi}`);
            }
        } catch (err) {
            console.warn('Failed to calculate RSI:', err.message);
        }

        // --- Fetch FRED Macro Indicators ---
        console.log('Fetching FRED macro indicators...');
        const FRED_BASE = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=';
        async function fetchFredLatest(seriesId) {
            const res = await fetch(`${FRED_BASE}${seriesId}`);
            const text = await res.text();
            const lines = text.trim().split('\n').filter(l => !l.startsWith('DATE'));
            const last = lines[lines.length - 1].split(',');
            return { date: last[0], value: parseFloat(last[1]) };
        }
        try {
            const [cpiRes, unempRes, fedRateRes, pceRes] = await Promise.all([
                fetchFredLatest('CPIAUCSL'),  // CPI All Urban (monthly)
                fetchFredLatest('UNRATE'),    // Unemployment Rate
                fetchFredLatest('FEDFUNDS'),  // Federal Funds Rate
                fetchFredLatest('PCEPILFE'),  // Core PCE Price Index
            ]);

            // CPI YoY: need 12 months ago value
            const cpiRawRes = await fetch(`${FRED_BASE}CPIAUCSL`);
            const cpiRawText = await cpiRawRes.text();
            const cpiLines = cpiRawText.trim().split('\n').filter(l => !l.startsWith('DATE'));
            const cpiLatest = parseFloat(cpiLines[cpiLines.length - 1].split(',')[1]);
            const cpi12mAgo = parseFloat(cpiLines[Math.max(0, cpiLines.length - 13)].split(',')[1]);
            const cpiYoY = parseFloat(((cpiLatest - cpi12mAgo) / cpi12mAgo * 100).toFixed(1));

            // PCE YoY
            const pceRawRes = await fetch(`${FRED_BASE}PCEPILFE`);
            const pceRawText = await pceRawRes.text();
            const pceLines = pceRawText.trim().split('\n').filter(l => !l.startsWith('DATE'));
            const pceLatest = parseFloat(pceLines[pceLines.length - 1].split(',')[1]);
            const pce12mAgo = parseFloat(pceLines[Math.max(0, pceLines.length - 13)].split(',')[1]);
            const pceYoY = parseFloat(((pceLatest - pce12mAgo) / pce12mAgo * 100).toFixed(1));

            // Date formatting (YYYY-MM → M월)
            const cpiDateParts = cpiRes.date.split('-');
            const cpiMonth = `${parseInt(cpiDateParts[1])}월 기준`;

            newMarketData.macros.cpi = {
                value: cpiYoY,
                label: cpiMonth,
                status: cpiYoY < 2.5 ? 'up' : cpiYoY < 3.5 ? 'warn' : 'dn'
            };
            newMarketData.macros.unemployment = {
                value: unempRes.value,
                label: `${parseInt(unempRes.date.split('-')[1])}월 기준`,
                status: unempRes.value < 4.5 ? 'up' : unempRes.value < 6 ? 'warn' : 'dn'
            };
            newMarketData.macros.fedRate = {
                value: fedRateRes.value,
                label: '현재 기준금리',
                status: 'neu'
            };
            newMarketData.macros.pce = {
                value: pceYoY,
                label: `${parseInt(pceRawText.trim().split('\n').filter(l => !l.startsWith('DATE')).pop().split(',')[0].split('-')[1])}월 기준`,
                status: pceYoY < 2.5 ? 'up' : pceYoY < 3.5 ? 'warn' : 'dn'
            };
            console.log(`FRED: CPI=${cpiYoY}%, Unemp=${unempRes.value}%, FedRate=${fedRateRes.value}%, PCE=${pceYoY}%`);
        } catch (err) {
            console.warn('Failed to fetch FRED data:', err.message);
        }

        // --- Generate AI Commentary ---
        console.log("Generating AI Commentary using Gemini...");
        try {
            if (!process.env.GEMINI_API_KEY) {
                console.warn("GEMINI_API_KEY is not set. Skipping AI commentary generation.");
            } else {
                const { GoogleGenAI } = await import('@google/genai');
                const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

                const spx = newMarketData.indices['^GSPC'];
                const ndx = newMarketData.indices['^IXIC'];
                const dji = newMarketData.indices['^DJI'];
                const vix = newMarketData.indices['^VIX'];
                const btc = newMarketData.indices['BTC-USD'];

                // 날짜 포맷 (한국 시간 기준)
                const today = new Date();
                const dateStr = today.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

                const prompt = `
You are an expert financial analyst. Today's date is ${dateStr}.

IMPORTANT: Use your Google Search grounding to look up the LATEST US market news from TODAY before answering. Prioritize real, specific news events over generic market commentary.

Market data at today's close:
- S&P 500: ${spx?.price || 'N/A'} (Daily: ${spx?.changePercent || 'N/A'}%, 1-Month: ${oneMonthChanges['^GSPC'] || 'N/A'}%)
- NASDAQ: ${ndx?.price || 'N/A'} (Daily: ${ndx?.changePercent || 'N/A'}%, 1-Month: ${oneMonthChanges['^IXIC'] || 'N/A'}%)
- Dow Jones: ${dji?.price || 'N/A'} (Daily: ${dji?.changePercent || 'N/A'}%, 1-Month: ${oneMonthChanges['^DJI'] || 'N/A'}%)
- VIX: ${vix?.price || 'N/A'} (Daily: ${vix?.changePercent || 'N/A'}%, 1-Month: ${oneMonthChanges['^VIX'] || 'N/A'}%)
- Bitcoin: ${btc?.price || 'N/A'} (Daily: ${btc?.changePercent || 'N/A'}%, 1-Month: ${oneMonthChanges['BTC-USD'] || 'N/A'}%)

Search for and reference TODAY's specific news events such as:
- Federal Reserve statements or policy signals
- Major earnings releases (beats/misses)
- Tariff/trade policy announcements
- Economic data releases (CPI, PCE, jobs, GDP)
- Geopolitical events affecting markets
- Major stock moves and their reasons

RULES:
1. Each "topics" item MUST be grounded in a REAL news event from today or this week. Name the specific event, company, or policy.
2. Do NOT use vague descriptions like "시장 변동성" without citing the actual cause.
3. 1-month trend takes precedence over daily move for overall market assessment.
4. "events" must list ONLY upcoming economic events from ${dateStr} onward this week.

Output ONLY a valid JSON object (no markdown code fences, no extra text):
{
  "brief": "2-3 sentence summary citing specific news drivers.",
  "topics": [
    { "title": "Specific topic title", "description": "2-3 sentences with specific facts and figures." },
    { "title": "Topic 2", "description": "..." },
    { "title": "Topic 3", "description": "..." },
    { "title": "Topic 4", "description": "..." }
  ],
  "events": [
    { "date": "3. 4. (화)", "description": "Specific event name" }
  ]
}

Write in Korean. Be specific, factual, and reference actual news events.
`;

                const response = await ai.models.generateContent({
                    model: 'gemini-2.0-flash',
                    contents: prompt,
                    config: {
                        tools: [{ googleSearch: {} }],
                    }
                });

                const rawText = response.text;
                // Extract JSON from response (may be wrapped in markdown code fences)
                const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/) || rawText.match(/({[\s\S]*})/);
                const jsonStr = jsonMatch ? jsonMatch[1] : rawText;
                const commentaryJson = JSON.parse(jsonStr.trim());
                newMarketData.commentary = commentaryJson;
                console.log("Successfully generated AI Commentary with Google Search Grounding.");
            }
        } catch (e) {
            console.error("Failed to generate AI commentary:", e.message);
        }

        const outputPath = path.join(__dirname, '../files/data/market_data.json');

        // Ensure data directory exists
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(outputPath, JSON.stringify(newMarketData, null, 2));
        console.log("Market data successfully written to", outputPath);

    } catch (error) {
        console.error("Fatal error fetching market data:", error);
        process.exit(1);
    }
}

fetchMarketData();
