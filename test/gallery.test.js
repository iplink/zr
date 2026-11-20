import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import vm from 'node:vm';

function fixture(directory, total, cover = 'exterior') {
  const listeners = new Map();
  const nodes = new Map([
    ['[data-gallery-image]', { src: `/images/${directory}/${cover}.webp` }],
    ['[data-gallery-count]', { textContent: `1 / ${total}` }],
    ['.gallery-controls', { hidden: true }],
  ]);
  for (const selector of ['[data-gallery-prev]', '[data-gallery-next]']) {
    nodes.set(selector, { addEventListener: (name, handler) => listeners.set(`${selector}:${name}`, handler) });
  }
  const gallery = {
    dataset: { gallery: directory },
    querySelector: selector => nodes.get(selector),
    addEventListener: (name, handler) => listeners.set(name, handler),
  };
  return { listeners, nodes, gallery };
}

for (const [directory, total, cover] of [['white-house', 12, 'bicycles'], ['secluded-house', 14, 'exterior'], ['bath-house', 5, 'terrace']]) {
test(`${directory} gallery navigates real photos, wraps and supports keyboard controls`, async () => {
  const { listeners, nodes, gallery } = fixture(directory, total, cover);
  const script = await readFile(new URL('../public/gallery.js', import.meta.url), 'utf8');
  vm.runInNewContext(script, { document: { querySelectorAll: () => [gallery] } });
  assert.equal(nodes.get('.gallery-controls').hidden, false);

  const image = nodes.get('[data-gallery-image]');
  const count = nodes.get('[data-gallery-count]');
  const first = image.src;
  const seen = new Set([first]);
  for (let i = 0; i < total; i++) {
    listeners.get('[data-gallery-next]:click')();
    assert.ok(image.alt.length > 10);
    assert.ok(image.width > 0 && image.height > 0);
    assert.ok(image.src.startsWith(`/images/${directory}/`));
    await access(new URL(`../public${image.src}`, import.meta.url));
    seen.add(image.src);
  }
  assert.equal(seen.size, total);
  assert.equal(image.src, first);
  assert.equal(count.textContent, `1 / ${total}`);
  listeners.get('[data-gallery-prev]:click')();
  assert.equal(count.textContent, `${total} / ${total}`);

  for (const [key, expected] of [['Home', `1 / ${total}`], ['ArrowRight', `2 / ${total}`], ['ArrowLeft', `1 / ${total}`], ['End', `${total} / ${total}`]]) {
    let prevented = false;
    listeners.get('keydown')({ key, preventDefault: () => { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(count.textContent, expected);
  }
  let prevented = false;
  listeners.get('keydown')({ key: 'Tab', preventDefault: () => { prevented = true; } });
  assert.equal(prevented, false);
});
}

test('switching one house does not change the other gallery', async () => {
  const white = fixture('white-house', 12, 'bicycles');
  const secluded = fixture('secluded-house', 14);
  const bath = fixture('bath-house', 5, 'terrace');
  const script = await readFile(new URL('../public/gallery.js', import.meta.url), 'utf8');
  vm.runInNewContext(script, { document: { querySelectorAll: () => [white.gallery, secluded.gallery, bath.gallery] } });
  secluded.listeners.get('[data-gallery-next]:click')();
  assert.equal(white.nodes.get('[data-gallery-count]').textContent, '1 / 12');
  assert.equal(secluded.nodes.get('[data-gallery-count]').textContent, '2 / 14');
  assert.equal(bath.nodes.get('[data-gallery-count]').textContent, '1 / 5');
  bath.listeners.get('[data-gallery-next]:click')();
  assert.equal(bath.nodes.get('[data-gallery-count]').textContent, '2 / 5');
  assert.equal(secluded.nodes.get('[data-gallery-count]').textContent, '2 / 14');
});
