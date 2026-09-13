const axios = require('axios');

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

async function askGemini(promptText) {
  const response = await axios.post(
    `${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`,
    {
      contents: [{ parts: [{ text: promptText }] }],
    },
    {
      timeout: 8000, // waits 8 seconds max, then gives up
    }
  );

  const text = response.data.candidates[0].content.parts[0].text;
  return text;
}

module.exports = { askGemini };
