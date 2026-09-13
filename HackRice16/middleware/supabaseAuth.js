const axios = require('axios');

// Checks the Supabase access token the frontend sends.
// Frontend must send: Authorization: Bearer <supabase access token>
// You can get that token in the frontend with:
//   const { data } = await supabase.auth.getSession();
//   const token = data.session?.access_token;
async function supabaseAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return res.status(401).json({ error: 'Missing Authorization header' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

    const response = await axios.get(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_KEY,
      },
    });

    // response.data.id is the Supabase user id, same id used in Supabase tables
    req.userId = response.data.id;
    req.userEmail = response.data.email;
    next();
  } catch (err) {
    console.error('Supabase auth check failed:', err.response?.data || err.message);
    res.status(401).json({ error: 'Invalid or expired session' });
  }
}

module.exports = supabaseAuth;
