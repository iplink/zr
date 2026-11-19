import { randomUUID } from 'node:crypto';
export const HOUSES = { white: { name: 'Белый дом', capacity: 8 }, secluded: { name: 'Уединённый', capacity: 4 }, bath: { name: 'Дом с баней', capacity: 4 } };
export function moscowToday() { return new Intl.DateTimeFormat('en-CA', { timeZone:'Europe/Moscow', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date()); }
export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}
export function validateBooking(data, today = moscowToday()) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Неверный формат заявки.');
  const house = Object.hasOwn(HOUSES, data.house) ? HOUSES[data.house] : null;
  if (!house) throw new Error('Выберите дом.');
  if (!validDate(data.checkIn) || !validDate(data.checkOut) || data.checkIn < today || data.checkOut <= data.checkIn) throw new Error('Проверьте даты: выезд должен быть позже заезда, заезд — не в прошлом.');
  const guests = Number(data.guests);
  if (!Number.isInteger(guests) || guests < 1 || guests > house.capacity) throw new Error(`В этом доме может разместиться до ${house.capacity} гостей.`);
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  if (name.length < 2 || name.length > 80 || /[\r\n\x00-\x1f]/.test(name)) throw new Error('Укажите имя от 2 до 80 символов.');
  const phone = typeof data.phone === 'string' ? data.phone.trim() : '';
  if (!/^[+\d\s()\-]{10,24}$/.test(phone) || !/^[78]\d{10}$/.test(phone.replace(/\D/g,''))) throw new Error('Укажите российский телефон: +7 и ещё 10 цифр.');
  if (data.consent !== true) throw new Error('Для отправки необходимо согласие на обработку данных.');
  const comment = typeof data.comment === 'string' ? data.comment.trim() : '';
  if (comment.length > 1000) throw new Error('Пожелания должны быть не длиннее 1000 символов.');
  return {id:randomUUID(), house:data.house, checkIn:data.checkIn, checkOut:data.checkOut, guests, name, phone, comment, consent:true, createdAt:new Date().toISOString()};
}
export function bookingText(booking) {
  return ['Новая заявка · Залив-Ретрит', `Номер: ${booking.id}`, `Источник: ${booking.source === 'telegram' ? 'Telegram-бот' : 'Сайт'}`, `Дом: ${HOUSES[booking.house].name}`, `Заезд: ${booking.checkIn}`, `Выезд: ${booking.checkOut}`, `Гостей: ${booking.guests}`, `Имя: ${booking.name}`, `Телефон: ${booking.phone}`, `Пожелания: ${booking.comment || '—'}`, 'Согласие на обработку данных: получено', 'Необходимо связаться с гостем и подтвердить условия.'].join('\n');
}
