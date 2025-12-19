import { fetch } from "undici";

const cache = new Map();

/** cacheKey -> { expiresAt:number, value:any } */
function getCache(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

// Автоматическая очистка кэша каждые 5 минут
setInterval(() => {
  MarketService.cleanupExpiredCache();
}, 5 * 60 * 1000);

function setCache(key, value, ttlMs) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

export class MarketService {
  static async getBtcQuote({ vs = ["usd"], includeMeta = true } = {}) {
    const vsCurrencies = vs.map(v => v.toLowerCase()).join(",");
    const cacheKey = `btc:quote:${vsCurrencies}:${includeMeta ? "1" : "0"}`;
    const cached = getCache(cacheKey);

    // Если есть свежий кэш, возвращаем его
    if (cached) return { ...cached, cached: true };

    // При rate limiting пытаемся вернуть устаревший кэш
    if (cache.has(cacheKey)) {
      const staleHit = cache.get(cacheKey);
      if (staleHit && Date.now() - staleHit.expiresAt < 300_000) { // До 5 минут устаревшие данные
        console.log('⚠️ Returning stale market data due to rate limiting');
        return { ...staleHit.value, cached: true, stale: true };
      }
    }

    const url = new URL(`${COINGECKO_BASE}/simple/price`);
    url.searchParams.set("ids", "bitcoin");
    url.searchParams.set("vs_currencies", vsCurrencies);
    if (includeMeta) {
      url.searchParams.set("include_24hr_change", "true");
      url.searchParams.set("include_market_cap", "true");
      url.searchParams.set("include_24hr_vol", "true");
      url.searchParams.set("include_last_updated_at", "true");
    }

    console.log('🌐 Fetching BTC quote from CoinGecko...');
    const res = await fetch(url, {
      headers: { "accept": "application/json", "user-agent": "windexsai/1.0" },
    });

    if (!res.ok) {
      if (res.status === 429) {
        console.warn('⚠️ CoinGecko rate limit exceeded, using fallback data');
        // Возвращаем mock данные при rate limiting
        const mockData = {
          symbol: "BTC",
          provider: "coingecko-fallback",
          asOf: Date.now(),
          quote: {
            usd: 85000,
            usd_24h_change: 0.5,
            usd_market_cap: 1680000000000,
            usd_24h_vol: 52000000000,
            last_updated_at: Math.floor(Date.now() / 1000)
          },
          cached: false,
          rateLimited: true
        };

        // Кэшируем fallback данные на короткое время
        setCache(cacheKey, mockData, 30_000);
        return mockData;
      }
      throw new Error(`Quote provider error: ${res.status}`);
    }

    const data = await res.json();
    console.log('✅ BTC quote fetched successfully');

    const payload = {
      symbol: "BTC",
      provider: "coingecko",
      asOf: data.bitcoin?.last_updated_at ? data.bitcoin.last_updated_at * 1000 : Date.now(),
      quote: data.bitcoin,
      cached: false,
    };

    // TTL 60 сек (увеличено для предотвращения rate limiting)
    setCache(cacheKey, payload, 60_000);
    return payload;
  }

  static async getBtcChart({ vs = "usd", days = 1 } = {}) {
    const vsCur = vs.toLowerCase();
    const cacheKey = `btc:chart:${vsCur}:${days}`;
    const cached = getCache(cacheKey);
    if (cached) return { ...cached, cached: true };

    // При rate limiting пытаемся вернуть устаревший кэш
    if (cache.has(cacheKey)) {
      const staleHit = cache.get(cacheKey);
      if (staleHit && Date.now() - staleHit.expiresAt < 600_000) { // До 10 минут устаревшие данные для графиков
        console.log('⚠️ Returning stale chart data due to rate limiting');
        return { ...staleHit.value, cached: true, stale: true };
      }
    }

    const url = new URL(`${COINGECKO_BASE}/coins/bitcoin/market_chart`);
    url.searchParams.set("vs_currency", vsCur);
    url.searchParams.set("days", String(days));
    // interval=minutely поддерживается не всегда; можно опустить
    // url.searchParams.set("interval", "minutely");

    console.log(`🌐 Fetching BTC chart (${days} days) from CoinGecko...`);
    const res = await fetch(url, {
      headers: { "accept": "application/json", "user-agent": "windexsai/1.0" },
    });

    if (!res.ok) {
      if (res.status === 429) {
        console.warn('⚠️ CoinGecko rate limit exceeded for chart, using fallback data');
        // Возвращаем mock данные при rate limiting
        const now = Date.now();
        const mockSeries = [];
        for (let i = days * 24; i >= 0; i--) {
          const timestamp = now - (i * 60 * 60 * 1000);
          const basePrice = 85000;
          const variation = (Math.sin(i / 24) * 2000) + (Math.random() - 0.5) * 1000;
          mockSeries.push([timestamp, basePrice + variation]);
        }

        const mockData = {
          symbol: "BTC",
          provider: "coingecko-fallback",
          asOf: Date.now(),
          vs: vsCur,
          series: mockSeries,
          cached: false,
          rateLimited: true
        };

        // Кэшируем fallback данные на короткое время
        setCache(cacheKey, mockData, 120_000);
        return mockData;
      }
      throw new Error(`Chart provider error: ${res.status}`);
    }

    const data = await res.json();
    console.log('✅ BTC chart fetched successfully');

    // data.prices: [ [ts, price], ... ]
    const payload = {
      symbol: "BTC",
      provider: "coingecko",
      asOf: Date.now(),
      vs: vsCur,
      series: data.prices ?? [],
      cached: false,
    };

    // TTL 300 сек (5 минут) для графиков
    setCache(cacheKey, payload, 300_000);
    return payload;
  }

  // Метод для получения последнего кэша даже если он просрочен
  static getStaleBtcQuote(cacheKey) {
    const hit = cache.get(cacheKey);
    if (!hit) return null;
    return { ...hit.value, cached: true, stale: Date.now() > hit.expiresAt };
  }

  // Метод для получения всех активных кэш-ключей (для отладки)
  static getCacheStats() {
    const stats = {};
    const now = Date.now();
    for (const [key, value] of cache.entries()) {
      const isExpired = now > value.expiresAt;
      const ttl = Math.max(0, value.expiresAt - now);
      stats[key] = {
        expiresAt: value.expiresAt,
        expired: isExpired,
        ttl: ttl,
        ttlMinutes: Math.round(ttl / 60000 * 10) / 10
      };
    }
    return {
      cacheSize: cache.size,
      stats: stats,
      timestamp: now
    };
  }

  // Метод для очистки устаревшего кэша
  static cleanupExpiredCache() {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, value] of cache.entries()) {
      if (now > value.expiresAt) {
        cache.delete(key);
        cleaned++;
      }
    }
    console.log(`🧹 Cleaned ${cleaned} expired cache entries`);
    return cleaned;
  }
}