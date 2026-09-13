const express = require('express');
const router = express.Router();
const pool = require('../db');
const supabaseAuth = require('../middleware/supabaseAuth');

// Adds up this user's "bought" decisions from Tiger Data, grouped by category.
router.get('/', supabaseAuth, async (req, res) => {
  try {
    const { monthlyBudget } = req.query;

    const result = await pool.query(
      `SELECT category, SUM(price) AS total
       FROM purchases
       WHERE user_id = $1
         AND decision = 'bought'
         AND created_at >= date_trunc('month', now())
       GROUP BY category`,
      [req.userId]
    );

    const spentByCategory = {};
    let totalSpent = 0;
    for (const row of result.rows) {
      const amount = Number(row.total) || 0;
      spentByCategory[row.category || 'uncategorized'] = amount;
      totalSpent += amount;
    }

    const budget = Number(monthlyBudget) || 0;

    res.json({
      spentByCategory,
      totalSpent,
      budgetRemaining: budget - totalSpent,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load tracker data' });
  }
});

module.exports = router;
