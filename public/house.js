const dialog = document.querySelector('.photo-dialog');
const photos = [...document.querySelectorAll('.photo-tile'), ...document.querySelectorAll('.section-photo')].map(link => {
  const image = link.querySelector('img');
  return { src: image.getAttribute('src'), alt: image.alt, width: image.width, height: image.height };
});
const full = dialog.querySelector('[data-photo-full]');
const counter = dialog.querySelector('[data-photo-counter]');
const caption = dialog.querySelector('[data-photo-caption]');
let current = 0;
let trigger;

function show(index) {
  current = (index + photos.length) % photos.length;
  const photo = photos[current];
  full.src = photo.src;
  full.alt = photo.alt;
  full.width = photo.width;
  full.height = photo.height;
  counter.textContent = `${current + 1} / ${photos.length}`;
  caption.textContent = photo.alt;
}

for (const link of document.querySelectorAll('[data-photo-index]')) {
  link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    if (typeof dialog.showModal !== 'function') return;
    event.preventDefault();
    trigger = link;
    show(Number(link.dataset.photoIndex));
    dialog.showModal();
    document.body.classList.add('photo-open');
  });
}
dialog.querySelector('[data-photo-close]').addEventListener('click', () => dialog.close());
dialog.querySelector('[data-photo-prev]').addEventListener('click', () => show(current - 1));
dialog.querySelector('[data-photo-next]').addEventListener('click', () => show(current + 1));
dialog.addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  show(event.key === 'Home' ? 0 : event.key === 'End' ? photos.length - 1 : current + (event.key === 'ArrowLeft' ? -1 : 1));
});
dialog.addEventListener('close', () => {
  document.body.classList.remove('photo-open');
  trigger?.focus({ preventScroll: true });
});
document.querySelector('#year').textContent = new Date().getFullYear();
