import nodemailer from 'nodemailer';
import { mkdir, readdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { bookingText } from './booking.js';
export function configured(env = process.env) {
  return ['SMTP_HOST','SMTP_USER','SMTP_PASS','SMTP_FROM','EMAIL_TO','TELEGRAM_BOT_TOKEN','TELEGRAM_ADMIN_CHAT_ID'].every(key => Boolean(env[key]?.trim()));
}
export async function telegram(method, body) {
  const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(method === 'getUpdates' ? 40000 : 15000)});
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error('Telegram request failed');
  return data.result;
}
export async function createOutbox(options = {}) {
  const directory = path.resolve(process.env.DATA_DIR || './data');
  await mkdir(directory, {recursive:true,mode:0o700});
  const transport = options.transport || nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT || 465),secure:process.env.SMTP_SECURE !== 'false',requireTLS:process.env.SMTP_SECURE === 'false',auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS},connectionTimeout:15000,socketTimeout:20000});
  const sendTelegram = options.telegram || telegram;
  async function save(file, record) {
    await writeFile(`${file}.tmp`, JSON.stringify(record), {mode:0o600});
    await rename(`${file}.tmp`, file);
  }
  let running = false;
  async function drain() {
    if (running || !configured()) return;
    running = true;
    try {
      for (const name of await readdir(directory)) {
        if (!name.endsWith('.json')) continue;
        const file = path.join(directory,name);
        const record = JSON.parse(await readFile(file,'utf8'));
        if (record.retryAt > Date.now()) continue;
        const text = bookingText(record.booking);
        for (const channel of ['email','telegram']) {
          if (record[channel]) continue;
          try {
            if (channel === 'email') await transport.sendMail({from:process.env.SMTP_FROM,to:process.env.EMAIL_TO,subject:`Заявка: ${record.booking.checkIn} · Залив-Ретрит`,text,messageId:`<${record.booking.id}@zaliv-retreat.ru>`});
            else await sendTelegram('sendMessage',{chat_id:process.env.TELEGRAM_ADMIN_CHAT_ID,text});
            record[channel] = true;
            await save(file,record);
          } catch { console.error(`Delivery failed: ${channel}, booking ${record.booking.id}`); }
        }
        if (record.email && record.telegram) await unlink(file);
        else { record.attempts++; record.retryAt = Date.now() + Math.min(3600000, 15000 * 2 ** Math.min(record.attempts,8)); await save(file,record); }
      }
    } catch { console.error('Outbox processing failed. Check storage and permissions.'); }
    finally { running = false; }
  }
  const timer = setInterval(drain,15000); timer.unref();
  if (options.autoDrain !== false) void drain();
  return {drain, async enqueue(booking) {
    if (!configured()) throw new Error('NOT_CONFIGURED');
    await save(path.join(directory,`${booking.id}.json`),{booking,email:false,telegram:false,attempts:0,retryAt:0});
    if (options.autoDrain !== false) void drain();
  }, close() { clearInterval(timer); transport.close(); }};
}
