// api/dns-query.js - Proxy DNS-over-HTTPS ke Cloudflare
export default async function handler(req, res) {
  // Biar bisa dipakai sebagai DNS Private di Android
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const upstream = 'https://1.1.1.1/dns-query';

  // Ambil query string dari request lu (?dns=xxx)
  const url = new URL(upstream);
  if (req.url) {
    const qs = req.url.split('?')[1];
    if (qs) url.search = qs;
  }

  // Forward body kalau POST (dipakai Android)
  const options = {
    method: req.method,
    headers: {
      'Content-Type': req.headers['content-type'] || 'application/dns-message',
      'Accept': 'application/dns-message',
    },
  };

  if (req.method === 'POST') {
    // Vercel body parsing
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    options.body = Buffer.concat(chunks);
  }

  try {
    const upstreamRes = await fetch(url.toString(), options);
    const buffer = await upstreamRes.arrayBuffer();

    res.setHeader('Content-Type', upstreamRes.headers.get('content-type') || 'application/dns-message');
    res.status(upstreamRes.status).send(Buffer.from(buffer));
  } catch (e) {
    res.status(502).json({ error: 'Upstream DNS failed', detail: e.message });
  }
}
