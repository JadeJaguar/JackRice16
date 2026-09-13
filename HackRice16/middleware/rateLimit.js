// Temporary memory, resets when the server restarts. Fine for a demo.
const usageCounts = {};

function rateLimit(maxPerDay) {
  return function (req, res, next) {
    const userId = req.userId || req.body.userId || req.query.userId;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const today = new Date().toISOString().slice(0, 10); // like "2026-09-12"
    const key = `${userId}_${req.baseUrl}_${today}`;

    if (!usageCounts[key]) {
      usageCounts[key] = 0;
    }

    if (usageCounts[key] >= maxPerDay) {
      return res.status(429).json({
        error: 'Daily limit reached for this feature. Please try again tomorrow.',
      });
    }

    usageCounts[key] += 1;
    next();
  };
}

module.exports = rateLimit;
