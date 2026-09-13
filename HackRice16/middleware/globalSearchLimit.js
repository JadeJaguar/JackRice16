// Temporary memory, resets when the server restarts. Fine for a demo.
let totalSearchesToday = 0;
let currentDay = new Date().toISOString().slice(0, 10);

const GLOBAL_SEARCH_LIMIT = 40; // leaves plenty of buffer out of the 250 total monthly searches

function globalSearchLimit(req, res, next) {
  const today = new Date().toISOString().slice(0, 10);

  // Reset the count if the day has changed
  if (today !== currentDay) {
    currentDay = today;
    totalSearchesToday = 0;
  }

  if (totalSearchesToday >= GLOBAL_SEARCH_LIMIT) {
    return res.status(429).json({
      error: 'Search limit reached for today across the app. Please try again tomorrow.',
    });
  }

  totalSearchesToday += 1;
  next();
}

module.exports = { globalSearchLimit };
