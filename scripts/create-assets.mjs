// Original vector placeholders, explicitly labelled as illustrations on the site.
import { writeFile, mkdir } from 'node:fs/promises';
await mkdir('public/images',{recursive:true});
const tree = (x,y,scale,color='#49614e') => `<g transform="translate(${x} ${y}) scale(${scale})"><path d="M-3 0h6v160h-6z" fill="#5e6350"/><path d="M0-65-45 38h20L-60 95h120L25 38h20Z" fill="${color}"/></g>`;
for (const [type,bg,wall,roof] of [['white','#cdd6c7','#f2f0e4','#526153'],['secluded','#bec9ba','#947d5e','#374c41'],['bath','#d5d2bc','#887357','#3d4e3e']]) {
  const tall = type === 'white';
  const building = tall ? `<path d="M174 202h294v190H174z" fill="${wall}"/><path d="m150 205 170-88 172 88Z" fill="${roof}"/><path d="M165 205h315v10H165z" fill="#c5c8b8"/><path d="M185 297h272v8H185z" fill="#d1d2c6"/>` : `<path d="M148 253h336v137H148z" fill="${wall}"/><path d="m126 257 184-111 198 111Z" fill="${roof}"/>`;
  const windows = tall ? `<path d="M204 230h63v53h-63zm91 0h63v53h-63zm91 0h49v53h-49zM205 322h67v68h-67zm96 0h53v68h-53zm84 0h52v68h-52z" fill="#667c75"/>` : `<path d="M179 279h84v111h-84zm102 0h84v111h-84zm122 12h48v99h-48z" fill="#526e66"/>`;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="${bg}"/><stop offset="1" stop-color="#edf0df"/></linearGradient><linearGradient id="glass" x2="1" y2="1"><stop stop-color="#fff" stop-opacity=".4"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><path fill="url(#sky)" d="M0 0h640v480H0z"/><circle cx="462" cy="100" r="57" fill="#f0edcf" opacity=".55"/>`;
  for (let i=0;i<10;i++) svg += tree(i*76-20,130+(i%3)*24,1.1+(i%2)*.3,i%2?'#73816b':'#8d9a7e');
  svg += `<path d="M0 358q160-45 330 0t310-12v134H0z" fill="#a0ac8d"/>${building}${windows}<path d="m210 233 42 0-42 46zm91 0h40l-40 45z" fill="url(#glass)"/><path d="M137 390h361v12H137z" fill="#b2ac95"/><path d="M130 402h375v7H130z" fill="#7d816d"/><path d="m300 409-47 71h160l-56-71" fill="#c4c6ae"/>`;
  if(type==='bath') svg+='<path d="M414 187v-57h17v67" fill="#6e7463"/><path d="M422 122q-22-23 0-44t-2-35" fill="none" stroke="#eff0e4" stroke-width="11" opacity=".6"/>';
  svg += tree(53,245,1.65,'#344e3d')+tree(583,220,1.85,'#3c5542')+`<path d="M0 455q130-28 225 0t240-2 175-5v32H0z" fill="#4f654b"/><path d="M0 471h640" stroke="#3c5740" stroke-width="20"/></svg>`;
  await writeFile(`public/images/house-${type}.svg`,svg);
}
