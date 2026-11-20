<?php
declare(strict_types=1);
require dirname(__DIR__,2).'/zaliv-private/max.php';
try{
    $config=zr_config();
    if($_SERVER['REQUEST_METHOD']!=='POST'){zr_json(405,['error'=>'Method not allowed']);exit;}
    $secret=$_SERVER['HTTP_X_MAX_BOT_API_SECRET']??'';
    if(empty($config['max_webhook_secret'])||!hash_equals($config['max_webhook_secret'],$secret)){zr_json(403,['error'=>'Forbidden']);exit;}
    zr_max_handle($config,zr_request(32768));zr_json(200,['ok'=>true]);
}catch(JsonException|LengthException $error){zr_json(400,['error'=>'Invalid update']);}
catch(Throwable $error){error_log('Zaliv MAX webhook failed');zr_json(500,['error'=>'Retry later']);}
