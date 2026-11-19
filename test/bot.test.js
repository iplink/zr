import test from 'node:test';
import assert from 'node:assert/strict';
import { startBot } from '../server/bot.js';
test('bot validates each step and enqueues a complete booking only after consent',async()=>{
  const replies=[];const bookings=[];
  const bot=startBot({async enqueue(booking){bookings.push(booking);}},{poll:false,ready:()=>true,async api(method,body){replies.push(body.text);}});
  const say=text=>bot.handle({chat:{id:123,type:'private'},text});
  try {
    await say('/book');await say('2');await say('2020-01-01');
    assert.match(replies.at(-1),/прошлом/);
    await say('2099-05-20');await say('2099-05-19');
    assert.match(replies.at(-1),/позже/);
    await say('2099-05-22');await say('8');
    assert.match(replies.at(-1),/до 4/);
    await say('4');await say('Анна');await say('123');
    assert.match(replies.at(-1),/телефон/);
    await say('+79027850002');
    assert.equal(bookings.length,0);assert.match(replies.at(-1),/Проверьте заявку/);
    await say('Согласна');assert.equal(bookings.length,1);
    assert.equal(bookings[0].house,'secluded');assert.equal(bookings[0].guests,4);assert.equal(bookings[0].source,'telegram');
    assert.match(replies.at(-1),/Заявка принята/);
    await say('Согласна');assert.equal(bookings.length,1);
  } finally {bot.stop();}
});
test('bot handles cancellation and refuses collection while delivery is unconfigured',async()=>{
  const replies=[];
  const bot=startBot({async enqueue(){throw Error('must not enqueue');}},{poll:false,ready:()=>false,async api(method,body){replies.push(body.text);}});
  try {
    await bot.handle({chat:{id:123,type:'private'},text:'/book'});assert.match(replies.at(-1),/подключается/);
    await bot.handle({chat:{id:123,type:'private'},text:'/cancel'});assert.match(replies.at(-1),/отменена/);
    const count=replies.length;
    await bot.handle({chat:{id:123,type:'group'},text:'/book'});assert.equal(replies.length,count);
  } finally {bot.stop();}
});
