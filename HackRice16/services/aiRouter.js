const { askGemini } = require('./gemini');
const { sendMessage } = require('./backboard');

async function getAIReply(promptText, { userId, threadId, imageDataUrl } = {}) {
  try {
    const result = await askGemini(promptText, imageDataUrl);
    return { reply: result, source: 'gemini', threadId };
  } catch (err) {
    const isTimeout = err.code === 'ECONNABORTED';
    // Any HTTP error response from Gemini (bad/expired key, quota, model
    // not found, etc.) should fall back too, not just quota errors, so a
    // broken Gemini key doesn't take the whole feature down mid-demo.
    const isGeminiHttpError = !!err.response?.status;

    if (isTimeout || isGeminiHttpError) {
      console.log('Gemini failed, falling back to Backboard:', err.message);

      // Backboard has no image support here, so make sure the fallback
      // reply doesn't silently ignore a photo the user thinks was seen.
      const content = imageDataUrl
        ? `${promptText}\n\n(The user also shared a photo, which is not visible in this fallback mode. Ask them to describe it in words if it matters.)`
        : promptText;

      const result = await sendMessage({
        threadId,
        assistantId: process.env.BACKBOARD_ASSISTANT_ID,
        content,
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
