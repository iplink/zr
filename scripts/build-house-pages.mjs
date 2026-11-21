import { readFile, writeFile, mkdir } from 'node:fs/promises';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const escape = value => String(value ?? 'Уточняется').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

export async function buildHousePages({ requireComplete = false } = {}) {
  const houses = JSON.parse(await readFile(new URL('content/houses.json', root), 'utf8'));
  const required = ['rooms', 'bedrooms', 'beds', 'sleepingPlaces', 'floors', 'style', 'ceiling', 'fireplace', 'price', 'appliances', 'heatedFloor'];
  if (requireComplete && houses.some(house => !house.confirmed || required.some(key => house[key] === null || house[key] === '') || !Number.isFinite(house.price) || house.price <= 0)) throw new Error('Перед публикацией подробных страниц заполните и подтвердите характеристики домов в content/houses.json.');
  const galleryCode = await readFile(new URL('public/gallery.js', root), 'utf8');
  const galleries = vm.runInNewContext(`${galleryCode}\ngalleries;`, { document: { querySelectorAll: () => [] } });
  const home = await readFile(new URL('public/index.html', root), 'utf8');
  const header = home.match(/<header class="header">[\s\S]*?<\/header>/)[0].replaceAll('href="#', 'href="/#');
  const footer = home.match(/<footer class="footer wrap">[\s\S]*?<\/footer>/)[0].replace('href="#"', 'href="/"');
  await mkdir(new URL('public/houses/', root), { recursive: true });
  for (const house of houses) {
    const photos = galleries[house.slug];
    const sectionPhotos = house.detailsSections?.flatMap(section => section.photos || []) || [];
    const booking = `/?house=${house.bookingId}#booking`;
    const image = (photo, index, extra = '') => `<img src="/images/${house.slug}/${photo[0]}.webp" alt="${escape(photo[1])}" width="${photo[2]}" height="${photo[3]}" ${index === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} ${extra}>`;
    const facts = [['Площадь дома', `${house.area} м²`], ['Количество комнат', house.rooms], ['Отдельные спальни', house.bedrooms], ['Спальных мест', house.sleepingPlaces], ['Количество этажей', house.floors], ['Стиль интерьера', house.style], ['Высота потолков', house.ceiling], ['Камин', house.fireplace], ['Тёплый пол', house.heatedFloor], ['Горячая вода', house.hotWater]];
    const price = house.price === null ? 'Стоимость уточняется' : `от ${house.price} рублей`;
    const list = items => items === null ? '<p class="muted">Уточняется</p>' : `<ul class="amenity-list">${items.map(item => `<li>${escape(item)}</li>`).join('')}</ul>`;
    const locatedAppliances = new Set(house.applianceGroups?.flatMap(group => group.items) || []);
    const otherAppliances = house.appliances?.filter(item => !locatedAppliances.has(item));
    const appliances = house.applianceGroups?.length
      ? house.applianceGroups.map(group => `<h3>${escape(group.title)}</h3>${list(group.items)}`).join('') + (otherAppliances?.length ? `<h3>Также в доме</h3>${list(otherAppliances)}` : '')
      : list(house.appliances);
    const thumbs = photos.map((photo, index) => `<a class="photo-tile" id="photo-${index + 1}" href="/images/${house.slug}/${photo[0]}.webp" data-photo-index="${index}" aria-label="Открыть фото ${index + 1}: ${escape(photo[1])}">${image(photo, index)}<span class="photo-number">${String(index + 1).padStart(2, '0')}</span></a>`).join('\n');
    const html = `<!doctype html>
<html lang="ru"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#233e35"><title>${escape(house.name)} — загородный отель Залив-Ретрит</title>
  <meta name="description" content="${escape(house.intro)} ${house.area} м², до ${house.guests} гостей. Фотографии, удобства и заявка на бронирование.">
  ${house.confirmed ? '' : '<meta name="robots" content="noindex">'}
  <link rel="canonical" href="https://zaliv-retreat.ru/houses/${house.slug}.html">
  <meta property="og:title" content="${escape(house.name)} — Залив-Ретрит"><meta property="og:type" content="website">
  <meta property="og:image" content="https://zaliv-retreat.ru/images/${house.slug}/${photos[0][0]}.webp">
  <meta property="og:description" content="${escape(house.intro)}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/style.css?v=7"><link rel="stylesheet" href="/house.css?v=2">
  <script src="/house.js?v=2" type="module"></script>
</head><body class="house-page">
  <a class="skip" href="#main">Перейти к содержимому</a>${header.replace('href="/#booking"', `href="${booking}"`)}
  <main id="main" class="wrap house-main">
    <nav class="breadcrumbs" aria-label="Хлебные крошки"><a href="/">Главная</a><span aria-hidden="true">/</span><a href="/#houses">Наши дома</a><span aria-hidden="true">/</span><span aria-current="page">${escape(house.name)}</span></nav>
    <div class="house-intro"><div><p class="eyebrow">${escape(house.eyebrow)}</p><h1>${escape(house.name)}</h1><p class="house-location">Сосновый лес · коттеджный посёлок Залив</p></div><a class="text-link" href="#photos">Фотографии дома <span aria-hidden="true">↓</span></a></div>
    <div class="house-mosaic" aria-label="Фотографии дома">${photos.slice(0, 3).map((photo, index) => `<a href="#photo-${index + 1}" data-photo-index="${index}" aria-label="Увеличить: ${escape(photo[1])}">${image(photo, index)}</a>`).join('')}<a class="all-photos" href="#photos">Смотреть все фото <span aria-hidden="true">↗</span></a></div>
    <div class="house-content"><div class="house-information">
      <section class="house-section" aria-labelledby="about-house"><p class="eyebrow">ВАШЕ МЕСТО В ЛЕСУ</p><h2 id="about-house">Отдых в своём ритме</h2><p class="house-lead">${escape(house.intro)}</p>${house.description.map(p => `<p>${escape(p)}</p>`).join('')}<div class="house-highlights"><span>${house.area} м²</span><span>До ${house.guests} гостей</span><span>Дом целиком</span></div></section>
      <section class="house-section" aria-labelledby="house-facts"><h2 id="house-facts">О доме</h2><dl class="house-facts">${facts.map(([label, fact]) => `<div><dt>${label}</dt><dd>${escape(fact)}</dd></div>`).join('')}</dl></section>
      ${house.detailsSections?.map(section => `<section class="house-section" aria-labelledby="${escape(section.id)}"><p class="eyebrow">${escape(section.eyebrow)}</p><h2 id="${escape(section.id)}">${escape(section.title)}</h2><p class="house-lead">${escape(section.intro)}</p>${section.photos?.length ? `<div class="section-photo-grid">${section.photos.map(photo => `<figure><a class="section-photo" href="/images/${house.slug}/${photo[0]}.webp" data-photo-index="${photos.length + sectionPhotos.indexOf(photo)}" aria-label="Увеличить: ${escape(photo[1])}">${image(photo, 1)}<span aria-hidden="true">Увеличить ↗</span></a><figcaption>${escape(photo[1])}</figcaption></figure>`).join('')}</div>` : ''}${section.blocks.map(block => `<h3>${escape(block.title)}</h3>${block.paragraphs.map(p => `<p>${escape(p)}</p>`).join('')}`).join('')}</section>`).join('') || ''}
      ${house.layout?.length ? `<section class="house-section" aria-labelledby="house-layout"><h2 id="house-layout">${escape(house.layoutTitle || 'Планировка по этажам')}</h2>${house.layout.map(floor => `<h3>${escape(floor.title)}</h3><p>${escape(floor.description)}</p>`).join('')}</section>` : ''}
      <section class="house-section" aria-labelledby="sleeping"><h2 id="sleeping">Где вы будете спать</h2><p>${escape(house.beds)}</p><p class="muted">Вместимость дома — до ${house.guests} гостей.</p></section>
      <section class="house-section" aria-labelledby="appliances"><h2 id="appliances">Бытовая техника</h2>${appliances}</section>
      <section class="house-section" aria-labelledby="amenities"><h2 id="amenities">Для вашего комфорта</h2>${list(house.amenities)}</section>
      ${house.notes.length ? `<section class="house-section" aria-labelledby="before-arrival"><h2 id="before-arrival">Перед поездкой</h2>${house.notes.map(note => `<p>${escape(note)}</p>`).join('')}</section>` : ''}
    </div><aside class="house-reservation" aria-label="Стоимость и бронирование"><p class="eyebrow">ВАШИ ВЫХОДНЫЕ ЗДЕСЬ</p><p class="house-price">${price}</p><p class="price-unit">за сутки · дом целиком</p>${house.priceInclusions?.map(note => `<p class="price-inclusion">${escape(note)}</p>`).join('') || ''}<p>Точная стоимость зависит от дат и условий проживания. Уточним наличие и ответим на ваши вопросы.</p><a class="button" href="${booking}">Выбрать даты <span aria-hidden="true">↗</span></a><a class="reservation-phone" href="tel:+79027850002">+7 902 785-00-02</a><p class="reservation-note">Заявка не подтверждает бронирование. Администратор свяжется с вами для согласования.</p></aside></div>
    <section id="photos" class="house-section full-gallery" aria-labelledby="photos-title"><div class="section-heading"><div><p class="eyebrow">РАССМОТРИТЕ ДЕТАЛИ</p><h2 id="photos-title">Ваш дом в фотографиях</h2></div><p>Нажмите на снимок, чтобы увеличить.</p></div><div class="photo-grid">${thumbs}</div></section>
    <section class="other-houses"><h2>Ещё два настроения отдыха</h2><div>${houses.filter(other => other.slug !== house.slug).map(other => `<a class="text-link" href="/houses/${other.slug}.html">${escape(other.name)} · ${other.area} м² <span aria-hidden="true">↗</span></a>`).join('')}</div><a class="back-link" href="/#houses">← Все дома</a></section>
  </main>${footer}
  <dialog class="photo-dialog" aria-labelledby="photo-dialog-title"><div class="photo-dialog-head"><h2 id="photo-dialog-title">${escape(house.name)}</h2><button type="button" data-photo-close aria-label="Закрыть фотографии">Закрыть ×</button></div><div class="photo-view"><button type="button" data-photo-prev aria-label="Предыдущая фотография">←</button><img data-photo-full alt=""><button type="button" data-photo-next aria-label="Следующая фотография">→</button></div><div class="photo-caption"><span data-photo-counter aria-live="polite" aria-atomic="true"></span><p data-photo-caption></p></div></dialog>
</body></html>\n`;
    await writeFile(new URL(`public/houses/${house.slug}.html`, root), html.replace(/[\t ]+$/gm, ''));
  }
  const urls = ['/', ...houses.filter(house => house.confirmed).map(house => `/houses/${house.slug}.html`)];
  await writeFile(new URL('public/sitemap.xml', root), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url => `<url><loc>https://zaliv-retreat.ru${url}</loc></url>`).join('')}</urlset>\n`);
  console.log(`Prepared ${houses.length} house pages${houses.every(house => house.confirmed) ? '' : ' (draft: waiting for house details)'}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await buildHousePages();
