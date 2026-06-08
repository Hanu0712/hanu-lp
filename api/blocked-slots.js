// GET /api/blocked-slots — returns dynamically booked slots from Vercel Blob
export const config = { runtime: 'nodejs' };

const BLOB_STORE_ID = 'store_o3GaqKsSSAZuAV6h';
const BLOB_PATH = 'booked-slots.json';

async function readBlob() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return [];

  try {
    // List blobs to find our file
    const listRes = await fetch(`https://blob.vercel-storage.com?prefix=${BLOB_PATH}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const listData = await listRes.json();

    if (!listData.blobs || listData.blobs.length === 0) return [];

    const blobUrl = listData.blobs[0].url;
    const dataRes = await fetch(blobUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!dataRes.ok) return [];
    return await dataRes.json();
  } catch (e) {
    console.error('Blob read error:', e);
    return [];
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const booked = await readBlob();
    return res.status(200).json({ booked });
  } catch (err) {
    return res.status(500).json({ error: err.message, booked: [] });
  }
}
