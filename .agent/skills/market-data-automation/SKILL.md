---
name: market-data-automation
description: "Guidance for automating static market data fetching and client-side dynamic binding, specifically via GitHub Actions and localStorage caching."
---

# Market Data Automation Skill

This skill provides a battle-tested architecture and best practices for creating a "Static Server-Side Polling" data pipeline. This approach is highly recommended for dashboards and public display boards where hitting a live API from the client side is inefficient, prone to CORS issues, or rate-limited.

## 🎯 Core Principles

1.  **Architecture**: **NEVER fetch live 3rd-party APIs directly from the client frontend.**
    *   Instead, use a backend script (e.g., Node.js run via GitHub Actions) to fetch the live data periodically or at the end of the day.
    *   Save this fetched data as a static JSON file (e.g., `market_data.json`) and commit it to the repository.
    *   The frontend client ONLY fetches this static JSON file. This guarantees 100% uptime, zero CORS issues, and fast load times.

2.  **Smart DOM Binding (Non-Destructive)**:
    *   Separate the data identification from styling by using `data-ticker` attributes in HTML (e.g., `<div class="val" data-ticker="BTC"></div>`).
    *   When mutating the DOM with JavaScript, **DO NOT overwrite the entire text content blindly**.
    *   Always check for and preserve existing formatting strings like currency symbols (`$`, `₩`) or percentage signs (`%`, `bp`).
    *   *Example Implementation:*
        ```javascript
        const currentText = el.textContent;
        let prefix = currentText.includes("$") ? "$" : "";
        let suffix = currentText.includes("%") ? "%" : "";
        el.textContent = prefix + newNumber + suffix;
        ```

3.  **Client-Side Caching & Invalidation (Crucial)**:
    *   Use `localStorage` to cache the JSON data and a timestamp on the client to avoid over-fetching the static file.
    *   **Invalidation Logic**: If the data structure changes (e.g., adding 10 new tickers), users with old caches will experience broken UI or missing data.
    *   **Actionable Rule**: Whenever you change the schema of the fetched data or the identifiers, you **MUST roll the cache key version** in the frontend script (e.g., change `CACHE_KEY_DATA = "data_v1"` to `"data_v2"`).

## 📂 Implementation Templates

When requested to implement this pattern, follow the structural blueprints provided in the `templates/` directory of this skill.

1.  `fetch-script.js.template`: Standard Node.js script using `fetch` (Node 18+) to gather data, format it centrally, and write to a JSON file.
2.  `workflow.yml.template`: Standard GitHub Actions YAML to run the fetch script daily (cron) and automatically commit the result.
3.  `frontend-api.js.template`: Standard vanilla JS file handling the initial load, caching, and smart DOM binding based on the `data-ticker` paradigm.

## 🚀 Triggers
Apply this skill when the user mentions:
- "market data automation"
- "github actions data fetch"
- "정적 데이터 자동화"
- "대시보드 실시간 연동"
- "캐시 무효화"
- "데이터 바인딩"
