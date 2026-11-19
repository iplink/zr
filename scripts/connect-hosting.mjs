import { readFile } from 'node:fs/promises';
const secrets = JSON.parse(await readFile(new URL('../hosting/.secrets.json',import.meta.url),'utf8'));
try {
  const response = await fetch('https://zaliv-retreat.ru/api/connect.php',{method:'POST',headers:{'X-Zaliv-Setup':secrets.setup},signal:AbortSignal.timeout(40000)});
  const result = await response.json();
  if(!response.ok||!result.ok)throw Error(result.error||'Connection failed');
  console.log(JSON.stringify({ok:true,bot:result.bot,webhook:result.webhook}));
} catch(error) { console.error(error instanceof SyntaxError?'Hosting endpoint is not installed or did not return JSON':error.message);process.exitCode=1; }
