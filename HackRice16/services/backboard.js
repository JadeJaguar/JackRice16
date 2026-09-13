const axios = require('axios');

const BASE_URL = 'https://app.backboard.io/api';
const HEADERS = {
  'X-API-Key': process.env.BACKBOARD_API_KEY,
  'Content-Type': 'application/json',
};

// Sends a message. Pass threadId if the user already has one.
// Leave threadId out on a user's first message, and save the one that comes back.
async function sendMessage({ threadId, assistantId, content }) {
  const body = {
    content,
    memory: 'Auto', // turns on Backboard's automatic memory feature
  };

  if (threadId) body.thread_id = threadId;
  if (assistantId) body.assistant_id = assistantId;

  const response = await axios.post(`${BASE_URL}/threads/messages`, body, {
    headers: HEADERS,
  });

  return response.data;
  // response.data.content is the reply text
  // response.data.thread_id is the id to save and reuse for this user
}

// Optional, only needed once, if you want a custom Purchase Pal persona
async function createAssistant(name, systemPrompt) {
  const response = await axios.post(
    `${BASE_URL}/assistants`,
    { name, system_prompt: systemPrompt },
    { headers: HEADERS }
  );

  return response.data; // includes assistant_id
}

async function listMemories(assistantId) {
  const response = await axios.get(
    `${BASE_URL}/assistants/${assistantId}/memories`,
    { headers: HEADERS }
  );

  return response.data.memories;
}

async function searchMemories(assistantId, query, limit = 5) {
  const response = await axios.post(
    `${BASE_URL}/assistants/${assistantId}/memories/search`,
    { query, limit },
    { headers: HEADERS }
  );

  return response.data.memories;
}

module.exports = {
  sendMessage,
  createAssistant,
  listMemories,
  searchMemories,
};
