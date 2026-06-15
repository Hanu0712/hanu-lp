// Vercel serverless function: 申込者リストを返す（/admin から閲覧）
// パスワード（環境変数 ADMIN_PASSWORD）が一致したときだけデータを返す。
// 未設定・不一致なら何も返さない（fail closed）。
export const config = { runtime: 'nodejs' };

const BOOKINGS_PATH = 'bookings.json';

async function readBookings() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return [];
  try {
    const listRes = await fetch(`https://blob.vercel-storage.com?prefix=${BOOKINGS_PATH}`, {
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

  const expected = process.env.ADMIN_PASSWORD;
  // パスワード未設定なら誰にも見せない
  if (!expected) {
    return res.status(503).json({ error: 'not_configured' });
  }

  // パスワードはヘッダで受け取る（URLには載せない）
  const provided = req.headers['x-admin-key'];
  if (!provided || provided !== expected) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const list = await readBookings();
  list.sort((a, b) => (b.ts || 0) - (a.ts || 0)); // 新しい順
  return res.status(200).json({ count: list.length, bookings: list });
}
