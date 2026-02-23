const fs = require('fs');
const path = require('path');

const TICKERS = ['^GSPC', '^IXIC', '^DJI', '^VIX', '^RUT'];

async function fetchMarketData() {
    const newMarketData = {
        lastUpdated: new Date().toISOString(),
        indices: {}
    };

    try {
        console.log("Fetching live market data from Yahoo Finance...");

        const fetchPromises = TICKERS.map(async (symbol) => {
            try {
                // Using Node's built-in fetch (Node 18+)
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
                    changeObj.price = price.toLocaleString(undefined, { maximumFractionDigits: isVix ? 2 : 0, minimumFractionDigits: isVix ? 2 : 0 });
                    changeObj.changePercent = (diff >= 0 ? "+" : "") + pctDiff.toFixed(2);

                    if (isVix) {
                        changeObj.changeText = diff >= 0 ? "⚠ 경계" : "안정";
                        changeObj.status = diff >= 0 ? "warn" : "down";
                    } else {
                        changeObj.changeText = (diff >= 0 ? "▲ " : "▼ ") + Math.abs(pctDiff).toFixed(2) + "%";
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
