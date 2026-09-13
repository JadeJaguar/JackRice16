const express = require('express');
const router = express.Router();
const pool = require('../db');
const supabaseAuth = require('../middleware/supabaseAuth');

// Saves a Buy or Bye decision into Tiger Data.
router.post('/', supabaseAuth, async (req, res) => {
  try {
    const { item, category, price, decision, alternatives } = req.body;

    if (!item || !decision) {
      return res.status(400).json({ error: 'item and decision are required' });
    }

    const result = await pool.query(
      `INSERT INTO purchases (user_id, item, category, price, decision, alternatives)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.userId, item, category || null, price || null, decision, JSON.stringify(alternatives || [])]
    );

    res.json({ success: true, record: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not save purchase' });
  }
});

// Lists this user's past decisions.
router.get('/', supabaseAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM purchases WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.userId]
    );
    res.json({ purchases: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load purchases' });
  }
});

module.exports = router;
