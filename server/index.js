import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { validateBooking } from './booking.js';
import { createOutbox, configured } from './delivery.js';
import { startBot } from './bot.js';
import { startMaxBot } from './max-bot.js';
const publicDir = fileURLToPath(new URL('../public/',import.meta.url));
process.env.EMAIL_TO ||= 'vi-kate@mail.ru';
const outbox = await createOutbox();
const attempts = new Map();
const prune = setInterval(() => { for (const [ip,entry] of attempts) if (entry.until<Date.now()) attempts.delete(ip); },60000); prune.unref();
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.xml':'application/xml','.txt':'text/plain; charset=utf-8'};
function json(res,status,data) { res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(data)); }
const server = http.createServer(async (req,res) => {
  res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('X-Frame-Options','DENY'); res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
  try {
    const url = new URL(req.url,'http://localhost');
    if (url.pathname === '/api/booking') {
      if (req.method !== 'POST') { res.setHeader('Allow','POST'); return json(res,405,{error:'Метод не поддерживается.'}); }
      const origin = req.headers.origin;
      if (origin && origin !== new URL(process.env.SITE_URL || 'http://localhost:3000').origin) return json(res,403,{error:'Недопустимый источник запроса.'});
      if (!req.headers['content-type']?.startsWith('application/json')) return json(res,415,{error:'Ожидается JSON.'});
      const ip = process.env.TRUST_PROXY === 'true' ? String(req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim() : req.socket.remoteAddress;
      let entry = attempts.get(ip);
      if (!entry || entry.until < Date.now()) { entry = {count:0,until:Date.now()+900000}; attempts.set(ip,entry); }
      if (++entry.count > 10) { res.setHeader('Retry-After','900'); return json(res,429,{error:'Слишком много заявок. Попробуйте позже или позвоните +7 902 785-00-02.'}); }
      let raw = ''; for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw)>8192) return json(res,413,{error:'Слишком большой запрос.'}); }
      let data; try { data = JSON.parse(raw); } catch { return json(res,400,{error:'Некорректный запрос.'}); }
      if (data?.website) return json(res,400,{error:'Не удалось отправить заявку.'});
      let booking; try { booking = {...validateBooking(data),source:'website'}; } catch (error) { return json(res,400,{error:error.message}); }
      if (!configured()) return json(res,503,{error:'Онлайн-заявки пока подключаются. Позвоните +7 902 785-00-02 или напишите vi-kate@mail.ru.'});
      await outbox.enqueue(booking);
      return json(res,202,{ok:true,id:booking.id});
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res,405,{error:'Метод не поддерживается.'});
    if (url.pathname === '/health') return json(res,200,{ok:true});
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.resolve(publicDir,relative);
    if (!file.startsWith(publicDir) || relative.includes('\\') || relative.split('/').some(part=>part.startsWith('.'))) return json(res,404,{error:'Страница не найдена.'});
    let content; try { content = await readFile(file); } catch { return json(res,404,{error:'Страница не найдена.'}); }
    res.writeHead(200,{'Content-Type':types[path.extname(file)] || 'application/octet-stream','Cache-Control':path.extname(file)==='.html'?'no-cache':'public, max-age=3600'});
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch { if (!res.headersSent) json(res,500,{error:'Не удалось принять заявку. Позвоните +7 902 785-00-02.'}); else res.end(); }
});
server.requestTimeout = 15000; server.headersTimeout = 10000;
server.listen(Number(process.env.PORT || 3000),process.env.HOST || '127.0.0.1',()=>console.log(`Zaliv-Retreat listening on port ${process.env.PORT || 3000}; booking ${configured() ? 'enabled' : 'needs configuration'}`));
const stopBot = process.env.TELEGRAM_BOT_TOKEN && process.env.BOT_ENABLED !== 'false' ? startBot(outbox).stop : () => {};
const stopMaxBot = process.env.MAX_BOT_TOKEN && process.env.MAX_ENABLED !== 'false' ? startMaxBot(outbox).stop : () => {};
for (const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>{ stopBot(); stopMaxBot(); outbox.close(); clearInterval(prune); server.close(()=>process.exit(0)); });
