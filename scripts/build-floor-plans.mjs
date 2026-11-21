import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Traced from the owner's technical drawings. Coordinates follow the source
// sheets; room names are added as they are confirmed by the owner.
const plans = [
  {
    id: 'white-house-1', house: 'white-house', title: 'Белый дом', floor: 'Первый этаж',
    view: [250, 60, 1000, 1030],
    fills: [[347, 135, 790, 397], [347, 535, 236, 395], [583, 535, 80, 102], [583, 637, 386, 293], [969, 535, 168, 190], [969, 725, 168, 205]],
    walls: ['M347 135H1137V930H347Z', 'M347 535H599 M643 535H886 M958 535H1137', 'M583 535V930 M583 637H663V535', 'M969 535V568 M969 631V803 M969 866V930', 'M969 725H1137'],
    windows: [[425,135,582,135],[768,135,924,135],[347,274,347,429],[347,663,347,820],[641,930,799,930]],
    doors: [[1137,287,1137,359,1],[385,930,457,930,1],[979,930,1051,930,1],[599,535,643,535,-1],[886,535,958,535,-1],[969,568,969,631,-1],[969,803,969,866,-1]],
    stair: [363,552,182,267],
    rooms: [[1,740,330],[2,458,866],[3,621,594],[4,790,752],[5,1051,654],[6,1051,828]],
    labels: {1: 'Кухня-гостиная', 2: 'Вход и лестница на второй этаж', 3: 'Гостевой санузел', 4: 'Спальня', 5: 'Основной санузел', 6: 'Котельная'},
    zones: [
      {x: 1091, y: 155, width: 34, height: 117, color: '#e88a20', label: 'Кухонное оборудование'},
      {x: 1091, y: 374, width: 34, height: 140, color: '#e88a20', label: 'Кухонное оборудование'},
    ],
    furniture: [
      {type: 'sofa', room: 1, x: 646, y: 459, width: 237, height: 66, lengthLabel: '3 м'},
      {type: 'bed', room: 4, x: 600, y: 720, width: 160, height: 127, head: 'left'},
      {type: 'tv', room: 1, x: 600, y: 148, width: 150, height: 13, face: 'down'},
    ],
    note: 'Гостевой санузел № 3 отделён перегородкой от входной зоны с лестницей № 2.',
  },
  {
    id: 'white-house-2', house: 'white-house', title: 'Белый дом', floor: 'Второй этаж',
    view: [210, 65, 1060, 1015],
    terrace: 'M427 240H340L270 985H1115V895H427Z',
    fills: [[427,140,311,380],[738,140,287,380],[1025,140,155,380],[427,520,753,375]],
    walls: ['M427 140H1180V895H427Z', 'M738 140V520', 'M1025 140V520', 'M427 520H630 M695 520H944 M1008 520H1040 M1101 520H1180'],
    windows: [[500,140,652,140],[827,140,979,140],[427,371,427,425],[1180,285,1180,435],[457,895,610,895]],
    doors: [[427,644,427,793,-1],[1029,895,1070,895,-1],[630,520,695,520,-1],[944,520,1008,520,-1],[1040,520,1101,520,-1]],
    stair: [445,538,174,190],
    rooms: [[7,675,270],[8,971,398],[9,1100,335],[10,870,743],[11,752,947]],
    labels: {7: 'Спальня', 8: 'Спальня', 9: 'Санузел', 10: 'Кухня-гостиная', 11: 'Балкон'},
    zones: [{x: 1132, y: 542, width: 35, height: 330, color: '#e88a20', label: 'Кухонное оборудование'}],
    furniture: [
      {type: 'bed', room: 7, x: 466, y: 344, width: 126, height: 160, head: 'bottom'},
      {type: 'bed', room: 8, x: 749, y: 237, width: 151, height: 121, head: 'left'},
      {type: 'sofa', room: 10, x: 709, y: 534, width: 221, height: 64, back: 'top'},
      {type: 'tv', room: 10, x: 752, y: 871, width: 135, height: 13, face: 'up'},
    ],
    dimensions: [{x: 934, y1: 146.5, y2: 237, label: '1,2 м', toX: 900}],
    note: '№ 11 — открытый балкон. Он обозначен на схеме и не относится к внутренним помещениям дома.',
  },
  {
    id: 'bath-house-1', house: 'bath-house', title: 'Дом с баней', floor: 'Первый этаж',
    view: [455, 330, 775, 670],
    terrace: 'M542 759H1121V930H542Z',
    fills: [[542,429,165,108],[542,537,165,222],[707,429,221,330],[928,429,71,111],[1057,429,64,164],[999,429,58,164],[928,540,71,53],[928,593,193,166]],
    walls: ['M542 429H1121V759H542Z', 'M542 537H707', 'M707 429V759', 'M928 429V490 M928 531V550 M928 583V759', 'M999 429V540H928', 'M1057 429V593H1121', 'M928 593H1007 M1040 593H1057'],
    windows: [[731,429,756,429],[806,429,830,429],[874,429,901,429],[949,429,973,429],[1015,429,1039,429],[1083,429,1108,429],[542,642,542,738],[579,759,675,759],[970,759,1080,759]],
    doors: [[560,429,611,429,-1],[560,537,599,537,-1],[707,492,707,531,-1],[928,499,928,531,-1],[928,550,928,583,-1],[1007,593,1040,593,1],[1121,514,1121,561,1],[773,759,870,759,1,2]],
    rooms: [[1,565,727],[2,817,638],[3,624,482],[4,963,499],[5,1088,504],[6,1025,565],[7,1023,687],[8,740,854],[9,1019,867]],
    labels: {1: 'Спальня', 2: 'Комната отдыха', 3: 'Прихожая', 4: 'Санузел', 5: 'Котельная', 6: 'Душевая', 7: 'Парная', 8: 'Веранда', 9: 'Банный чан'},
    zones: [{x: 717, y: 442, width: 201, height: 27, color: '#e88a20', label: 'Кухонное оборудование'}],
    furniture: [
      {type: 'bed', room: 1, x: 583, y: 604, width: 111, height: 88, head: 'right'},
      {type: 'sofa', room: 2, x: 720, y: 568, width: 48, height: 150, back: 'left'},
      {type: 'tv', room: 2, x: 908, y: 610, width: 11, height: 66, face: 'left'},
    ],
    hotTub: {x: 1019, y: 867, radius: 50},
    markerRadius: 16,
    note: '№ 8 и 9 — веранда и чан на улице, показаны схематично. Котельная недоступна гостям.',
  },
  {
    id: 'secluded-house-1', house: 'secluded-house', title: 'Уединённый дом', floor: 'Первый этаж',
    view: [280, 450, 820, 740],
    fills: [[344,520,192,251],[536,520,227,251],[763,520,132,251],[895,520,138,251],[344,771,689,321]],
    walls: ['M344 520H1033V1092H344Z', 'M536 520V771 M763 520V771 M895 520V771', 'M344 771H479 M529 771H544 M594 771H837 M887 771H903 M953 771H1033', 'M344 902H383 M344 983H383'],
    windows: [[398,520,488,520],[601,520,692,520],[796,520,859,520],[931,520,993,520],[1033,834,1033,894],[1033,906,1033,966],[1033,988,1033,1046],[457,1092,576,1092],[815,1092,934,1092]],
    doors: [[385,1092,441,1092,1],[479,771,529,771,1],[544,771,594,771,1],[837,771,887,771,1],[903,771,953,771,1]],
    rooms: [[1,439,733],[2,608,733],[3,829,642],[4,964,642],[5,685,935]],
    labels: {1: 'Угловая спальня', 2: 'Спальня', 3: 'Санузел', 4: 'Кладовка котельной', 5: 'Кухня-гостиная'},
    zones: [{x: 983, y: 815, width: 38, height: 250, color: '#e88a20', label: 'Кухонное оборудование'}],
    furniture: [
      {type: 'bed', room: 1, x: 356, y: 592, width: 134, height: 107, head: 'left'},
      {type: 'bed', room: 2, x: 613, y: 592, width: 138, height: 107, head: 'right'},
      {type: 'sofa', room: 5, x: 610, y: 784, width: 211, height: 62, back: 'top'},
      {type: 'tv', room: 5, x: 655, y: 1068, width: 121, height: 13, face: 'up'},
    ],
    note: 'Кухонное оборудование расположено вдоль правой стены кухни-гостиной, у окон.',
  },
];

