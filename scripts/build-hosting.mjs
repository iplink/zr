import { cp, mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../',import.meta.url));
const withCredentials = process.argv.includes('--private');
const output = path.join(root,'dist',withCredentials?'reg-ru-ready':'reg-ru-public');
const site = path.join(output,'zaliv-retreat.ru');
const privateDir = path.join(output,'zaliv-private');
await mkdir(output,{recursive:true});
await cp(path.join(root,'public'),site,{recursive:true});
await cp(path.join(root,'hosting/php/public'),site,{recursive:true});
await cp(path.join(root,'hosting/php/private'),privateDir,{recursive:true,filter:source=>!['config.php','data'].includes(path.basename(source))});
const app = path.join(site,'app.js');
await writeFile(app,(await readFile(app,'utf8')).replace("fetch('/api/booking',","fetch('/api/booking.php',"));
if (withCredentials) {
  const env = Object.fromEntries((await readFile(path.join(root,'.env'),'utf8')).split(/\r?\n/).filter(line=>/^[A-Z_]+=/.test(line)).map(line=>{const index=line.indexOf('=');return [line.slice(0,index),line.slice(index+1).trim()];}));
  const secretsPath = path.join(root,'hosting/.secrets.json');
  let secrets;
  try { secrets=JSON.parse(await readFile(secretsPath,'utf8')); }
  catch(error) { if(error.code!=='ENOENT')throw error;secrets={webhook:randomBytes(32).toString('hex'),setup:randomBytes(32).toString('hex')};await writeFile(secretsPath,JSON.stringify(secrets),{mode:0o600}); }
  const config = {site_url:'https://zaliv-retreat.ru',email_to:env.EMAIL_TO,smtp_host:env.SMTP_HOST,smtp_port:Number(env.SMTP_PORT||465),smtp_user:env.SMTP_USER,smtp_password:env.SMTP_PASS,smtp_from:env.SMTP_FROM,telegram_token:env.TELEGRAM_BOT_TOKEN,admin_chat_id:env.TELEGRAM_ADMIN_CHAT_ID,bot_username:'ZalivBookingBot',webhook_secret:secrets.webhook,setup_secret:secrets.setup,data_dir:''};
  if(Object.values(config).some(value=>value===undefined))throw Error('Missing local configuration');
  const phpValue = value=>typeof value==='number'?String(value):`'${String(value).replaceAll('\\','\\\\').replaceAll("'","\\'")}'`;
  await writeFile(path.join(privateDir,'config.php'),`<?php\ndeclare(strict_types=1);\nreturn [\n${Object.entries(config).map(([key,value])=>`    '${key}' => ${phpValue(value)},`).join('\n')}\n];\n`,{mode:0o600});
} else {
  // A public build must never silently reuse a private configuration.
  try { await access(path.join(privateDir,'config.php')); throw Error('Public output contains credentials; choose a clean output directory'); }
  catch(error) {if(error.code!=='ENOENT')throw error;}
}
await cp(path.join(root,'hosting/REG-RU.md'),path.join(output,'ИНСТРУКЦИЯ.md'));
console.log(`Hosting package prepared: ${output}. Credentials: ${withCredentials?'included in PRIVATE folder; do not publish':'not included'}.`);
