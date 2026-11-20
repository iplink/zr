import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const php = String.raw`
$base='/var/www/u3735216/data/www/zaliv-private';
require $base.'/app.php';
$config=zr_config();
function probe($config,$ipv4=false,$method='getMe') {
    $curl=curl_init('https://api.telegram.org/bot'.$config['telegram_token'].'/'.$method);
    curl_setopt_array($curl,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>'{}',CURLOPT_HTTPHEADER=>['Content-Type: application/json'],CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>8,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2]);
    if($ipv4)curl_setopt($curl,CURLOPT_IPRESOLVE,CURL_IPRESOLVE_V4);
    $raw=curl_exec($curl);
    $result=['http'=>curl_getinfo($curl,CURLINFO_RESPONSE_CODE),'errno'=>curl_errno($curl),'ip'=>curl_getinfo($curl,CURLINFO_PRIMARY_IP),'error'=>str_replace($config['telegram_token'],'[hidden]',curl_error($curl))];
    $data=is_string($raw)?json_decode($raw,true):null;
    $result['ok']=$data['ok']??false;
    if($method==='getWebhookInfo'&&!empty($data['ok']))$result['webhook']=['url'=>$data['result']['url']??'','pending'=>$data['result']['pending_update_count']??0,'lastError'=>$data['result']['last_error_message']??null];
    curl_close($curl);return $result;
}
$result=['php'=>PHP_VERSION,'telegramDefault'=>probe($config),'telegramIPv4'=>probe($config,true),'telegramWebhook'=>probe($config,true,'getWebhookInfo')];
require_once $base.'/vendor/PHPMailer/Exception.php';
require_once $base.'/vendor/PHPMailer/PHPMailer.php';
require_once $base.'/vendor/PHPMailer/SMTP.php';
$mail=new PHPMailer\PHPMailer\PHPMailer(true);
try {
    $mail->isSMTP();$mail->Host=$config['smtp_host'];$mail->Port=(int)$config['smtp_port'];$mail->SMTPAuth=true;$mail->Username=$config['smtp_user'];$mail->Password=$config['smtp_password'];$mail->SMTPSecure=$mail->Port===465?'ssl':'tls';$mail->Timeout=8;$mail->getSMTPInstance()->Timelimit=10;
    $result['smtpConnected']=$mail->smtpConnect();$mail->smtpClose();
}catch(Throwable $error){$result['smtpConnected']=false;$result['smtpError']=str_replace([$config['smtp_password'],$config['telegram_token'],$config['max_token']], '[hidden]', $error->getMessage());}
if(function_exists('shell_exec'))$result['cronConfigured']=str_contains((string)shell_exec('crontab -l 2>/dev/null'),$base.'/cron.php');
$result['privateConfigOutsidePublic']=is_file($base.'/config.php')&&!is_file('/var/www/u3735216/data/www/zaliv-retreat.ru/zaliv-private/config.php');
echo json_encode($result,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES).PHP_EOL;
`;

console.log('Проверка сервера. Введите SSH-пароль в этом терминале.');
const encoded = Buffer.from(php).toString('base64');
const command = `/opt/php/8.3/bin/php -r 'eval(base64_decode("${encoded}"));'`;
const run = spawnSync('ssh', ['-o','ConnectTimeout=20','-o','StrictHostKeyChecking=yes','u3735216@server170.hosting.reg.ru',command], { stdio:['inherit','pipe','inherit'], encoding:'utf8' });
if (run.stdout) process.stdout.write(run.stdout);
if (run.status !== 0) { console.error('Проверка не завершена.'); process.exitCode=1; }
else {
  const result = JSON.parse(run.stdout.trim());
  const directory = fileURLToPath(new URL('../data/deploy/', import.meta.url));
  await mkdir(directory,{recursive:true});
  await writeFile(new URL('../data/deploy/diagnostics.json',import.meta.url),JSON.stringify(result,null,2));
  console.log('Результат сохранён. Напишите в чате «проверка готова».');
}
