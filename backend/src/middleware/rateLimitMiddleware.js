const ipRequests = new Map();
const emailRequests = new Map();

// Clean up stale timestamps every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  for (const [key, timestamps] of ipRequests.entries()) {
    const valid = timestamps.filter(t => now - t < windowMs);
    if (valid.length === 0) ipRequests.delete(key);
    else ipRequests.set(key, valid);
  }
  for (const [key, timestamps] of emailRequests.entries()) {
    const valid = timestamps.filter(t => now - t < windowMs);
    if (valid.length === 0) emailRequests.delete(key);
    else emailRequests.set(key, valid);
  }
}, 5 * 60 * 1000).unref(); 

export function magicCodeRateLimiter(req, res, next) {
  const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
  const email = (req.body?.email || '').trim().toLowerCase();

  const now = Date.now();
  const windowMs = (parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES, 10) || 15) * 60 * 1000;
  const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 5;

  // 1. Check IP rate limit
  const ipTimestamps = (ipRequests.get(ip) || []).filter(t => now - t < windowMs);
  if (ipTimestamps.length >= maxRequests) {
    return res.status(429).json({
      error: 'Too Many Requests',
      message: `Too many login code requests from this IP. Please try again after ${process.env.RATE_LIMIT_WINDOW_MINUTES || 15} minutes.`,
    });
  }

  // 2. Check Email rate limit
  if (email) {
    const emailTimestamps = (emailRequests.get(email) || []).filter(t => now - t < windowMs);
    if (emailTimestamps.length >= maxRequests) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: `Too many login code requests for this email. Please try again after ${process.env.RATE_LIMIT_WINDOW_MINUTES || 15} minutes.`,
      });
    }

    emailTimestamps.push(now);
    emailRequests.set(email, emailTimestamps);
  }

  ipTimestamps.push(now);
  ipRequests.set(ip, ipTimestamps);

  next();
}