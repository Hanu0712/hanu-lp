// Vercel serverless function: receives booking form, sends 2 emails via Resend
// - notification to Hanu (B-2 format)
// - auto-reply to customer

const HANU_EMAIL = 'hanuparty.08@gmail.com';
const FROM_ADDRESS = 'Hanu Booking <onboarding@resend.dev>';

export const config = { runtime: 'nodejs' };

// ---- Vercel Blob helpers ----
const SLOTS_PATH = 'booked-slots.json';   // 枠ブロック用（SOLD OUT表示）
const BOOKINGS_PATH = 'bookings.json';    // 申込者リスト用（/admin で閲覧）

async function readBlobJson(path, fallback) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return fallback;
  try {
    const listRes = await fetch(`https://blob.vercel-storage.com?prefix=${path}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const listData = await listRes.json();
    if (!listData.blobs || listData.blobs.length === 0) return fallback;
    const blobUrl = listData.blobs[0].url;
    const dataRes = await fetch(blobUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!dataRes.ok) return fallback;
    return await dataRes.json();
  } catch (e) {
    console.error('Blob read error:', e);
    return fallback;
  }
}

async function writeBlobJson(path, data) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return;
  await fetch(`https://blob.vercel-storage.com/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-vercel-blob-content-type': 'application/json'
    },
    body: JSON.stringify(data)
  });
}

async function saveBookedSlot(date, slot) {
  try {
    const booked = await readBlobJson(SLOTS_PATH, []);
    if (!booked.some(b => b.date === date && b.slot === slot)) {
      booked.push({ date, slot });
      await writeBlobJson(SLOTS_PATH, booked);
    }
  } catch (e) {
    console.error('Blob saveBookedSlot error:', e);
  }
}

async function saveBooking(record) {
  try {
    const list = await readBlobJson(BOOKINGS_PATH, []);
    list.push(record);
    await writeBlobJson(BOOKINGS_PATH, list);
  } catch (e) {
    console.error('Blob saveBooking error:', e);
  }
}
// ---- end Blob helpers ----

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'RESEND_API_KEY not configured' });
  }

  const body = await readJsonBody(req);
  const {
    name, nameKana, email, instagram, message,
    partyTypeText, date, dateLabel, slot, subject
  } = body;

  if (!name || !nameKana || !email || !partyTypeText || !dateLabel || !slot || !subject) {
    return res.status(400).json({ error: '必須項目が不足しています' });
  }

  const notificationBody =
    `${name} 様\n\n` +
    `パーティープロデューサーHanuと申します。\n` +
    `この度は無料Zoom相談にお申込みいただき\n` +
    `ありがとうございます。\n\n` +
    `ご予約の確定は、改めてメールにて\n` +
    `ご報告させていただきます。\n` +
    `今しばらくお待ちくださいませ。\n\n` +
    `――――――――――――――\n` +
    `【ご予約内容】\n` +
    `日時: ${dateLabel} ${slot}\n` +
    `お名前: ${name}（${nameKana}）\n` +
    `メール: ${email}\n` +
    (instagram ? `Instagram: ${instagram}\n` : '') +
    `パーティー内容: ${partyTypeText}\n` +
    (message ? `ご相談内容: ${message}\n` : '') +
    `――――――――――――――\n\n` +
    `パーティープロデューサー Hanu\n`;

  const autoReplyBody =
    `${name} 様\n\n\n` +
    `無料Zoom相談へのお申し込みをいただき、\n` +
    `誠にありがとうございます。\n\n` +
    `下記の内容にて、承りました。\n\n` +
    `【ご予約内容】\n` +
    `■日時: ${dateLabel}\n` +
    `　　　  ${slot}\n` +
    `■お名前: ${name}（${nameKana}）\n` +
    `■メールアドレス: ${email}\n` +
    (instagram ? `■Instagram: ${instagram}\n` : '') +
    `■パーティー内容: ${partyTypeText}\n` +
    (message ? `■ご相談内容: ${message}\n` : '') +
    `\nご予約の確定は、Hanuからの返信メールをもって\n` +
    `完了となります。\n\n` +
    `内容確認後、改めてご連絡いたしますので、\n` +
    `今しばらくお待ちくださいませ。\n\n\n` +
    `パーティープロデューサー Hanu`;

  const sendEmail = ({ to, subject, text, replyTo }) =>
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [to],
        subject,
        text,
        ...(replyTo ? { reply_to: replyTo } : {})
      })
    });

  try {
    const notifyRes = await sendEmail({
      to: HANU_EMAIL,
      subject,
      text: notificationBody,
      replyTo: email
    });
    const notifyData = await notifyRes.json();
    if (!notifyRes.ok) {
      return res.status(502).json({
        error: 'Hanu宛通知の送信に失敗しました',
        detail: notifyData
      });
    }

    const autoRes = await sendEmail({
      to: email,
      subject: '【お申し込み受付】無料Zoom相談 — Hanu',
      text: autoReplyBody
    });
    const autoData = await autoRes.json();

    // 申込者リスト保存 + 枠ブロック保存（どちらも失敗しても予約自体は成功扱い）
    const bookingRecord = {
      ts: Date.now(),
      name, nameKana, email,
      instagram: instagram || '',
      partyTypeText,
      message: message || '',
      date: date || '',
      dateLabel, slot
    };
    await Promise.all([
      saveBooking(bookingRecord).catch(e => console.error('saveBooking failed:', e)),
      (date && slot)
        ? saveBookedSlot(date, slot).catch(e => console.error('slot save failed:', e))
        : Promise.resolve()
    ]);

    if (!autoRes.ok) {
      return res.status(200).json({
        success: true,
        autoReplyFailed: true,
        detail: autoData
      });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
