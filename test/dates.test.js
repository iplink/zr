import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBookingDate, formatBookingDate } from '../public/dates.js';
import { bookingText } from '../server/booking.js';
test('accepts dotted dates and preserves day/month order',()=>{
  assert.equal(parseBookingDate('05.12.2027'),'2027-12-05');
  assert.equal(parseBookingDate('29.02.2028'),'2028-02-29');
  assert.equal(formatBookingDate('2027-12-05'),'05.12.2027');
});
test('rejects impossible dates and other input formats',()=>{
  for(const value of ['29.02.2027','31.04.2027','00.01.2027','01.13.2027','2027-12-05','5.12.2027','05/12/2027',null]) assert.equal(parseBookingDate(value),null);
});
test('notifications format stored ISO dates without changing booking data',()=>{
  const booking={id:'test',source:'website',house:'white',checkIn:'2027-12-05',checkOut:'2027-12-10',guests:2,name:'Анна',phone:'+79027850002'};
  assert.match(bookingText(booking),/Заезд: 05\.12\.2027\nВыезд: 10\.12\.2027/);
  assert.equal(booking.checkIn,'2027-12-05');
});
test('wishes notification refers to the original request',()=>{
  const text=bookingText({id:'addition',parentId:'original',kind:'wishes',source:'telegram',house:'white',checkIn:'2027-12-05',checkOut:'2027-12-10',guests:2,name:'Анна',phone:'+79027850002',comment:'Детская кроватка'});
  assert.match(text,/^Пожелания к заявке/);assert.match(text,/Номер заявки: original/);assert.match(text,/Номер дополнения: addition/);assert.match(text,/Детская кроватка/);
});
