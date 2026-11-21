import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import vm from 'node:vm';

test('house pages link real photos, other houses and the matching booking form', async () => {
  const home = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  for (const [slug, id, total] of [['white-house', 'white', 12], ['secluded-house', 'secluded', 14], ['bath-house', 'bath', 5]]) {
    const html = await readFile(new URL(`../public/houses/${slug}.html`, import.meta.url), 'utf8');
    assert.equal((home.match(new RegExp(`href="/houses/${slug}.html"`, 'g')) || []).length, 2, 'photo and description both link to the house page');
    assert.ok(html.includes(`href="/?house=${id}#booking"`));
    assert.equal((html.match(/class="photo-tile"/g) || []).length, total);
    for (const label of ['Площадь дома', 'Количество комнат', 'Спальных мест', 'Количество этажей', 'Стиль интерьера', 'Высота потолков', 'Камин', 'Тёплый пол', 'Бытовая техника']) assert.ok(html.includes(label), label);
    for (const [, src] of html.matchAll(/src="(\/images\/[^"?]+)"/g)) await access(new URL(`../public${src}`, import.meta.url));
    assert.equal((html.match(/<h1>/g) || []).length, 1);
    assert.ok(html.includes('</head><body class="house-page">'));
    assert.ok(!/<a\b[^>]*>(?:(?!<\/a>)[\s\S])*<a\b/.test(html), 'links are not nested');
  }
});

test('published details have complete facts and keep sleeping places separate from booking capacity', async () => {
  const { HOUSES } = await import('../server/booking.js');
  const houses = JSON.parse(await readFile(new URL('../content/houses.json', import.meta.url), 'utf8'));
  for (const house of houses) {
    assert.equal(house.guests, HOUSES[house.bookingId].capacity);
    assert.ok(house.sleepingPlaces >= house.guests);
    const html = await readFile(new URL(`../public/houses/${house.slug}.html`, import.meta.url), 'utf8');
    assert.ok(!html.includes('Уточняется'));
    assert.ok(!html.includes('content="noindex"'));
    assert.ok(html.includes(`от ${house.price} рублей`));
    assert.ok(html.includes('Индукционная варочная панель'));
    if (house.slug === 'bath-house') {
      assert.ok(html.includes('Духовка'));
      assert.ok(html.includes('Растопка бани включена.'));
      assert.ok(html.includes('Растопка чана оплачивается отдельно по желанию.'));
    }
  }
});

test('house booking links preselect the house and enforce its guest capacity', async () => {
  const script = (await readFile(new URL('../public/app.js', import.meta.url), 'utf8')).replace(/^import[^\n]+\n/, '');
  for (const [id, limit] of [['white', 8], ['secluded', 4], ['bath', 4], ['invalid', null]]) {
    const input = () => ({ value: '', addEventListener() {} });
    const elements = { checkIn: input(), checkOut: input(), house: input(), guests: { ...input(), options: Array.from({ length: 9 }, (_, index) => ({ value: index ? String(index) : '' })) } };
    const form = { elements, addEventListener() {} };
    const document = { querySelector: selector => selector === '#booking-form' ? form : {}, querySelectorAll: () => [] };
    vm.runInNewContext(script, { document, window: { location: { search: `?house=${id}` } }, URLSearchParams });
    assert.equal(elements.house.value, limit === null ? '' : id);
    if (limit !== null) for (const option of elements.guests.options) if (option.value) assert.equal(option.disabled, Number(option.value) > limit);
  }
});

for (const extra of [0, 2]) {
test(`photo viewer opens, navigates and restores focus with ${extra} section photos`, async () => {
  const listeners = new Map();
  const nodes = new Map();
  for (const selector of ['[data-photo-full]', '[data-photo-counter]', '[data-photo-caption]', '[data-photo-close]', '[data-photo-prev]', '[data-photo-next]']) nodes.set(selector, { addEventListener: (name, handler) => listeners.set(`${selector}:${name}`, handler) });
  const dialog = { querySelector: selector => nodes.get(selector), addEventListener: (name, handler) => listeners.set(`dialog:${name}`, handler), showModal() { this.open = true; }, close() { this.open = false; listeners.get('dialog:close')(); } };
  const total = 3 + extra;
  const links = Array.from({ length: total }, (_, index) => ({ dataset: { photoIndex: String(index) }, querySelector: () => ({ getAttribute: () => `/photo-${index}.webp`, alt: `Фото ${index}`, width: 1600, height: 1200 }), addEventListener: (name, handler) => listeners.set(`photo-${index}:${name}`, handler), focus() { this.focused = true; } }));
  const classes = new Set();
  const document = { querySelector: selector => selector === '.photo-dialog' ? dialog : {}, querySelectorAll: selector => selector === '.photo-tile' ? links.slice(0, 3) : selector === '.section-photo' ? links.slice(3) : links, body: { classList: { add: name => classes.add(name), remove: name => classes.delete(name) } } };
  const script = await readFile(new URL('../public/house.js', import.meta.url), 'utf8');
  vm.runInNewContext(script, { document });
  let prevented = false;
  listeners.get('photo-1:click')({ button: 0, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(dialog.open, true);
  assert.equal(nodes.get('[data-photo-full]').src, '/photo-1.webp');
  assert.equal(nodes.get('[data-photo-counter]').textContent, `2 / ${total}`);
  for (let i = 1; i < total; i++) listeners.get('[data-photo-next]:click')();
  assert.equal(nodes.get('[data-photo-counter]').textContent, `1 / ${total}`);
  listeners.get('dialog:keydown')({ key: 'End', preventDefault() {} });
  assert.equal(nodes.get('[data-photo-counter]').textContent, `${total} / ${total}`);
  listeners.get('[data-photo-close]:click')();
  assert.equal(dialog.open, false);
  assert.equal(classes.size, 0);
  assert.equal(links[1].focused, true);
  prevented = false;
  listeners.get('photo-1:click')({ button: 0, ctrlKey: true, preventDefault() { prevented = true; } });
  assert.equal(prevented, false, 'modified clicks keep native browser behavior');
  if (extra) {
    listeners.get(`photo-${total - 1}:click`)({ button: 0, preventDefault() {} });
    assert.equal(nodes.get('[data-photo-full]').src, `/photo-${total - 1}.webp`);
    assert.equal(nodes.get('[data-photo-counter]').textContent, `${total} / ${total}`);
    listeners.get('[data-photo-close]:click')();
    assert.equal(links[total - 1].focused, true);
  }
});
}
