const express = require('express');
const router = express.Router();
const { getAIReply } = require('../services/aiRouter');

router.post('/ask', async (req, res) => {
  try {
    const { category, userMessage, userId } = req.body;

    const prompt = `
      You are helping a user set a monthly budget for the category "${category}".
      Ask them a short, friendly question about how much they usually spend
      on this category per month. Keep it to one short question.
      Their last message was: "${userMessage || ''}"
    `;

    const result = await getAIReply(prompt, { userId: userId || 'anonymous' });
    res.json({ reply: result.reply, source: result.source });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not process budget question' });
  }
});

router.post('/save', (req, res) => {
  const { userId, budgetByCategory } = req.body;

  // Save this to Backboard or your database here
  const total = Object.values(budgetByCategory).reduce(
    (sum, val) => sum + Number(val),
    0
  );

  res.json({ success: true, totalBudget: total });
});

module.exports = router;
