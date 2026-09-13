const express = require('express');
const router = express.Router();
const { getAIReply } = require('../services/aiRouter');

// Temporary memory, holds each user's thread_id while the server is running.
// Resets if the server restarts. Fine for a demo, will be replaced by a real database later.
const userThreads = {};

router.post('/', async (req, res) => {
  try {
    const { message, imageDataUrl } = req.body;
    const userId = req.userId || 'anonymous';

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const existingThreadId = userThreads[userId];

    const result = await getAIReply(message, {
      userId,
      threadId: existingThreadId,
      imageDataUrl,
    });

    if (result.threadId) {
      userThreads[userId] = result.threadId;
    }

    res.json({ reply: result.reply, source: result.source });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: 'Could not get chat reply' });
  }
});

module.exports = router;
