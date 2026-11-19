import { HOUSES, validateBooking, validDate, moscowToday } from './booking.js';
import { telegram, configured } from './delivery.js';
const steps = ['house','checkIn','checkOut','guests','name','phone','consent'];
const prompts = {house:'Какой дом выберете?\n1 — Белый дом, 200 м², до 8 гостей\n2 — Уединённый, 100 м², до 4 гостей\n3 — Дом с баней, 65 м², до 4 гостей\n\nОтправьте 1, 2 или 3.',checkIn:'Дата заезда? Формат: ГГГГ-ММ-ДД.',checkOut:'Дата выезда? Формат: ГГГГ-ММ-ДД.',guests:'Сколько будет гостей? Укажите число, включая детей.',name:'Как к вам обращаться?',phone:'Укажите телефон в формате +79027850002.',consent:'Для ответа на заявку имя, телефон, даты и сведения о размещении будут отправлены администратору на почту и в Telegram. Подробнее: https://zaliv-retreat.ru/privacy.html\n\nОтправьте «Согласен», если согласны на обработку этих данных, или /cancel для отмены.'};
export function startBot(outbox) {
  const sessions = new Map(); let stopped = false; let offset = 0;
  const send = (id,text) => telegram('sendMessage',{chat_id:id,text});
  async function handle(message) {
    if (!message?.text || message.chat.type !== 'private') return;
    const id = message.chat.id; const text = message.text.trim();
    if (text === '/id') { await send(id,`Ваш chat_id: ${id}\nДля уведомлений администратору укажите его в TELEGRAM_ADMIN_CHAT_ID.`); return; }
    if (text === '/cancel') { sessions.delete(id); await send(id,'Заявка отменена. Начать заново: /book'); return; }
    if (text === '/start' || text === '/help') { await send(id,'Добро пожаловать в Залив-Ретрит 🌲\nТри авторских дома в хвойном лесу рядом с Горьковским водохранилищем.\n\n/book — оставить заявку\n/cancel — отменить заполнение\n/id — узнать номер чата\n\nСайт: https://zaliv-retreat.ru\nТелефон: +7 902 785-00-02\nБронирование подтверждает администратор.'); return; }
    if (text === '/book') {
      if (!configured()) { await send(id,'Приём заявок в боте пока подключается. Позвоните +7 902 785-00-02 или напишите vi-kate@mail.ru.'); return; }
      if (sessions.size >= 1000 && !sessions.has(id)) { await send(id,'Сервис временно занят. Позвоните +7 902 785-00-02.'); return; }
      sessions.set(id,{step:0,data:{},updated:Date.now()}); await send(id,prompts.house); return;
    }
    const session = sessions.get(id);
    if (!session) { await send(id,'Чтобы оставить заявку на отдых, отправьте /book.'); return; }
    const field = steps[session.step];
    if (field === 'house') {
      const key = ({'1':'white','2':'secluded','3':'bath'})[text];
      if (!key) { await send(id,prompts.house); return; } session.data.house = key;
    } else if (field === 'consent') {
      if (!/^соглас(ен|на)$/i.test(text)) { await send(id,'Для отправки напишите «Согласен» или /cancel для отмены.'); return; }
      session.data.consent = true;
      try {
        const booking = {...validateBooking(session.data),source:'telegram'};
        await outbox.enqueue(booking); sessions.delete(id);
        await send(id,'Спасибо! Заявка принята. Администратор свяжется с вами, чтобы уточнить стоимость и подтвердить бронирование.');
      } catch (error) {
        sessions.delete(id);
        await send(id, error.message === 'NOT_CONFIGURED' ? 'Приём заявок временно недоступен. Позвоните +7 902 785-00-02.' : `Не удалось принять заявку. ${error.message}\nНачните снова: /book. Или позвоните +7 902 785-00-02.`);
      }
      return;
    } else {
      if (text.length > (field === 'name' ? 80 : 24)) { await send(id,'Слишком длинный ответ. Попробуйте ещё раз.'); return; }
      if ((field === 'checkIn' || field === 'checkOut') && !validDate(text)) { await send(id,'Введите существующую дату в формате ГГГГ-ММ-ДД.'); return; }
      if (field === 'checkIn' && text < moscowToday()) { await send(id,'Заезд не может быть в прошлом. Введите другую дату.'); return; }
      if (field === 'checkOut' && text <= session.data.checkIn) { await send(id,'Выезд должен быть позже заезда. Введите другую дату.'); return; }
      if (field === 'name' && (text.length < 2 || /[\r\n\x00-\x1f]/.test(text))) { await send(id,'Укажите имя от 2 до 80 символов.'); return; }
      if (field === 'phone' && (!/^[+\d\s()\-]{10,24}$/.test(text) || !/^[78]\d{10}$/.test(text.replace(/\D/g,'')))) { await send(id,'Укажите российский телефон: +7 и ещё 10 цифр.'); return; }
      if (field === 'guests' && (!/^\d+$/.test(text) || Number(text)<1 || Number(text)>HOUSES[session.data.house].capacity)) { await send(id,`Для этого дома укажите от 1 до ${HOUSES[session.data.house].capacity} гостей.`); return; }
      session.data[field] = text;
    }
    session.step++; session.updated = Date.now();
    if (steps[session.step] === 'consent') {
      const d = session.data;
      await send(id,`Проверьте заявку:\n${HOUSES[d.house].name}\nЗаезд: ${d.checkIn}\nВыезд: ${d.checkOut}\nГостей: ${d.guests}\nИмя: ${d.name}\nТелефон: ${d.phone}\n\n${prompts.consent}`);
    } else await send(id,prompts[steps[session.step]]);
  }
  const cleanup = setInterval(() => { for (const [id,s] of sessions) if (Date.now()-s.updated>1800000) sessions.delete(id); },60000); cleanup.unref();
  async function poll() {
    while (!stopped) {
      try {
        const messages = await telegram('getUpdates',{offset,timeout:25,allowed_updates:['message']});
        for (const update of messages) {
          // A failed reply must not cause duplicate booking creation on the next poll.
          offset = update.update_id + 1;
          try { await handle(update.message); } catch { console.error('Bot message handling failed'); }
        }
      } catch { console.error('Bot polling failed; retrying'); await new Promise(resolve => setTimeout(resolve,5000)); }
    }
  }
  void poll();
  return () => { stopped = true; clearInterval(cleanup); sessions.clear(); };
}
