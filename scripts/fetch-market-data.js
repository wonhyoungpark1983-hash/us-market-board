const fs = require('fs');
const path = require('path');

const TICKERS = [
    '^GSPC', '^IXIC', '^DJI', '^VIX', '^RUT', // Indices
    'CL=F', 'BZ=F', 'GC=F', 'SI=F', // Commodities
    'BTC-USD', 'ETH-USD', // Crypto
    'KRW=X', 'DX-Y.NYB', 'EURUSD=X', 'JPY=X', 'GBPUSD=X', // FX
    '^TNX', '^TYX', '^FVX', '^IRX' // Yields
];

// Tickers that need historical chart data (main chart + sparklines)
const HISTORY_TICKERS = ['^GSPC', '^IXIC', '^DJI', '^VIX', '^RUT'];

async function fetchMarketData() {
    const newMarketData = {
        lastUpdated: new Date().toISOString(),
        indices: {},
        history: {} // New: 10-day OHLC history for chart tickers
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

                return {
                    symbol,
                    labels: last10.map(p => p.label),
                    values: last10.map(p => p.close)
                };
            } catch (err) {
                console.warn("Failed to fetch history for " + symbol, err.message);
                return null;
            }
        });

        const histResults = await Promise.all(historyPromises);
        histResults.forEach(res => {
            if (res) {
                newMarketData.history[res.symbol] = {
                    labels: res.labels,
                    values: res.values
                };
            }
        });

        // --- Generate AI Commentary ---
        console.log("Generating AI Commentary using Gemini...");
        try {
            if (!process.env.GEMINI_API_KEY) {
                console.warn("GEMINI_API_KEY is not set. Skipping AI commentary generation.");
            } else {
                const { GoogleGenAI } = require('@google/genai');
                const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

                const spx = newMarketData.indices['^GSPC'];
                const ndx = newMarketData.indices['^IXIC'];
                const dji = newMarketData.indices['^DJI'];
                const vix = newMarketData.indices['^VIX'];
                const btc = newMarketData.indices['BTC-USD'];

                const prompt = `
You are an expert financial analyst. Based on the following US market data at the close:
S&P 500: ${spx?.price || 'N/A'} (${spx?.changePercent || 'N/A'}%)
NASDAQ: ${ndx?.price || 'N/A'} (${ndx?.changePercent || 'N/A'}%)
Dow Jones: ${dji?.price || 'N/A'} (${dji?.changePercent || 'N/A'}%)
VIX: ${vix?.price || 'N/A'} (${vix?.changePercent || 'N/A'}%)
Bitcoin: ${btc?.price || 'N/A'} (${btc?.changePercent || 'N/A'}%)

Write a daily US market commentary based on today's significant market events. Output strictly in JSON format with the following schema, and do not include markdown \`\`\`json block wrappers.
{
  "brief": "A 1-2 sentence overall summary of the market today.",
  "topics": [
    { "title": "Topic 1 (e.g. Fed Policy)", "description": "1-2 sentence explanation." },
    { "title": "Topic 2", "description": "..." },
    { "title": "Topic 3", "description": "..." },
    { "title": "Topic 4", "description": "..." }
  ],
  "events": [
    { "date": "e.g. 2. 26. (목)", "description": "Event 1" },
    { "date": "e.g. 2. 27. (금)", "description": "Event 2" }
  ]
}

Ensure the tone is professional, objective, and written in Korean. Look up the most recent major news for the US market (e.g. CPI, Fed speeches, earnings, geopolitical events) to enrich the topics and upcoming events.
`;

                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: prompt,
                    config: {
                        responseMimeType: "application/json",
                    }
                });

                const commentaryJson = JSON.parse(response.text);
                newMarketData.commentary = commentaryJson;
                console.log("Successfully generated AI Commentary.");
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
