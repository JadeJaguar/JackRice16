const axios = require('axios');

async function searchProduct(query) {
  const response = await axios.get('https://serpapi.com/search.json', {
    params: {
      engine: 'google_shopping',
      q: query,
      api_key: process.env.SERPAPI_KEY,
    },
  });

  return response.data.shopping_results || [];
}

module.exports = { searchProduct };
