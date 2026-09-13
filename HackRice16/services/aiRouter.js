const { askGemini } = require('./gemini');
const { sendMessage } = require('./backboard');

async function getAIReply(promptText, { userId, threadId } = {}) {
  try {
    const result = await askGemini(promptText);
    return { reply: result, source: 'gemini', threadId };
  } catch (err) {
    const isTimeout = err.code === 'ECONNABORTED';
    const isQuotaError =
      err.response?.status === 429 || err.response?.status === 403;

    if (isTimeout || isQuotaError) {
      console.log('Gemini failed, falling back to Backboard:', err.message);

      const result = await sendMessage({
        threadId,
        assistantId: process.env.BACKBOARD_ASSISTANT_ID,
        content: promptText,
      });

      return {
        reply: result.content,
        source: 'backboard',
        threadId: result.thread_id,
      };
    }

    // Some other unexpected error, not timeout or quota, so just throw it
    throw err;
  }
}

module.exports = { getAIReply };
