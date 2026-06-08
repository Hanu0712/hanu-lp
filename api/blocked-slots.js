// GET /api/blocked-slots — returns dynamically booked slots from Upstash Redis
export const config = { runtime: 'nodejs' };

async function redisGet(key) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  return data.result;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const raw = await redisGet('hanu:booked-slots');
    // stored as JSON array: [{ date: "2026-06-12", slot: "21:00-21:30" }, ...]
    const booked = raw ? JSON.parse(raw) : [];
    return res.status(200).json({ booked });
  } catch (err) {
    return res.status(500).json({ error: err.message, booked: [] });
  }
}
