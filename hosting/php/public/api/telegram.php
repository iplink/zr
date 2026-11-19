<?php
declare(strict_types=1);
require dirname(__DIR__,2).'/zaliv-private/bot.php';
try {
    $config = zr_config();
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') { zr_json(405,['error'=>'Method not allowed']); exit; }
    $secret = $_SERVER['HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN'] ?? '';
    if (empty($config['webhook_secret']) || !hash_equals($config['webhook_secret'],$secret)) { zr_json(403,['error'=>'Forbidden']); exit; }
    $update = zr_request(16384); $message = $update['message'] ?? null;
    if (!is_int($update['update_id'] ?? null) || !is_array($message) || ($message['chat']['type'] ?? '') !== 'private' || !is_int($message['chat']['id'] ?? null) || !is_string($message['text'] ?? null)) { zr_json(200,['ok'=>true]); exit; }
    $chatId = (string)$message['chat']['id'];
    if (!ctype_digit($chatId) || strlen($message['text']) > 4096) { zr_json(200,['ok'=>true]); exit; }
    $prefix = zr_directory($config,'sessions').'/'.$chatId;
    $reply = zr_locked($prefix.'.lock',function () use ($prefix,$message,$update,$chatId,$config) {
        $state = zr_read($prefix.'.json');
        if (($state['lastUpdate'] ?? -1) >= $update['update_id']) return null;
        $result = zr_bot_step($state['session'] ?? [],$message['text'],$chatId,$update['update_id'],$config);
        if ($result['booking'] !== null) zr_enqueue($config,$result['booking']);
        zr_write($prefix.'.json',['session'=>$result['session'],'lastUpdate'=>$update['update_id']]);
        return $result['reply'];
    });
    // Telegram executes this method from the webhook response; no polling daemon.
    zr_json(200,$reply===null?['ok'=>true]:['method'=>'sendMessage','chat_id'=>$chatId,'text'=>$reply]);
    // Administrator notifications are delivered by private/cron.php.
} catch (JsonException | LengthException $error) { zr_json(400,['error'=>'Invalid update']); }
catch (Throwable $error) { error_log('Zaliv webhook failed'); zr_json(500,['error'=>'Retry later']); }
