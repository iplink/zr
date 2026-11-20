const galleries = {
  white: [
    ['exterior', 'Белый дом среди сосен: фасад, лужайка и стол для настольного тенниса', 720, 960],
    ['table-tennis', 'Стол для настольного тенниса на участке Белого дома', 1280, 960],
    ['dining', 'Сервировка стола у окна в Белом доме', 720, 960],
    ['sunset-shore', 'Собака на берегу водохранилища на закате', 1280, 960],
    ['beach-walk', 'Прогулка с собакой по песчаному берегу водохранилища', 1280, 960],
    ['evening-walk', 'Вечерняя прогулка с собакой среди деревьев', 720, 960],
  ],
};

for (const gallery of document.querySelectorAll('[data-gallery]')) {
  const photos = galleries[gallery.dataset.gallery];
  if (!photos?.length) continue;
  const image = gallery.querySelector('[data-gallery-image]');
  const count = gallery.querySelector('[data-gallery-count]');
  let index = 0;

  function show(next) {
    index = (next + photos.length) % photos.length;
    const [file, alt, width, height] = photos[index];
    image.alt = alt;
    image.width = width;
    image.height = height;
    image.src = `/images/white-house/${file}.webp`;
    count.textContent = `${index + 1} / ${photos.length}`;
  }

  gallery.querySelector('[data-gallery-prev]').addEventListener('click', () => show(index - 1));
  gallery.querySelector('[data-gallery-next]').addEventListener('click', () => show(index + 1));
  gallery.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    show(event.key === 'Home' ? 0 : event.key === 'End' ? photos.length - 1 : index + (event.key === 'ArrowLeft' ? -1 : 1));
  });
  gallery.querySelector('.gallery-controls').hidden = false;
}
