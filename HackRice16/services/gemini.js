const axios = require('axios');

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent';

// imageDataUrl, if given, is a data: URL like "data:image/png;base64,...."
async function askGemini(promptText, imageDataUrl) {
  const parts = [{ text: promptText }];

  if (imageDataUrl) {
    const match = /^data:([^;,]+);base64,(.+)$/.exec(imageDataUrl);
    if (match) {
      parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
    }
  }

  const response = await axios.post(
    `${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`,
    {
      contents: [{ parts }],
    },
    {
      timeout: 8000, // waits 8 seconds max, then gives up
    }
  );

  const text = response.data.candidates[0].content.parts[0].text;
  return text;
}

module.exports = { askGemini };
