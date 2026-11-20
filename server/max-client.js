import https from 'node:https';
import { rootCertificates } from 'node:tls';
import { readFile } from 'node:fs/promises';

export function maxConfigured(env=process.env) {
  return Boolean(env.MAX_BOT_TOKEN?.trim() && /^-?\d+$/.test(env.MAX_ADMIN_CHAT_ID || ''));
}
export async function maxApi(method, endpoint, body=null, query={}) {
  if (!process.env.MAX_BOT_TOKEN?.trim()) throw new Error('MAX token is not configured');
  const url=new URL(endpoint,'https://platform-api2.max.ru');
  if(url.origin!=='https://platform-api2.max.ru')throw new Error('Invalid MAX endpoint');
  for(const [key,value] of Object.entries(query))if(value!==undefined&&value!==null)url.searchParams.set(key,String(value));
  const payload=body===null?null:JSON.stringify(body);
  const ca=process.env.MAX_CA_FILE ? [...rootCertificates,await readFile(process.env.MAX_CA_FILE)] : undefined;
  return new Promise((resolve,reject)=>{
    const request=https.request(url,{method,ca,headers:{Authorization:process.env.MAX_BOT_TOKEN,...payload?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload)}:{}},timeout:endpoint==='/updates'?40000:12000},response=>{
      const chunks=[];let size=0;
      response.on('data',chunk=>{size+=chunk.length;if(size>2*1024*1024)request.destroy(new Error('MAX response too large'));else chunks.push(chunk);});
      response.on('error',reject);
      response.on('end',()=>{try{const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(response.statusCode<200||response.statusCode>=300||data.success===false){const error=new Error(`MAX API request failed (${response.statusCode})`);error.code=data.code;reject(error);}else resolve(data);}catch{reject(new Error('Invalid MAX response'));}});
    });
    request.on('timeout',()=>request.destroy(new Error('MAX request timeout')));
    request.on('error',reject);if(payload!==null)request.write(payload);request.end();
  });
}
const sends=new Map();
export async function maxSend(chatId,text) {
  const previous=sends.get(String(chatId))||Promise.resolve();
  const next=previous.catch(()=>{}).then(()=>maxApi('POST','/messages',{text},{chat_id:chatId}));
  const tail=next.catch(()=>{}).then(()=>new Promise(resolve=>setTimeout(resolve,550)));
  sends.set(String(chatId),tail);
  void tail.then(()=>{if(sends.get(String(chatId))===tail)sends.delete(String(chatId));});
  return next;
}
export function normalizeMaxUpdate(update) {
  if(update?.update_type==='bot_started'&&update.chat_id!==undefined&&!update.user?.is_bot) {
    return {id:`start:${update.chat_id}:${update.user?.user_id}:${update.timestamp}`,message:{chat:{id:String(update.chat_id),type:'private'},text:'/start'}};
  }
  const message=update?.message;
  if(update?.update_type!=='message_created'||message?.recipient?.chat_type!=='dialog'||message.sender?.is_bot||typeof message.body?.text!=='string'||message.recipient.chat_id===undefined||!message.body.mid)return null;
  return {id:`message:${message.body.mid}`,message:{chat:{id:String(message.recipient.chat_id),type:'private'},text:message.body.text}};
}
