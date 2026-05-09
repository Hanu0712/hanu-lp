// Cloudflare Pages Function: route "/" based on ?pc=N (mirrors vercel.json rewrites)
const PC_MAP = {
  '0': '/original-2026-04-18-index.html',
  '2': '/lp.html',
  '5': '/v3.html',
  '6': '/v6.html',
  '7': '/v7.html',
  '9': '/v9.html',
};

const DEFAULT_TARGET = '/v9.html';

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const pc = url.searchParams.get('pc');
  const target = (pc && PC_MAP[pc]) || DEFAULT_TARGET;

  const rewrite = new URL(target, url.origin);
  return context.env.ASSETS.fetch(new Request(rewrite.toString(), context.request));
}
