const express = require('express');
const router = express.Router();
const { getAIReply } = require('../services/aiRouter');
const taxonomy = require('../data/expenditure_taxonomy.json');

router.post('/', async (req, res) => {
  try {
    const { itemDescription, categories } = req.body;

    // Prefer the caller's own budget category names (e.g. the user's actual
    // budget_categories from Supabase) so the reply lines up with what the
    // frontend can match against. Falls back to the full taxonomy if none
    // were sent, so this route still works standalone.
    const categoryNames = Array.isArray(categories) && categories.length
      ? categories
      : taxonomy.categories.map((c) => c.name);

    const prompt = `
      A user wants to buy this item: "${itemDescription}".
      Pick the single best matching category from this list: ${categoryNames.join(', ')}.
      Reply with only the category name exactly as written in the list, nothing else.
    `;

    const result = await getAIReply(prompt, { userId: req.userId || 'anonymous' });

    res.json({ category: result.reply.trim(), source: result.source });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not classify item' });
  }
});

// Short "do you really need this" nudge, shown before the buy or bye choice.
router.post('/nudge', async (req, res) => {
  try {
    const { itemDescription, category } = req.body;

    const prompt = `
      A user is thinking about buying this item: "${itemDescription}",
      in the category "${category || 'unknown'}".
      Write one short, kind, non judgmental question that helps them pause
      and think about whether they really need it right now.
      Keep it to one sentence. Do not lecture them.
    `;

    const result = await getAIReply(prompt, { userId: req.userId || 'anonymous' });
    res.json({ nudge: result.reply.trim(), source: result.source });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not generate nudge' });
  }
});

module.exports = router;