const line = (a, cls) => `<path class="${cls}" d="M${a[0]} ${a[1]}L${a[2]} ${a[3]}"/>`;
const roomSummary = plan => plan.rooms.map(([n]) => `${n}${plan.labels?.[n] ? ` — ${plan.labels[n]}` : ''}`).join('; ');
const zoneLegend = plan => [...new Map((plan.zones || []).map(zone => [zone.label, zone])).values()];
const furnitureLegend = plan => [...new Set((plan.furniture || []).map(item => item.type))];
const furnitureName = type => ({bed: 'Двуспальная кровать', sofa: 'Раскладной диван', tv: 'Телевизор'})[type];
const svgHeight = plan => plan.labels ? 1360 + Math.ceil((plan.rooms.length + zoneLegend(plan).length + furnitureLegend(plan).length)/2)*50 : 1300;
function furnitureSvg(item) {
  const {x, y} = item;
  let {width, height} = item;
  if (item.type === 'tv') {
    const inline = Math.min(width, height) >= 20;
    const tx = item.face === 'left' ? x-9 : x+width/2;
    const ty = inline ? y+height/2+5 : item.face === 'up' ? y-10 : item.face === 'left' ? y+height/2+5 : y+height+18;
    return `<g data-furniture="tv" aria-label="Телевизор${item.room ? ` в помещении ${item.room}` : ''}"><title>Телевизор</title><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="3" fill="#344657" stroke="#172a37" stroke-width="2"/><text x="${tx}" y="${ty}" fill="${inline ? '#fff' : '#344657'}" font-size="15" font-weight="600" text-anchor="${item.face === 'left' ? 'end' : 'middle'}">ТВ</text></g>`;
  }
  if (item.type === 'bed') {
    const side = item.head === 'left' || item.head === 'right', w = side ? height : width, h = side ? width : height;
    const transform = item.head === 'left' ? `translate(${x} ${y+height}) rotate(-90)` : item.head === 'right' ? `translate(${x+width} ${y}) rotate(90)` : item.head === 'bottom' ? `translate(${x+width} ${y+height}) rotate(180)` : `translate(${x} ${y})`;
    return `<g data-furniture="bed" aria-label="Двуспальная кровать${item.room ? ` в помещении ${item.room}` : ''}" transform="${transform}"><title>Двуспальная кровать</title><rect x="0" y="0" width="${w}" height="${h}" rx="5" fill="#d6e4e9" stroke="#526e7b" stroke-width="2.5"/><path d="M0 2H${w}" fill="none" stroke="#526e7b" stroke-width="7" stroke-linecap="round"/>${[0,1].map(i=>`<rect x="${8+i*w/2}" y="12" width="${w/2-16}" height="${h*.2}" rx="5" fill="#faf9f5" stroke="#7f979f" stroke-width="1.5"/>`).join('')}<path d="M0 ${h*.34}H${w} M${w/2} ${h*.34}V${h}" fill="none" stroke="#8aa6b1" stroke-width="1.5"/><path d="M4 ${h*.83}H${w-4}" stroke="#a8c2cc" stroke-width="${h*.12}"/></g>`;
  }
  const verticalSofa = item.back === 'left' || item.back === 'right';
  if (verticalSofa) [width, height] = [height, width];
  const arm = width*.055, back = height*.2, seat = (width-arm*2)/3;
  const sofaTransform = item.back === 'left' ? `translate(${x+height} ${y}) rotate(90)` : item.back === 'right' ? `translate(${x} ${y+width}) rotate(-90)` : item.back === 'top' ? `translate(${x+width} ${y+height}) rotate(180)` : `translate(${x} ${y})`;
  return `<g data-furniture="sofa" aria-label="Раскладной диван${item.lengthLabel ? ` длиной ${item.lengthLabel}` : ''}" transform="${sofaTransform}"><title>Раскладной диван${item.lengthLabel ? ` — ${item.lengthLabel}` : ''}</title><rect width="${width}" height="${height}" rx="6" fill="#c5bad3" stroke="#665276" stroke-width="2.5"/>${[0,1,2].map(i=>`<rect x="${arm+i*seat}" y="4" width="${seat}" height="${height-back-6}" rx="4" fill="#e2daeb" stroke="#897697" stroke-width="1.5"/>`).join('')}<rect x="0" y="3" width="${arm}" height="${height-6}" rx="4" fill="#b19fbe" stroke="#665276" stroke-width="1.5"/><rect x="${width-arm}" y="3" width="${arm}" height="${height-6}" rx="4" fill="#b19fbe" stroke="#665276" stroke-width="1.5"/><path d="M${arm} ${height-back/2}H${width-arm}" stroke="#897697" stroke-width="2"/></g>`;
}
function svg(plan) {
  const height = svgHeight(plan);
  const [x,y,w,h] = plan.view;
  const scale = Math.min(1040/w, 1000/h);
  const tx = (1200-w*scale)/2-x*scale;
  const ty = 175-y*scale;
  const doors = plan.doors.map(([x1,y1,x2,y2,side,leaves=1]) => {
    if (leaves === 2) {
      const vertical=x1===x2, half=Math.hypot(x2-x1,y2-y1)/2;
      const mx=(x1+x2)/2, my=(y1+y2)/2;
      const paths=[[x1,y1],[x2,y2]].map(([hx,hy])=> {
        const angle=Math.PI/3;
        const ex=vertical?hx+side*half*Math.sin(angle):hx+Math.sign(mx-hx)*half*Math.cos(angle);
        const ey=vertical?hy+Math.sign(my-hy)*half*Math.cos(angle):hy+side*half*Math.sin(angle);
        const sweep=vertical?((side>0)===(my>hy)?0:1):((side>0)===(mx>hx)?1:0);
        return `<path class="door" d="M${mx} ${my}A${half} ${half} 0 0 ${sweep} ${ex} ${ey}"/><path fill="none" stroke="#29473a" stroke-width="3.5" stroke-linecap="round" d="M${hx} ${hy}L${ex} ${ey}"/>`;
      }).join('');
      return `<g aria-label="Двустворчатая дверь на веранду">${line([x1,y1,x2,y2],'opening')}${paths}</g>`;
    }
    const vertical = x1===x2;
    const length = Math.hypot(x2-x1,y2-y1);
    const ex = vertical ? x1+side*length : x1;
    const ey = vertical ? y1 : y1+side*length;
    const sweep = vertical ? (side>0?0:1) : (side>0?1:0);
    return `${line([x1,y1,x2,y2],'opening')}<path class="door" d="M${x1} ${y1}L${ex} ${ey} M${ex} ${ey}A${length} ${length} 0 0 ${sweep} ${x2} ${y2}"/>`;
  }).join('');
  const stairs = plan.stair ? (() => {
    const [sx,sy,sw,sh]=plan.stair, middle=sx+sw*.5;
    return `<g class="stair"><path d="M${sx} ${sy+sh*.76}V${sy}H${sx+sw}V${sy+sh} M${middle-17} ${sy+sh*.76}V${sy+sh*.3}H${middle+17}V${sy+sh}"/>${Array.from({length:9},(_,i)=>`<path d="M${middle+17} ${sy+sh*(.34+i*.075)}H${sx+sw}"/>`).join('')}${Array.from({length:7},(_,i)=>`<path d="M${sx} ${sy+sh*(.31+i*.075)}H${middle-17}"/>`).join('')}<path d="M${middle+39} ${sy+sh*.9}V${sy+sh*.5}m-8 10 8-10 8 10"/></g>`;
  })() : '';
  const attributes = {
    wall: 'fill="none" stroke="#29473a" stroke-width="13" stroke-linejoin="miter"',
    opening: 'fill="none" stroke="#faf9f5" stroke-width="17"',
    window: 'fill="none" stroke="#799eaa" stroke-width="4"',
    door: 'fill="none" stroke="#a18460" stroke-width="1.8"',
    stair: 'fill="none" stroke="#9ba89e" stroke-width="2"',
    room: 'fill="#29473a" stroke="#faf9f5" stroke-width="3"',
    number: 'fill="#fff" font-size="21" font-weight="600" text-anchor="middle" dominant-baseline="central"',
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${height}" viewBox="0 0 1200 ${height}" role="img" aria-labelledby="title desc" font-family="Arial,Helvetica,sans-serif" fill="#263f35">
<title id="title">${plan.title} — ${plan.floor.toLowerCase()}</title><desc id="desc">Обозначения на схеме: ${roomSummary(plan)}. ${plan.note || ''} Окна отмечены светлыми линиями, двери — дугами.</desc>
<path fill="#faf9f5" d="M0 0H1200V${height}H0Z"/>
<text x="72" y="57" font-size="12" letter-spacing="3">ЗАЛИВ-РЕТРИТ · ПЛАНИРОВКА</text>
<text x="72" y="110" font-size="37">${plan.title}</text><text x="1128" y="107" font-size="20" text-anchor="end">${plan.floor}</text>
<path d="M72 140H1128" stroke="#d7dace"/>
<g transform="translate(${tx} ${ty}) scale(${scale})">
${plan.terrace?`<path fill="#e8eddf" stroke="#a5b399" stroke-width="3" d="${plan.terrace}"/>`:''}
${plan.fills.map(([rx,ry,rw,rh],i)=>`<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="${i%2?'#eceee5':'#f1eee5'}"/>`).join('')}
${plan.zones?.map(z=>`<rect x="${z.x}" y="${z.y}" width="${z.width}" height="${z.height}" fill="${z.color}" stroke="#9d4f0e" stroke-width="2" rx="3"><title>${z.label}</title></rect>`).join('') || ''}
${plan.furniture?.map(furnitureSvg).join('') || ''}
${plan.walls.map(d=>`<path class="wall" d="${d}"/>`).join('')}
${plan.partitions?.map(d=>`<path fill="none" stroke="#29473a" stroke-width="8" d="${d}"/>`).join('') || ''}
${plan.windows.map(a=>line(a,'opening')+line(a,'window')+line(a[0]===a[2]?[a[0]-5,a[1],a[2]-5,a[3]]:[a[0],a[1]-5,a[2],a[3]-5],'window')).join('')}
${doors}${stairs}
${plan.hotTub ? `<circle cx="${plan.hotTub.x}" cy="${plan.hotTub.y}" r="${plan.hotTub.radius}" fill="#edf1e9" stroke="#799eaa" stroke-width="4"/><circle cx="${plan.hotTub.x}" cy="${plan.hotTub.y}" r="${plan.hotTub.radius+6}" fill="none" stroke="#a18460" stroke-width="2"/>` : ''}
${plan.rooms.map(([n,cx,cy])=>`<circle class="room" cx="${cx}" cy="${cy}" r="${plan.markerRadius || 23}"/><text class="number" x="${cx}" y="${cy}">${n}</text>`).join('')}
</g>
<path d="M72 1200H1128" stroke="#d7dace"/>
<circle cx="84" cy="1236" r="12" fill="#29473a"/><text x="109" y="1242" font-size="15">Номер на схеме</text>
<path d="M390 1236h36m-36-5h36" stroke="#799eaa" stroke-width="3"/><text x="443" y="1242" font-size="15">Окно / остекление</text>
<path d="M738 1248v-25a25 25 0 0 1 25 25" fill="none" stroke="#a18460" stroke-width="2"/><text x="780" y="1242" font-size="15">Дверь / проход</text>
<text x="72" y="1280" font-size="12" fill="#687263">Схема по исходному плану. Не предназначена для измерений.</text>
${plan.labels ? `<path d="M72 1302H1128" stroke="#d7dace"/>${plan.rooms.map(([n],i) => {
  const lx = 94 + (i%2)*530, ly=1345+Math.floor(i/2)*50;
  return `<circle cx="${lx}" cy="${ly}" r="17" fill="#29473a"/><text x="${lx}" y="${ly}" fill="#fff" font-size="16" text-anchor="middle" dominant-baseline="central">${n}</text><text x="${lx+30}" y="${ly+6}" font-size="18">${plan.labels[n]}</text>`;
}).join('')}${zoneLegend(plan).map((z,i)=> {
  const index=plan.rooms.length+i, lx=94+(index%2)*530, ly=1345+Math.floor(index/2)*50;
  return `<rect x="${lx-15}" y="${ly-12}" width="30" height="24" rx="3" fill="${z.color}" stroke="#9d4f0e" stroke-width="2"/><text x="${lx+30}" y="${ly+6}" font-size="18">${z.label}</text>`;
}).join('') || ''}${furnitureLegend(plan).map((type,i) => {
  const index=plan.rooms.length+zoneLegend(plan).length+i, lx=94+(index%2)*530, ly=1345+Math.floor(index/2)*50;
  return `${furnitureSvg({type, x:lx-17, y:ly-14, width:34, height:28})}<text x="${lx+30}" y="${ly+6}" font-size="18">${furnitureName(type)}</text>`;
}).join('')}${plan.note ? `<text x="72" y="${height-20}" font-size="14" fill="#687263">${plan.note}</text>` : ''}` : ''}
</svg>`.replace(/class="(wall|opening|window|door|stair|room|number)"/g, (_, name) => attributes[name]);
}

export async function buildFloorPlans() {
  const root = new URL('../public/', import.meta.url);
  const pageLinks = {};
  await mkdir(new URL('plans/',root), { recursive:true });
  for (const plan of plans) {
    const content = svg(plan);
    plan.imageFile = `${plan.id}-furnished.${createHash('sha256').update(content).digest('hex').slice(0, 10)}.svg`;
    await writeFile(new URL(`plans/${plan.id}.svg`,root), content);
    await writeFile(new URL(`plans/${plan.imageFile}`,root), content);
  }
  for (const slug of ['white-house','secluded-house','bath-house']) {
    const group=plans.filter(p=>p.house===slug), name=group[0].title;
    const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Планировка — ${name} · Залив-Ретрит</title><meta name="robots" content="noindex"><link rel="icon" href="/favicon-32.png?v=cat-1" type="image/png"><link rel="stylesheet" href="/style.css?v=10"><link rel="stylesheet" href="/plans/plans.css?v=6"></head>
<body><main class="plan-page"><a class="text-link" href="/houses/${slug}.html">← К описанию дома</a><p class="eyebrow">ЗАЛИВ-РЕТРИТ</p><h1>${name}: планировка</h1><p class="plan-intro">Расположение помещений, окон и дверей.${group.length>1?' Оба этажа показаны отдельно.':''}</p>${group.length>1?`<nav class="plan-nav" aria-label="Этажи">${group.map((p,i)=>`<a class="text-link" href="#floor-${i+1}">${p.floor} ↓</a>`).join('')}</nav>`:''}
${group.map((p,i)=>`<section id="floor-${i+1}" class="plan-sheet" aria-labelledby="floor-title-${i+1}"><div class="plan-sheet-heading"><h2 id="floor-title-${i+1}">${p.floor}</h2><a class="text-link" href="/plans/${p.imageFile}" target="_blank" rel="noopener">Открыть крупнее ↗</a></div><a class="plan-image-link" href="/plans/${p.imageFile}" target="_blank" rel="noopener" aria-label="Увеличить планировку: ${p.floor.toLowerCase()}"><img src="/plans/${p.imageFile}" width="1200" height="${svgHeight(p)}" alt="${name}, ${p.floor.toLowerCase()}. Обозначения: ${roomSummary(p)}."></a>${p.labels ? `<dl class="room-legend">${p.rooms.map(([n])=>`<div><dt>${n}</dt><dd>${p.labels[n]}</dd></div>`).join('')}${zoneLegend(p).map(z=>`<div><dt class="kitchen-zone-swatch" aria-hidden="true"></dt><dd>${z.label}</dd></div>`).join('') || ''}${furnitureLegend(p).map(type=>`<div><dt class="furniture-swatch ${type}-swatch" aria-hidden="true"></dt><dd>${furnitureName(type)}</dd></div>`).join('')}</dl>${p.note ? `<p class="plan-note">${p.note}</p>` : ''}` : ''}</section>`).join('')}
<p class="plan-note">Схемы подготовлены по исходным планам.${group.some(p=>!p.labels) ? ' Названия остальных помещений будут добавлены после уточнения.' : ''}</p><a class="text-link" href="/houses/${slug}.html">Вернуться к описанию дома →</a></main></body></html>\n`;
    const pageFile = `${slug}-furnished.${createHash('sha256').update(html).digest('hex').slice(0, 10)}.html`;
    await writeFile(new URL(`plans/${slug}.html`,root), html);
    await writeFile(new URL(`plans/${pageFile}`,root), html);
    pageLinks[slug] = `/plans/${pageFile}`;
  }
  return pageLinks;
}
