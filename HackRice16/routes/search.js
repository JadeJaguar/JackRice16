const express = require('express');
const router = express.Router();
const { searchProduct } = require('../services/serpapi');

router.get('/', async (req, res) => {
  try {
    const { query } = req.query;
    const results = await searchProduct(query);

    const simplified = results.slice(0, 8).map((item) => ({
      title: item.title,
      price: item.price,
      source: item.source,
      link: item.link,
      thumbnail: item.thumbnail,
    }));

    res.json({ results: simplified });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not search for product' });
  }
});

module.exports = router;
