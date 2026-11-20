import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createOutbox } from '../server/delivery.js';
test('persists requests and retries only the failed delivery channel after restart',async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'zaliv-test-'));
  const previous={...process.env};
  Object.assign(process.env,{DATA_DIR:directory,SMTP_HOST:'test',SMTP_USER:'test',SMTP_PASS:'test',SMTP_FROM:'test@example.com',EMAIL_TO:'test@example.com',TELEGRAM_BOT_TOKEN:'test',TELEGRAM_ADMIN_CHAT_ID:'1'});
  let emails=0;let telegrams=0;let fail=true;
  const options={autoDrain:false,transport:{async sendMail(){emails++;},close(){}},async telegram(){telegrams++;if(fail)throw new Error('simulated outage');}};
  let outbox;
  try {
    outbox=await createOutbox(options);
    await outbox.enqueue({id:'test-booking',house:'white',checkIn:'2027-02-10',checkOut:'2027-02-11',guests:2,name:'Анна',phone:'+79027850002',comment:'',source:'website'});
    assert.equal((await readdir(directory)).filter(x=>x.endsWith('.json')).length,1);
    await outbox.drain();
    const file=path.join(directory,'test-booking.json');
    const pending=JSON.parse(await readFile(file,'utf8'));
    assert.equal(pending.email,true);assert.equal(pending.telegram,false);assert.equal(emails,1);
    outbox.close();
    pending.retryAt=0;await writeFile(file,JSON.stringify(pending));fail=false;
    outbox=await createOutbox(options);
    await outbox.drain();
    assert.equal(emails,1);assert.equal(telegrams,2);assert.equal((await readdir(directory)).length,0);
  } finally {
    outbox?.close();
    for(const key of Object.keys(process.env)) if(!(key in previous)) delete process.env[key];
    Object.assign(process.env,previous);
    await rm(directory,{recursive:true,force:true});
  }
});
test('MAX failure retains only that pending channel and captures the recipient',async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'zaliv-delivery-max-')),previous={...process.env};
  Object.assign(process.env,{DATA_DIR:directory,SMTP_HOST:'test',SMTP_USER:'test',SMTP_PASS:'test',SMTP_FROM:'test@example.com',EMAIL_TO:'test@example.com',TELEGRAM_BOT_TOKEN:'test',TELEGRAM_ADMIN_CHAT_ID:'1',MAX_BOT_TOKEN:'test',MAX_ADMIN_CHAT_ID:'12'});
  let emails=0,telegrams=0,maxes=0,fail=true,outbox;
  try{
    outbox=await createOutbox({autoDrain:false,transport:{async sendMail(){emails++;},close(){}},async telegram(){telegrams++;},async max(chat,text){assert.equal(chat,'12');assert.match(text,/Белый дом/);maxes++;if(fail)throw Error('Simulated MAX outage');}});
    await outbox.enqueue({id:'max-test-booking',house:'white',checkIn:'2027-02-10',checkOut:'2027-02-11',guests:2,name:'Анна',phone:'+79027850002',comment:'',source:'max'});
    await outbox.drain();const file=path.join(directory,'max-test-booking.json');const record=JSON.parse(await readFile(file,'utf8'));
    assert.equal(record.email,true);assert.equal(record.telegram,true);assert.equal(record.max,false);assert.equal(record.maxChatId,'12');
    record.retryAt=0;await writeFile(file,JSON.stringify(record));fail=false;process.env.MAX_ADMIN_CHAT_ID='99';await outbox.drain();
    assert.equal(emails,1);assert.equal(telegrams,1);assert.equal(maxes,2);assert.equal((await readdir(directory)).length,0);
  }finally{outbox?.close();for(const key of Object.keys(process.env))if(!(key in previous))delete process.env[key];Object.assign(process.env,previous);await rm(directory,{recursive:true,force:true});}
});
