// Cloudflare Pages Function: receives booking form, sends 2 emails via Resend
// - notification to Hanu (B-2 format)
// - auto-reply to customer

const HANU_EMAIL = 'hanuparty.08@gmail.com';
const FROM_ADDRESS = 'Hanu Booking <onboarding@resend.dev>';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export async function onRequestPost(context) {
  const { request, env } = context;
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    return json({ error: 'RESEND_API_KEY not configured' }, 500);
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const {
    name, nameKana, email, instagram, message,
    partyTypeText, dateLabel, slot, subject,
  } = body;

  if (!name || !nameKana || !email || !partyTypeText || !dateLabel || !slot || !subject) {
    return json({ error: '必須項目が不足しています' }, 400);
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
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [to],
        subject,
        text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });

  try {
    const notifyRes = await sendEmail({
      to: HANU_EMAIL,
      subject,
      text: notificationBody,
      replyTo: email,
    });
    const notifyData = await notifyRes.json();
    if (!notifyRes.ok) {
      return json({ error: 'Hanu宛通知の送信に失敗しました', detail: notifyData }, 502);
    }

    const autoRes = await sendEmail({
      to: email,
      subject: '【お申し込み受付】無料Zoom相談 — Hanu',
      text: autoReplyBody,
    });
    const autoData = await autoRes.json();
    if (!autoRes.ok) {
      return json({ success: true, autoReplyFailed: true, detail: autoData }, 200);
    }

    return json({ success: true });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

export async function onRequest() {
  return json({ error: 'Method not allowed' }, 405);
}
