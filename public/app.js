import { parseBookingDate } from './dates.js';
const form = document.querySelector('#booking-form');
const status = document.querySelector('#form-status');
const dateString = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
function validateDates() {
  const checkIn = parseBookingDate(form.elements.checkIn.value);
  const checkOut = parseBookingDate(form.elements.checkOut.value);
  const message = 'Введите существующую дату в формате ДД.ММ.ГГГГ.';
  form.elements.checkIn.setCustomValidity(form.elements.checkIn.value && !checkIn ? message : checkIn && checkIn < dateString(new Date()) ? 'Заезд не может быть в прошлом.' : '');
  form.elements.checkOut.setCustomValidity(form.elements.checkOut.value && !checkOut ? message : checkIn && checkOut && checkOut <= checkIn ? 'Выезд должен быть позже заезда.' : '');
}
for (const name of ['checkIn','checkOut']) form.elements[name].addEventListener('input', event => {
  const input = event.target;
  if (!event.inputType?.startsWith('delete') && /^[\d.]*$/.test(input.value)) {
    const before = input.value.slice(0,input.selectionStart).replace(/\D/g,'').length;
    const digits = input.value.replace(/\D/g,'').slice(0,8);
    const formatted = [digits.slice(0,2),digits.slice(2,4),digits.slice(4,8)].filter(Boolean).join('.');
    if (formatted !== input.value) {
      input.value = formatted;
      let cursor = 0, count = 0;
      while (cursor < formatted.length && count < before) { if (/\d/.test(formatted[cursor])) count++; cursor++; }
      input.setSelectionRange(cursor,cursor);
    }
  }
  validateDates();
});
document.querySelector('#year').textContent = new Date().getFullYear();
function updateCapacity() {
  const max = form.elements.house.value === 'white' ? 8 : 4;
  for (const option of form.elements.guests.options) if (option.value) option.disabled = Number(option.value) > max;
  if (Number(form.elements.guests.value) > max) form.elements.guests.value = String(max);
}
form.elements.house.addEventListener('change', updateCapacity);
const requestedHouse = new URLSearchParams(window.location.search).get('house');
if (['white', 'secluded', 'bath'].includes(requestedHouse)) {
  form.elements.house.value = requestedHouse;
  updateCapacity();
}
document.querySelectorAll('.choose-house').forEach(button => button.addEventListener('click', () => {
  form.elements.house.value = button.dataset.house; updateCapacity();
  document.querySelector('#booking').scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
  form.elements.checkIn.focus({preventScroll:true});
}));
form.addEventListener('submit', async event => {
  event.preventDefault();
  validateDates();
  if (!form.reportValidity()) return;
  const button = form.querySelector('[type=submit]');
  button.disabled = true; status.className = 'form-status'; status.textContent = 'Отправляем заявку…';
  try {
    const data = Object.fromEntries(new FormData(form));
    data.checkIn = parseBookingDate(data.checkIn);
    data.checkOut = parseBookingDate(data.checkOut);
    data.consent = form.elements.consent.checked;
    const response = await fetch('/api/booking', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Не удалось отправить заявку. Позвоните +7 902 785-00-02.');
    status.classList.add('success'); status.textContent = 'Заявка принята! Мы свяжемся с вами для уточнения стоимости и подтверждения бронирования.';
    form.reset(); updateCapacity(); validateDates();
  } catch (error) {
    status.classList.add('error'); status.textContent = error instanceof TypeError ? 'Нет связи с сервером. Попробуйте ещё раз или позвоните +7 902 785-00-02.' : error.message;
  } finally { button.disabled = false; }
});
