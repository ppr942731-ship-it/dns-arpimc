// DNS ARPIMC - Anti Iklan + Judol + Spam
const BLOCKED = [
  // Judol
  "slot", "gacor", "judol", "togel", "toto", "maxwin", "zeus", "scatter",
  // Iklan bahaya & spam umum
  "doubleclick.net", "googlesyndication.com", "googleadservices.com",
  "facebook.net/tr", "analytics", "adservice", "adsystem", "adserver",
  "popads", "popcash", "propellerads", "adsterra", "juicyads"
];

function isBlocked(domain) {
  if (!domain) return false;
  const d = domain.toLowerCase();
  return BLOCKED.some(b => d.includes(b));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const dnsQuery = req.query.dns;
  const nameQuery = req.query.name; // untuk DoH JSON

  // Root -> biar web gak error
  if (!dnsQuery && !nameQuery) {
    return res.status(200).json({ status: "arpimc dns 2026 - running", mode: "DoH" });
  }

  try {
    // Cek blokir kalau pakai ?name= (format JSON)
    if (nameQuery && isBlocked(nameQuery)) {
      // Balikin IP 0.0.0.0 = diblokir
      return res.status(200).json({
        Status: 0,
        Answer: [{ name: nameQuery, type: 1, TTL: 300, data: "0.0.0.0" }]
      });
    }

    // Forward ke Cloudflare
    let url = `https://cloudflare-dns.com/dns-query?${new URLSearchParams(req.query).toString()}`;
    let headers = { 'Accept': 'application/dns-message' };
    
    if (nameQuery) {
      url = `https://cloudflare-dns.com/dns-query?name=${nameQuery}&type=${req.query.type || 'A'}`;
      headers = { 'Accept': 'application/dns-json' };
    } else {
      headers = { 'Accept': 'application/dns-message', 'Content-Type': 'application/dns-message' };
    }

    const cf = await fetch(url, { headers });
    
    if (nameQuery) {
      const data = await cf.json();
      // Cek lagi hasil answer kalau ada judol lolos
      if (data.Answer && isBlocked(data.Answer[0]?.name || nameQuery)) {
        data.Answer[0].data = "0.0.0.0";
      }
      res.setHeader('Content-Type', 'application/dns-json');
      return res.status(200).json(data);
    } else {
      const buf = await cf.arrayBuffer();
      res.setHeader('Content-Type', 'application/dns-message');
      return res.status(200).send(Buffer.from(buf));
    }

  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: "upstream fail" });
  }
}
