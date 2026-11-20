import { createHash } from 'node:crypto';
import { mkdir,readFile,writeFile,rename } from 'node:fs/promises';
import path from 'node:path';
import { startBot } from './bot.js';
import { configured } from './delivery.js';
import { maxApi,maxSend,maxConfigured,normalizeMaxUpdate } from './max-client.js';
export function startMaxBot(outbox,options={}) {
  const api=options.api||maxApi,send=options.send||maxSend,sessions=new Map(),receipts=new Map();
  let stopped=false,marker=null,stateFile=options.stateFile||null,loaded=false,replyBuffer=null,activeEvent='';
  const conversation=startBot({async enqueue(booking){booking.id='max-'+createHash('sha256').update(activeEvent).digest('hex');await outbox.enqueue(booking);}},{source:'max',sessions,poll:false,ready:()=>configured()&&maxConfigured(),async api(_method,body){replyBuffer.push({chatId:String(body.chat_id),text:body.text});}});
  async function load(){
    if(loaded)return;loaded=true;if(!stateFile)return;
    try{const state=JSON.parse(await readFile(stateFile,'utf8'));marker=state.marker??null;for(const entry of state.sessions||[])sessions.set(...entry);for(const entry of state.receipts||[])receipts.set(...entry);}catch(error){if(error.code!=='ENOENT')throw error;}
  }
  async function persist(){
    for(const[key,value]of receipts)if(value.createdAt<Date.now()-172800000)receipts.delete(key);
    while(receipts.size>2000)receipts.delete(receipts.keys().next().value);
    if(!stateFile)return;await mkdir(path.dirname(stateFile),{recursive:true,mode:0o700});
    await writeFile(`${stateFile}.tmp`,JSON.stringify({marker,sessions:[...sessions],receipts:[...receipts]}),{mode:0o600});await rename(`${stateFile}.tmp`,stateFile);
  }
  async function handle(update){
    await load();const normalized=normalizeMaxUpdate(update);if(!normalized)return;
    const eventId=createHash('sha256').update(normalized.id).digest('hex');let receipt=receipts.get(eventId);
    if(!receipt){
    const code=process.env.MAX_ADMIN_BIND_CODE,chatId=normalized.message.chat.id;
    if(code&&normalized.message.text===`/connect ${code}`&&Number(process.env.MAX_ADMIN_BIND_EXPIRES)>Date.now()){
      if(!/^-?\d+$/.test(chatId))throw new Error('Invalid MAX dialog');
      const envFile=new URL('../.env',import.meta.url);let settings=await readFile(envFile,'utf8');
      settings=settings.replace(/^MAX_ADMIN_BIND_(CODE|EXPIRES)=.*\r?\n?/gm,'');
      settings=/^MAX_ADMIN_CHAT_ID=.*$/m.test(settings)?settings.replace(/^MAX_ADMIN_CHAT_ID=.*$/m,`MAX_ADMIN_CHAT_ID=${chatId}`):`${settings.trimEnd()}\nMAX_ADMIN_CHAT_ID=${chatId}\n`;
      await writeFile(envFile,settings);process.env.MAX_ADMIN_CHAT_ID=chatId;delete process.env.MAX_ADMIN_BIND_CODE;delete process.env.MAX_ADMIN_BIND_EXPIRES;
      receipt={replies:[{chatId,text:'Чат администратора подключён. Сюда будут приходить заявки и пожелания гостей. Для проверки бронирования отправьте /book.'}],sent:0,createdAt:Date.now()};console.log('MAX administrator dialog configured');
    }else{
      activeEvent=normalized.id;replyBuffer=[];await conversation.handle(normalized.message);
      receipt={replies:replyBuffer,sent:0,createdAt:Date.now()};replyBuffer=null;
    }
    receipts.set(eventId,receipt);await persist();
    }
    while(receipt.sent<receipt.replies.length){const reply=receipt.replies[receipt.sent];await send(reply.chatId,reply.text);receipt.sent++;await persist();}
  }
  async function poll(){
    const directory=path.resolve(process.env.DATA_DIR||'./data','max');await mkdir(directory,{recursive:true,mode:0o700});
    const suffix=createHash('sha256').update(process.env.MAX_BOT_TOKEN).digest('hex').slice(0,16);stateFile=path.join(directory,`poll-${suffix}.json`);
    await load();
    const subscriptions=await api('GET','/subscriptions');
    if(subscriptions.subscriptions?.length){console.error('MAX webhook is active; local polling was not started');return;}
    console.log('MAX local polling started');
    while(!stopped){
      try{
        const result=await api('GET','/updates',null,{marker,timeout:25,limit:100,types:'message_created,bot_started'});
        for(const update of result.updates||[]){if(stopped)break;await handle(update);}
        if(result.marker!==undefined&&result.marker!==null){marker=result.marker;await persist();}
      }catch{console.error('MAX polling failed; retrying');await new Promise(resolve=>setTimeout(resolve,5000));}
    }
  }
  if(options.poll!==false)void poll().catch(()=>console.error('MAX could not start; check token, certificates and subscriptions'));
  return {handle,stop(){stopped=true;conversation.stop();}};
}
