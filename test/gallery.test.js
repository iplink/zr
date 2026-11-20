import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import vm from 'node:vm';

test('house gallery navigates six real photos, wraps and supports keyboard controls', async () => {
  const listeners = new Map();
  const nodes = new Map([
    ['[data-gallery-image]', { src: '/images/white-house/exterior.webp' }],
    ['[data-gallery-count]', { textContent: '1 / 6' }],
    ['.gallery-controls', { hidden: true }],
  ]);
  for (const selector of ['[data-gallery-prev]', '[data-gallery-next]']) {
    nodes.set(selector, { addEventListener: (name, handler) => listeners.set(`${selector}:${name}`, handler) });
  }
  const gallery = {
    dataset: { gallery: 'white' },
    querySelector: selector => nodes.get(selector),
    addEventListener: (name, handler) => listeners.set(name, handler),
  };
  const script = await readFile(new URL('../public/gallery.js', import.meta.url), 'utf8');
  vm.runInNewContext(script, { document: { querySelectorAll: () => [gallery] } });
  assert.equal(nodes.get('.gallery-controls').hidden, false);

  const image = nodes.get('[data-gallery-image]');
  const count = nodes.get('[data-gallery-count]');
  const first = image.src;
  const seen = new Set([first]);
  for (let i = 0; i < 6; i++) {
    listeners.get('[data-gallery-next]:click')();
    assert.ok(image.alt.length > 10);
    assert.ok(image.width > 0 && image.height > 0);
    await access(new URL(`../public${image.src}`, import.meta.url));
    seen.add(image.src);
  }
  assert.equal(seen.size, 6);
  assert.equal(image.src, first);
  assert.equal(count.textContent, '1 / 6');
  listeners.get('[data-gallery-prev]:click')();
  assert.equal(count.textContent, '6 / 6');

  for (const [key, expected] of [['Home', '1 / 6'], ['ArrowRight', '2 / 6'], ['ArrowLeft', '1 / 6'], ['End', '6 / 6']]) {
    let prevented = false;
    listeners.get('keydown')({ key, preventDefault: () => { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(count.textContent, expected);
  }
  let prevented = false;
  listeners.get('keydown')({ key: 'Tab', preventDefault: () => { prevented = true; } });
  assert.equal(prevented, false);
});
