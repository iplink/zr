<?php
declare(strict_types=1);
require dirname(__DIR__,2).'/zaliv-private/max.php';
try{
    $config=zr_config();
    if($_SERVER['REQUEST_METHOD']!=='POST'){zr_json(405,['error'=>'Method not allowed']);exit;}
    if(empty($config['setup_secret'])||!hash_equals($config['setup_secret'],$_SERVER['HTTP_X_ZALIV_SETUP']??'')||!zr_origin($config)){zr_json(403,['error'=>'Forbidden']);exit;}
    if(!zr_max_ready($config)||!preg_match('/^[A-Za-z0-9_-]{32,256}$/D',$config['max_webhook_secret']??'')||!str_starts_with($config['site_url'],'https://')){zr_json(503,['error'=>'MAX configuration incomplete']);exit;}
    $me=zr_max_api($config,'GET','/me');
    if(empty($me['is_bot'])||(!empty($config['max_username'])&&strcasecmp($me['username']??'',$config['max_username'])!==0)){zr_json(409,['error'=>'MAX bot identity mismatch']);exit;}
    zr_max_api($config,'PATCH','/me/commands',['commands'=>[['name'=>'start','description'=>'Об отеле'],['name'=>'book','description'=>'Заявка на бронирование'],['name'=>'skip','description'=>'Пропустить пожелания'],['name'=>'cancel','description'=>'Отменить заполнение'],['name'=>'id','description'=>'Номер чата']]]);
    $url=rtrim($config['site_url'],'/').'/api/max.php';
    zr_max_api($config,'POST','/subscriptions',['url'=>$url,'update_types'=>['message_created','bot_started'],'secret'=>$config['max_webhook_secret']]);
    zr_json(200,['ok'=>true,'bot'=>$me['username'],'webhook'=>$url]);
}catch(Throwable $error){error_log('Zaliv MAX connection failed');zr_json(502,['error'=>'MAX connection failed; check token, certificate and network']);}
