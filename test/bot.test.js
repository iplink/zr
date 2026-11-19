import test from 'node:test';
import assert from 'node:assert/strict';
import { startBot } from '../server/bot.js';
test('bot validates each step and enqueues a complete booking only after consent',async()=>{
  const replies=[];const bookings=[];
  const bot=startBot({async enqueue(booking){bookings.push(booking);}},{poll:false,ready:()=>true,async api(method,body){replies.push(body.text);}});
  const say=text=>bot.handle({chat:{id:123,type:'private'},text});
  try {
    await say('/book');await say('2');await say('01.01.2020');
    assert.match(replies.at(-1),/прошлом/);
    await say('20.05.2099');await say('19.05.2099');
    assert.match(replies.at(-1),/позже/);
    await say('22.05.2099');await say('8');
    assert.match(replies.at(-1),/до 4/);
    await say('4');await say('Анна');await say('123');
    assert.match(replies.at(-1),/телефон/);
    await say('+79027850002');
    assert.equal(bookings.length,0);assert.match(replies.at(-1),/Проверьте заявку/);
    assert.match(replies.at(-1),/Заезд: 20\.05\.2099/);
    await say('Согласна');assert.equal(bookings.length,1);
    assert.equal(bookings[0].house,'secluded');assert.equal(bookings[0].guests,4);assert.equal(bookings[0].source,'telegram');
    assert.match(replies.at(-1),/Заявка принята/);
    assert.match(replies.at(-1),/пожелания/);
    assert.equal(bookings[0].checkIn,'2099-05-20');
    await say('/skip');
    await say('Согласна');assert.equal(bookings.length,1);
  } finally {bot.stop();}
});
test('wishes are requested after dispatch and delivered as a linked addition',async()=>{
  const replies=[],bookings=[];
  const bot=startBot({async enqueue(booking){bookings.push(booking);}},{poll:false,ready:()=>true,async api(method,body){replies.push(body.text);}});
  const say=text=>bot.handle({chat:{id:123,type:'private'},text});
  try {
    for(const text of ['/book','1','20.05.2099','22.05.2099','2','Анна','+79027850002','Согласна'])await say(text);
    assert.equal(bookings.length,1);assert.match(replies.at(-1),/пожелания/);
    await say('x'.repeat(1001));assert.equal(bookings.length,1);
    await say('Хотим приехать с ребёнком, нужна детская кроватка.');
    assert.equal(bookings.length,2);assert.equal(bookings[1].kind,'wishes');assert.equal(bookings[1].parentId,bookings[0].id);
    assert.notEqual(bookings[1].id,bookings[0].id);assert.match(bookings[1].comment,/кроватка/);
    assert.match(replies.at(-1),/Пожелания приняты/);
    await say('Повтор');assert.equal(bookings.length,2);
  }finally{bot.stop();}
});
test('cancelling the wishes step does not claim the accepted booking is cancelled',async()=>{
  const replies=[],bookings=[];
  const bot=startBot({async enqueue(booking){bookings.push(booking);}},{poll:false,ready:()=>true,async api(method,body){replies.push(body.text);}});
  try {
    for(const text of ['/book','1','20.05.2099','22.05.2099','2','Анна','+79027850002','Согласна','/cancel'])await bot.handle({chat:{id:123,type:'private'},text});
    assert.equal(bookings.length,1);assert.match(replies.at(-1),/Основная заявка уже принята/);
  }finally{bot.stop();}
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
