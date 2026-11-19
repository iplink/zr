import { HOUSES, validateBooking, moscowToday } from './booking.js';
import { parseBookingDate, formatBookingDate } from '../public/dates.js';
import { randomUUID } from 'node:crypto';
import { telegram, configured } from './delivery.js';
const steps = ['house','checkIn','checkOut','guests','name','phone','consent','comment'];
const wishesPrompt = 'Есть ли у вас пожелания к отдыху? Напишите их одним сообщением — мы передадим администратору. Если пожеланий нет, отправьте /skip.';
const prompts = {house:'Какой дом выберете?\n1 — Белый дом, 200 м², до 8 гостей\n2 — Уединённый, 100 м², до 4 гостей\n3 — Дом с баней, 65 м², до 4 гостей\n\nОтправьте 1, 2 или 3.',checkIn:'Дата заезда? Формат: ДД.ММ.ГГГГ.',checkOut:'Дата выезда? Формат: ДД.ММ.ГГГГ.',guests:'Сколько будет гостей? Укажите число, включая детей.',name:'Как к вам обращаться?',phone:'Укажите телефон в формате +79027850002.',consent:'Для ответа на заявку имя, телефон, даты и сведения о размещении будут отправлены администратору на почту и в Telegram. Подробнее: https://zaliv-retreat.ru/privacy.html\n\nОтправьте «Согласен», если согласны на обработку этих данных, или /cancel для отмены.'};
export function startBot(outbox, options = {}) {
  const api = options.api || telegram;
  const ready = options.ready || configured;
  const sessions = new Map(); let stopped = false; let offset = 0;
  const send = (id,text) => api('sendMessage',{chat_id:id,text});
  async function handle(message) {
    if (!message?.text || message.chat.type !== 'private') return;
    const id = message.chat.id; const text = message.text.trim();
    if (text === '/id') { await send(id,`Ваш chat_id: ${id}\nДля уведомлений администратору укажите его в TELEGRAM_ADMIN_CHAT_ID.`); return; }
    if (text === '/cancel') { const accepted = sessions.get(id)?.step === steps.indexOf('comment'); sessions.delete(id); await send(id,accepted ? 'Основная заявка уже принята. Дополнительные пожелания не добавлены.' : 'Заявка отменена. Начать заново: /book'); return; }
    if (text === '/start' || text === '/help') { await send(id,'Добро пожаловать в Залив-Ретрит 🌲\nТри авторских дома в хвойном лесу рядом с Горьковским водохранилищем.\n\n/book — оставить заявку\n/cancel — отменить заполнение\n/id — узнать номер чата\n\nСайт: https://zaliv-retreat.ru\nТелефон: +7 902 785-00-02\nБронирование подтверждает администратор.'); return; }
    if (text === '/book') {
      if (!ready()) { await send(id,'Приём заявок в боте пока подключается. Позвоните +7 902 785-00-02 или напишите vi-kate@mail.ru.'); return; }
      if (sessions.size >= 1000 && !sessions.has(id)) { await send(id,'Сервис временно занят. Позвоните +7 902 785-00-02.'); return; }
      sessions.set(id,{step:0,data:{},updated:Date.now()}); await send(id,prompts.house); return;
    }
    const session = sessions.get(id);
    if (!session) { await send(id,'Чтобы оставить заявку на отдых, отправьте /book.'); return; }
    const field = steps[session.step];
    if (field === 'comment') {
      if (text === '/skip') { sessions.delete(id); await send(id,'Хорошо, заявка остаётся без дополнительных пожеланий. Администратор свяжется с вами.'); return; }
      if (!text || text.length > 1000 || text.startsWith('/')) { await send(id,'Напишите пожелания одним сообщением до 1000 символов или отправьте /skip.'); return; }
      try {
        const addition = {...session.data,id:randomUUID(),parentId:session.data.id,kind:'wishes',comment:text,createdAt:new Date().toISOString()};
        await outbox.enqueue(addition); sessions.delete(id);
        await send(id,'Пожелания приняты и добавлены к вашей заявке. Спасибо!');
      } catch { await send(id,'Не удалось сохранить пожелания. Отправьте их ещё раз или позвоните +7 902 785-00-02. Основная заявка уже принята.'); }
      return;
    } else if (field === 'house') {
      const key = ({'1':'white','2':'secluded','3':'bath'})[text];
      if (!key) { await send(id,prompts.house); return; } session.data.house = key;
    } else if (field === 'consent') {
      if (!/^соглас(ен|на)$/i.test(text)) { await send(id,'Для отправки напишите «Согласен» или /cancel для отмены.'); return; }
      session.data.consent = true;
      try {
        const booking = {...validateBooking(session.data),source:'telegram'};
        await outbox.enqueue(booking);
        sessions.set(id,{step:steps.indexOf('comment'),data:booking,updated:Date.now()});
        await send(id,`Спасибо! Заявка принята. Администратор свяжется с вами, чтобы уточнить стоимость и подтвердить бронирование.\n\n${wishesPrompt}`);
      } catch (error) {
        sessions.delete(id);
        await send(id, error.message === 'NOT_CONFIGURED' ? 'Приём заявок временно недоступен. Позвоните +7 902 785-00-02.' : `Не удалось принять заявку. ${error.message}\nНачните снова: /book. Или позвоните +7 902 785-00-02.`);
      }
      return;
    } else {
      if (text.length > (field === 'name' ? 80 : 24)) { await send(id,'Слишком длинный ответ. Попробуйте ещё раз.'); return; }
      const value = field === 'checkIn' || field === 'checkOut' ? parseBookingDate(text) : text;
      if (value === null) { await send(id,'Введите существующую дату в формате ДД.ММ.ГГГГ.'); return; }
      if (field === 'checkIn' && value < moscowToday()) { await send(id,'Заезд не может быть в прошлом. Введите другую дату.'); return; }
      if (field === 'checkOut' && value <= session.data.checkIn) { await send(id,'Выезд должен быть позже заезда. Введите другую дату.'); return; }
      if (field === 'name' && (text.length < 2 || /[\r\n\x00-\x1f]/.test(text))) { await send(id,'Укажите имя от 2 до 80 символов.'); return; }
      if (field === 'phone' && (!/^[+\d\s()\-]{10,24}$/.test(text) || !/^[78]\d{10}$/.test(text.replace(/\D/g,'')))) { await send(id,'Укажите российский телефон: +7 и ещё 10 цифр.'); return; }
      if (field === 'guests' && (!/^\d+$/.test(text) || Number(text)<1 || Number(text)>HOUSES[session.data.house].capacity)) { await send(id,`Для этого дома укажите от 1 до ${HOUSES[session.data.house].capacity} гостей.`); return; }
      session.data[field] = value;
    }
    session.step++; session.updated = Date.now();
    if (steps[session.step] === 'consent') {
      const d = session.data;
      await send(id,`Проверьте заявку:\n${HOUSES[d.house].name}\nЗаезд: ${formatBookingDate(d.checkIn)}\nВыезд: ${formatBookingDate(d.checkOut)}\nГостей: ${d.guests}\nИмя: ${d.name}\nТелефон: ${d.phone}\n\n${prompts.consent}`);
    } else await send(id,prompts[steps[session.step]]);
  }
  const cleanup = setInterval(() => { for (const [id,s] of sessions) if (Date.now()-s.updated>1800000) sessions.delete(id); },60000); cleanup.unref();
  async function poll() {
    while (!stopped) {
      try {
        const messages = await api('getUpdates',{offset,timeout:25,allowed_updates:['message']});
        for (const update of messages) {
          // A failed reply must not cause duplicate booking creation on the next poll.
          offset = update.update_id + 1;
          try { await handle(update.message); } catch { console.error('Bot message handling failed'); }
        }
      } catch { console.error('Bot polling failed; retrying'); await new Promise(resolve => setTimeout(resolve,5000)); }
    }
  }
  if (options.poll !== false) void poll();
  return {handle, stop() { stopped = true; clearInterval(cleanup); sessions.clear(); }};
}
