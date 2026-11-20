import { spawnSync } from 'node:child_process';
import { mkdir, copyFile, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const stamp = new Date().toISOString().replace(/[^0-9]/g, '');
const temporary = path.join(root, 'data', 'deploy');
const name = `.zaliv-upload-${stamp}`;
const archive = path.join(temporary, `${name}.zip`);
const script = path.join(temporary, `${name}.sh`);
const destination = 'u3735216@server170.hosting.reg.ru';
const options = ['-o', 'ConnectTimeout=20', '-o', 'ServerAliveInterval=30', '-o', 'StrictHostKeyChecking=yes'];

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command}: ${result.status ?? 'interrupted'}`);
}

try {
  await mkdir(temporary, { recursive: true });
  await copyFile(path.join(root, 'dist', 'zaliv-retreat-reg-ru-ready.zip'), archive);
  await writeFile(script, (await readFile(new URL('./deploy-reg-ru.sh', import.meta.url), 'utf8')).replace(/\r\n/g, '\n'));
  console.log('Загрузка сайта. Введите пароль SSH в этом терминале. Символы пароля не отображаются.');
  run('scp', [...options, archive, script, `${destination}:.`]);
  console.log('Файлы загружены. Для установки введите пароль SSH ещё раз.');
  run('ssh', [...options, destination, `bash '${name}.sh' '${name}.zip'`]);
  await writeFile(path.join(temporary, 'result.json'), JSON.stringify({ ok: true, completedAt: new Date().toISOString() }));
  console.log('Сайт загружен. Напишите в чате «загружено», чтобы продолжить проверку и подключение ботов.');
} catch (error) {
  await mkdir(temporary, { recursive: true });
  await writeFile(path.join(temporary, 'result.json'), JSON.stringify({ ok: false, error: error.message, completedAt: new Date().toISOString() }));
  console.error('Загрузка остановлена:', error.message);
  process.exitCode = 1;
}
