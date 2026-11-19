<?php
declare(strict_types=1);
require dirname(__DIR__,2).'/zaliv-private/app.php';
try {
    $config = zr_config();
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') { zr_json(405,['error'=>'Method not allowed']); exit; }
    $secret = $_SERVER['HTTP_X_ZALIV_SETUP'] ?? '';
    if (empty($config['setup_secret']) || !hash_equals($config['setup_secret'],$secret)) { zr_json(403,['error'=>'Forbidden']); exit; }
    if (!zr_origin($config)) { zr_json(403,['error'=>'Forbidden']); exit; }
    if (!zr_ready($config) || !preg_match('/^[A-Za-z0-9_-]{32,256}$/D',$config['webhook_secret'] ?? '') || !str_starts_with($config['site_url'],'https://')) { zr_json(503,['error'=>'Configuration incomplete']); exit; }
    $me = zr_telegram($config,'getMe',[]);
    if (strcasecmp($me['username'] ?? '', $config['bot_username']) !== 0) { zr_json(409,['error'=>'Bot name does not match configuration']); exit; }
    $chat = zr_telegram($config,'getChat',['chat_id'=>$config['admin_chat_id']]);
    if (($chat['type'] ?? '') !== 'private') { zr_json(409,['error'=>'Administrator must start a private chat with the bot']); exit; }
    zr_telegram($config,'setMyCommands',['commands'=>[['command'=>'start','description'=>'Об отеле'],['command'=>'book','description'=>'Заявка на бронирование'],['command'=>'skip','description'=>'Не добавлять пожелания'],['command'=>'cancel','description'=>'Отменить заполнение'],['command'=>'id','description'=>'Узнать номер чата']]]);
    zr_telegram($config,'setWebhook',['url'=>rtrim($config['site_url'],'/').'/api/telegram.php','secret_token'=>$config['webhook_secret'],'max_connections'=>1,'allowed_updates'=>['message']]);
    zr_json(200,['ok'=>true,'bot'=>$me['username'],'webhook'=>rtrim($config['site_url'],'/').'/api/telegram.php']);
} catch (Throwable $error) { error_log('Zaliv bot connection failed'); zr_json(502,['error'=>'Connection failed. Check server access to Telegram and bot settings.']); }
