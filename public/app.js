const form = document.querySelector('#booking-form');
const status = document.querySelector('#form-status');
const dateString = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const tomorrow = value => { const date = new Date(`${value}T12:00:00`); date.setDate(date.getDate()+1); return dateString(date); };
const today = dateString(new Date());
form.elements.checkIn.min = today;
form.elements.checkOut.min = tomorrow(today);
document.querySelector('#year').textContent = new Date().getFullYear();
function updateCapacity() {
  const max = form.elements.house.value === 'white' ? 8 : 4;
  for (const option of form.elements.guests.options) if (option.value) option.disabled = Number(option.value) > max;
  if (Number(form.elements.guests.value) > max) form.elements.guests.value = String(max);
}
form.elements.house.addEventListener('change', updateCapacity);
form.elements.checkIn.addEventListener('change', () => {
  if (!form.elements.checkIn.value) return;
  form.elements.checkOut.min = tomorrow(form.elements.checkIn.value);
  if (form.elements.checkOut.value <= form.elements.checkIn.value) form.elements.checkOut.value = '';
});
document.querySelectorAll('.choose-house').forEach(button => button.addEventListener('click', () => {
  form.elements.house.value = button.dataset.house; updateCapacity();
  document.querySelector('#booking').scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
  form.elements.checkIn.focus({preventScroll:true});
}));
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const button = form.querySelector('[type=submit]');
  button.disabled = true; status.className = 'form-status'; status.textContent = 'Отправляем заявку…';
  try {
    const data = Object.fromEntries(new FormData(form));
    data.consent = form.elements.consent.checked;
    const response = await fetch('/api/booking', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Не удалось отправить заявку. Позвоните +7 902 785-00-02.');
    status.classList.add('success'); status.textContent = 'Заявка принята! Мы свяжемся с вами для уточнения стоимости и подтверждения бронирования.';
    form.reset(); updateCapacity(); form.elements.checkOut.min = tomorrow(today);
  } catch (error) {
    status.classList.add('error'); status.textContent = error instanceof TypeError ? 'Нет связи с сервером. Попробуйте ещё раз или позвоните +7 902 785-00-02.' : error.message;
  } finally { button.disabled = false; }
});
