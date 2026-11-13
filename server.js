'use strict';
const http = require('http');

const PORT = process.env.PORT || 3000;
const FALLBACK = 'JARVIS abhi thoda busy hai, thodi der baad try karo.';
const conversations = new Map();

function escapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function twiml(text) {
  return '<?xml version="1.0" encoding="UTF-8"?><Response><Message>' + escapeXml(text) + '</Message></Response>';
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        reject(new Error('body too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

async function askDify(query, user) {
  const base = process.env.DIFY_BASE_URL || 'https://api.dify.ai/v1';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(base + '/chat-messages', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.DIFY_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {},
        query,
        response_mode: 'blocking',
        user,
        conversation_id: conversations.get(user) || '',
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error('Dify returned status ' + res.status);
    const json = await res.json();
    if (json.conversation_id) conversations.set(user, json.conversation_id);
    if (!json.answer) throw new Error('Dify returned no answer');
    return json.answer;
  } finally {
    clearTimeout(timer);
  }
}

const server = http.createServer(async (req, res) => {
  const path = (req.url || '').split('?')[0];
  if (req.method === 'GET' && path === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('JARVIS relay ok');
    return;
  }
  if (req.method === 'POST' && path === '/whatsapp') {
    let reply = FALLBACK;
    try {
      const raw = await readBody(req);
      const params = new URLSearchParams(raw);
      const body = params.get('Body') || '';
      const from = params.get('From') || 'unknown';
      reply = await askDify(body, from);
    } catch (err) {
      console.error('relay error:', err && err.name === 'AbortError' ? 'Dify request timed out' : (err && err.message) || 'unknown error');
      reply = FALLBACK;
    }
    if (reply.length > 1500) reply = reply.slice(0, 1500);
    res.writeHead(200, { 'Content-Type': 'text/xml; charset=utf-8' });
    res.end(twiml(reply));
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

server.listen(PORT, () => console.log('JARVIS relay listening on port ' + PORT));
