// backend/src/middlewares/aiQuota.js
import Redis from "ioredis";

const WINDOW_SECONDS = 24 * 60 * 60;

/* ------------------------------------------------------------------ */
/*  PLAN NORMALIZATION (matches YOUR User model)                       */
/* ------------------------------------------------------------------ */
/*
User.subscription enum:
- "Standard"  -> 1 / 24h
- "Plus"      -> 5 / 24h
- "Premium"   -> unlimited
*/
function normalizeSubscription(raw) {
  const v = String(raw || "")
    .toLowerCase()
    .trim();

  if (v === "premium") return "Premium";
  if (v === "plus") return "Plus";
  return "Standard";
}

function tierLimit(subscription) {
  if (subscription === "Premium") return Infinity;
  if (subscription === "Plus") return 5;
  return 1; // Standard
}

/* ------------------------------------------------------------------ */
/*  REDIS (lazy, safe, non-crashing)                                   */
/* ------------------------------------------------------------------ */
let redis = null;
let redisReady = false;
let redisInitTried = false;

function getRedis() {
  if (redisInitTried) return redisReady ? redis : null;
  redisInitTried = true;

  const url = process.env.REDIS_URL;
  if (!url) return null;

  try {
    redis = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      connectTimeout: 3000,
    });

    redis.on("ready", () => {
      redisReady = true;
    });
    redis.on("error", () => {
      redisReady = false;
    });
    redis.on("end", () => {
      redisReady = false;
    });

    redis.connect().catch(() => {
      redisReady = false;
    });

    return redis;
  } catch {
    redis = null;
    redisReady = false;
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  IN-MEMORY FALLBACK (dev / redis-down safety net)                   */
/* ------------------------------------------------------------------ */
/*
Map key: aiq:<userId>
Value: { count, expiresAtMs }
*/
const mem = new Map();

function memIncr(key) {
  const now = Date.now();
  const cur = mem.get(key);

  if (!cur || cur.expiresAtMs <= now) {
    const next = {
      count: 1,
      expiresAtMs: now + WINDOW_SECONDS * 1000,
    };
    mem.set(key, next);
    return { count: 1, ttl: WINDOW_SECONDS };
  }

  cur.count += 1;
  const ttl = Math.max(0, Math.ceil((cur.expiresAtMs - now) / 1000));

  return { count: cur.count, ttl };
}

/* ------------------------------------------------------------------ */
/*  COUNTER                                                            */
/* ------------------------------------------------------------------ */
/*
Spend one unit from a per-user, per-tier, 24h bucket. Each bucket is its own
counter ("aiq" = advisor requests, "aix" = extraction escalations), so one
feature can't eat another's budget.

Usable outside middleware: callers that only learn mid-request whether they
need to spend (e.g. the extraction cascade) call this at the point of spend.
Throws if the counter store errors — each caller picks fail-open or -closed.
*/
export async function consumeQuota(bucket, userId, rawSubscription) {
  // 🔑 authoritative source: User.subscription
  const subscription = normalizeSubscription(rawSubscription);
  const limit = tierLimit(subscription);

  // Premium → unlimited, skip Redis entirely
  if (!Number.isFinite(limit)) {
    return {
      allowed: true,
      subscription,
      limit: Infinity,
      used: 0,
      remaining: Infinity,
      resetInSeconds: 0,
      source: "none",
    };
  }

  const key = `${bucket}:${String(userId)}`;
  let count;
  let ttl;
  let source;

  /* ---------------------- Redis path ---------------------- */
  const r = getRedis();

  if (r && redisReady) {
    const lua = `
      local v = redis.call("INCR", KEYS[1])
      if v == 1 then
        redis.call("EXPIRE", KEYS[1], ARGV[1])
      end
      local ttl = redis.call("TTL", KEYS[1])
      return {v, ttl}
    `;

    const [countRaw, ttlRaw] = await r.eval(lua, 1, key, WINDOW_SECONDS);
    count = Number(countRaw || 0);
    ttl = Math.max(0, Number(ttlRaw || 0));
    source = "redis";
  } else {
    /* ------------------ Memory fallback ------------------ */
    ({ count, ttl } = memIncr(key));
    source = "memory";
  }

  return {
    allowed: count <= limit,
    subscription,
    limit,
    used: count,
    remaining: Math.max(0, limit - count),
    resetInSeconds: ttl,
    source,
  };
}

/* ------------------------------------------------------------------ */
/*  MIDDLEWARE                                                         */
/* ------------------------------------------------------------------ */
export async function aiQuota(req, res, next) {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { allowed, ...quota } = await consumeQuota(
      "aiq",
      userId,
      req.user?.subscription,
    );

    if (!allowed) {
      return res.status(429).json({
        error: "AI quota exceeded",
        subscription: quota.subscription,
        limit: quota.limit,
        remaining: 0,
        resetInSeconds: quota.resetInSeconds,
      });
    }

    req.aiQuota = quota;
    return next();
  } catch (err) {
    // fail-open: AI still works if quota infra explodes
    req.aiQuota = {
      error: String(err?.message || err),
      source: "error",
    };
    return next();
  }
}
