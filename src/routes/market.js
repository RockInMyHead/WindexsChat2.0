import { Router } from "express";
import { MarketService } from "../services/MarketService.js";

export const marketRouter = Router();

// GET /api/market/quote?vs=usd,eur,rub
marketRouter.get("/quote", async (req, res) => {
  try {
    const vs = String(req.query.vs ?? "usd,eur,rub").split(",").map(s => s.trim()).filter(Boolean);
    const out = await MarketService.getBtcQuote({ vs, includeMeta: true });
    res.json(out);
  } catch (e) {
    console.error('Market quote error:', e);
    res.status(502).json({ error: "MARKET_PROVIDER_ERROR", message: e.message });
  }
});

// GET /api/market/chart?vs=usd&days=1
marketRouter.get("/chart", async (req, res) => {
  try {
    const vs = String(req.query.vs ?? "usd");
    const days = Number(req.query.days ?? 1);
    const out = await MarketService.getBtcChart({
      vs,
      days: Number.isFinite(days) ? Math.max(1, Math.min(365, days)) : 1 // Ограничиваем 1-365 дней
    });
    res.json(out);
  } catch (e) {
    console.error('Market chart error:', e);
    res.status(502).json({ error: "MARKET_PROVIDER_ERROR", message: e.message });
  }
});

// GET /api/market/cache-stats - для отладки кэша (опционально)
marketRouter.get("/cache-stats", (req, res) => {
  const stats = MarketService.getCacheStats();
  res.json({ cache: stats, cacheSize: stats.length });
});