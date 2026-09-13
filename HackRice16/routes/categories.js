const express = require('express');
const router = express.Router();
const taxonomy = require('../data/expenditure_taxonomy.json');

router.get('/', (req, res) => {
  const demoMode = req.query.demo === 'true';

  const filtered = taxonomy.categories
    .map((cat) => ({
      ...cat,
      subcategories: cat.subcategories.filter((sub) =>
        demoMode ? sub.demo : true
      ),
    }))
    .filter((cat) => cat.subcategories.length > 0);

  res.json({ categories: filtered });
});

module.exports = router;
