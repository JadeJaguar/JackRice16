const express = require('express');
const router = express.Router();
const { verifyGoogleToken } = require('../services/google');

router.post('/google', async (req, res) => {
  try {
    const { idToken } = req.body;
    const user = await verifyGoogleToken(idToken);

    // Later, this is where you check Backboard or your own store
    // to see if this user already exists, and create them if not.

    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(401).json({ error: 'Invalid Google token' });
  }
});

module.exports = router;
