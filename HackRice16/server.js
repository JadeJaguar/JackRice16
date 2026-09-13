require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const budgetRoutes = require('./routes/budget');
const classifyRoutes = require('./routes/classify');
const searchRoutes = require('./routes/search');
const purchaseRoutes = require('./routes/purchase');
const trackerRoutes = require('./routes/tracker');
const categoriesRoutes = require('./routes/categories');
const chatRoutes = require('./routes/chat');

const rateLimit = require('./middleware/rateLimit');
const { globalSearchLimit } = require('./middleware/globalSearchLimit');
const supabaseAuth = require('./middleware/supabaseAuth');

const app = express();
app.use(cors());
app.use(express.json());

// Routes that do not call outside AI or search APIs, no limit needed
app.use('/auth', authRoutes);
app.use('/categories', categoriesRoutes);

// These two now read and write Tiger Data, and check the Supabase
// login token themselves, inside the route file.
app.use('/purchase', purchaseRoutes);
app.use('/tracker', trackerRoutes);

// Routes that call Gemini or Backboard, limited per user per day
app.use('/chat', rateLimit(15), chatRoutes);
// classify is called from the signed-in Decide screen, so it checks the
// Supabase token first, which also gives rateLimit a real user id to key on
app.use('/classify', supabaseAuth, rateLimit(15), classifyRoutes);
app.use('/budget', supabaseAuth, rateLimit(10), budgetRoutes);

// Search calls SerpAPI, which has a very small free monthly pool,
// so it gets both a per user limit and a shared limit for the whole app
app.use('/search', supabaseAuth, rateLimit(5), globalSearchLimit, searchRoutes);

app.get('/', (req, res) => {
  res.send('Buy or Bye backend is running.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
