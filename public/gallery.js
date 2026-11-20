const galleries = {
  'white-house': [
    ['exterior', 'Белый дом среди сосен: фасад, лужайка и стол для настольного тенниса', 720, 960],
    ['table-tennis', 'Стол для настольного тенниса на участке Белого дома', 1280, 960],
    ['dining', 'Сервировка стола у окна в Белом доме', 720, 960],
    ['sunset-shore', 'Собака на берегу водохранилища на закате', 1280, 960],
    ['beach-walk', 'Прогулка с собакой по песчаному берегу водохранилища', 1280, 960],
    ['evening-walk', 'Вечерняя прогулка с собакой среди деревьев', 720, 960],
  ],
  'secluded-house': [
  [
    "exterior",
    "Уединённый дом: деревянный фасад, веранда и лужайка среди сосен",
    1600,
    1200
  ],
  [
    "terrace",
    "Веранда Уединённого дома со столом под навесом и видом на лес",
    1600,
    1200
  ],
  [
    "kitchen",
    "Кухня и обеденная зона Уединённого дома с выходом на веранду",
    1600,
    1200
  ],
  [
    "living-room",
    "Кресло и печь в гостиной Уединённого дома",
    1600,
    1200
  ],
  [
    "bedroom",
    "Спальня Уединённого дома с окном и оранжевым покрывалом",
    1200,
    1600
  ],
  [
    "bathroom",
    "Санузел Уединённого дома с душевой, раковиной и круглым зеркалом",
    1200,
    1600
  ],
  [
    "pine-view",
    "Уединённый дом за соснами и зелёная лужайка перед ним",
    1600,
    1200
  ],
  [
    "terrace-exterior",
    "Деревянная веранда Уединённого дома с уличной мебелью",
    1600,
    1200
  ],
  [
    "window-view",
    "Вид из окна Уединённого дома на веранду и сосны",
    1200,
    1600
  ],
  [
    "garden",
    "Уединённый дом и просторный участок в окружении деревьев",
    1600,
    1200
  ],
  [
    "reservoir-sunset",
    "Закат над песчаным берегом Горьковского водохранилища",
    1200,
    1600
  ],
  [
    "sunset-shore",
    "Собака на берегу водохранилища на закате",
    1280,
    960
  ],
  [
    "beach-walk",
    "Прогулка с собакой по песчаному берегу водохранилища",
    1280,
    960
  ],
  [
    "evening-walk",
    "Вечерняя прогулка с собакой среди деревьев",
    720,
    960
  ]
],
  'bath-house': [
    ["terrace","Веранда дома с баней: стол и кресла с видом на сосновый лес",1200,1600],
    ["evening-terrace","Вечерняя веранда дома с баней: подсветка, стол и кресла у леса",1600,1200],
    ["evening-exterior","Деревянный фасад и веранда дома с баней вечером",1200,1600],
    ["steam-room","Гости в парной с банными вениками",1200,1600],
    ["fire","Живой огонь во время банного отдыха",1200,1600],
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
    image.src = `/images/${gallery.dataset.gallery}/${file}.webp`;
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
