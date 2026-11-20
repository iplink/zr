import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMaxUpdate} from '../server/max-client.js';
import {startMaxBot} from '../server/max-bot.js';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
test('MAX adapter accepts private messages and startup but ignores groups and bots',()=>{
  assert.equal(normalizeMaxUpdate({update_type:'bot_started',chat_id:12,user:{user_id:3},timestamp:1}).message.text,'/start');
  const message={recipient:{chat_id:12,chat_type:'dialog'},sender:{user_id:3,is_bot:false},body:{mid:'x',text:'/book'}};
  assert.equal(normalizeMaxUpdate({update_type:'message_created',message}).message.chat.id,'12');
  assert.equal(normalizeMaxUpdate({update_type:'message_created',message:{...message,recipient:{...message.recipient,chat_type:'chat'}}}),null);
  assert.equal(normalizeMaxUpdate({update_type:'message_created',message:{...message,sender:{is_bot:true}}}),null);
});
test('MAX retries a failed reply without advancing twice, including after restart',async()=>{
  const previous={...process.env};Object.assign(process.env,{SMTP_HOST:'test',SMTP_USER:'test',SMTP_PASS:'test',SMTP_FROM:'test',EMAIL_TO:'test',TELEGRAM_BOT_TOKEN:'test',TELEGRAM_ADMIN_CHAT_ID:'1',MAX_BOT_TOKEN:'test',MAX_ADMIN_CHAT_ID:'12'});
  const directory=await mkdtemp(path.join(tmpdir(),'zaliv-max-test-'));const stateFile=path.join(directory,'state.json');let bot;const replies=[];let fail=false;
  const options={poll:false,stateFile,async send(chat,text){if(fail)throw Error('Simulated network failure');replies.push(text);}};
  const message=(text,mid)=>({update_type:'message_created',message:{recipient:{chat_id:12,chat_type:'dialog'},sender:{is_bot:false},body:{mid,text}}});
  try{
    bot=startMaxBot({async enqueue(){}},options);await bot.handle(message('/book','one'));fail=true;
    await assert.rejects(bot.handle(message('1','two')));bot.stop();fail=false;
    bot=startMaxBot({async enqueue(){}},options);await bot.handle(message('1','two'));assert.match(replies.at(-1),/Дата заезда/);
    const count=replies.length;await bot.handle(message('1','two'));assert.equal(replies.length,count);
    await bot.handle(message('20.05.2099','three'));assert.match(replies.at(-1),/Дата выезда/);
  }finally{bot?.stop();for(const key of Object.keys(process.env))if(!(key in previous))delete process.env[key];Object.assign(process.env,previous);await rm(directory,{recursive:true,force:true});}
});
test('MAX conversation preserves dotted dates and sends wishes as a linked addition',async()=>{
  const previous={...process.env};Object.assign(process.env,{SMTP_HOST:'test',SMTP_USER:'test',SMTP_PASS:'test',SMTP_FROM:'test',EMAIL_TO:'test',TELEGRAM_BOT_TOKEN:'test',TELEGRAM_ADMIN_CHAT_ID:'1',MAX_BOT_TOKEN:'test',MAX_ADMIN_CHAT_ID:'12'});
  const bookings=[],replies=[];const bot=startMaxBot({async enqueue(booking){bookings.push(booking);}},{poll:false,async send(chat,text){replies.push({chat,text});}});
  try{
    let seq=0;for(const text of ['/book','1','20.05.2099','22.05.2099','2','Анна','+79027850002','Согласна'])await bot.handle({update_type:'message_created',message:{recipient:{chat_id:12,chat_type:'dialog'},sender:{is_bot:false},body:{mid:String(++seq),text}}});
    assert.equal(bookings.length,1);assert.equal(bookings[0].source,'max');assert.equal(bookings[0].checkIn,'2099-05-20');assert.match(replies.at(-1).text,/пожелания/);
    await bot.handle({update_type:'message_created',message:{recipient:{chat_id:12,chat_type:'dialog'},sender:{is_bot:false},body:{mid:String(++seq),text:'Нужна кроватка'}}});
    assert.equal(bookings.length,2);assert.equal(bookings[1].kind,'wishes');assert.equal(bookings[1].parentId,bookings[0].id);
  }finally{bot.stop();for(const key of Object.keys(process.env))if(!(key in previous))delete process.env[key];Object.assign(process.env,previous);}
});
