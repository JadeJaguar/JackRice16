const { askGemini } = require('./gemini');
const { sendMessage } = require('./backboard');

async function getAIReply(promptText, { userId, threadId } = {}) {
  try {
    const result = await askGemini(promptText);
    return { reply: result, source: 'gemini', threadId };
  } catch (err) {
    const isTimeout = err.code === 'ECONNABORTED';
    // Any HTTP error response from Gemini (bad/expired key, quota, model
    // not found, etc.) should fall back too, not just quota errors, so a
    // broken Gemini key doesn't take the whole feature down mid-demo.
    const isGeminiHttpError = !!err.response?.status;

    if (isTimeout || isGeminiHttpError) {
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
