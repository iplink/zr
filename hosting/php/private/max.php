<?php
declare(strict_types=1);
require_once __DIR__.'/app.php';
require_once __DIR__.'/bot.php';

function zr_max_api(array $config,string $method,string $endpoint,?array $body=null,array $query=[]): array {
    if (empty($config['max_token']) || !extension_loaded('curl')) throw new RuntimeException('MAX configuration unavailable');
    if (!preg_match('#^/[a-zA-Z0-9_/-]+$#D',$endpoint)) throw new RuntimeException('Invalid MAX endpoint');
    $url='https://platform-api2.max.ru'.$endpoint.($query?'?'.http_build_query($query):'');
    $curl=curl_init($url);
    $headers=['Authorization: '.$config['max_token']];if($body!==null)$headers[]='Content-Type: application/json';
    curl_setopt_array($curl,[CURLOPT_CUSTOMREQUEST=>$method,CURLOPT_HTTPHEADER=>$headers,CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>12,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_CAINFO=>$config['max_ca_file'] ?: __DIR__.'/certs/max-ca.pem']);
    if($body!==null)curl_setopt($curl,CURLOPT_POSTFIELDS,json_encode($body,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR));
    try {
        $raw=curl_exec($curl);$status=curl_getinfo($curl,CURLINFO_RESPONSE_CODE);
        if(!is_string($raw)||$status<200||$status>=300)throw new RuntimeException('MAX API request failed');
        $data=json_decode($raw,true,64,JSON_THROW_ON_ERROR);
        if(!is_array($data)||($data['success']??true)===false)throw new RuntimeException('MAX API request failed');return $data;
    }finally{curl_close($curl);}
}
function zr_max_send(array $config,string $chatId,string $text): void {
    if(!preg_match('/^-?\d+$/D',$chatId))throw new RuntimeException('Invalid MAX chat');
    $prefix=zr_directory($config,'max-send').'/'.hash('sha256',$chatId);
    zr_locked($prefix.'.lock',function()use($prefix,$config,$chatId,$text){
        $previous=zr_read($prefix.'.json');$wait=0.55-((microtime(true))-($previous['sentAt']??0));if($wait>0)usleep((int)($wait*1000000));
        zr_max_api($config,'POST','/messages',['text'=>$text],['chat_id'=>$chatId]);zr_write($prefix.'.json',['sentAt'=>microtime(true)]);
    });
}
function zr_max_normalize(array $update): ?array {
    if(($update['update_type']??'')==='bot_started'&&isset($update['chat_id'])&&empty($update['user']['is_bot']))return ['id'=>'start:'.$update['chat_id'].':'.($update['user']['user_id']??'').':'.($update['timestamp']??''),'chatId'=>(string)$update['chat_id'],'text'=>'/start'];
    $message=$update['message']??[];
    if(($update['update_type']??'')!=='message_created'||($message['recipient']['chat_type']??'')!=='dialog'||!empty($message['sender']['is_bot'])||!is_string($message['body']['text']??null)||!isset($message['recipient']['chat_id'])||empty($message['body']['mid']))return null;
    return ['id'=>'message:'.$message['body']['mid'],'chatId'=>(string)$message['recipient']['chat_id'],'text'=>$message['body']['text']];
}
function zr_max_handle(array $config,array $update,?callable $sender=null): void {
    $event=zr_max_normalize($update);if($event===null||strlen($event['text'])>16000||!preg_match('/^-?\d+$/D',$event['chatId']))return;
    $prefix=zr_directory($config,'max-sessions').'/'.hash('sha256',$event['chatId']);
    zr_locked($prefix.'.lock',function()use($prefix,$config,$event,$sender){
        $state=zr_read($prefix.'.json');$key=hash('sha256',$event['id']);
        if(!isset($state['receipts'][$key])){
            $botConfig=[...$config,'booking_source'=>'max','max_event_id'=>$event['id']];
            $result=zr_bot_step($state['session']??[],$event['text'],$event['chatId'],0,$botConfig);
            if($result['booking']!==null)zr_enqueue($config,$result['booking']);
            $state['session']=$result['session'];$state['receipts'][$key]=['text'=>$result['reply'],'sent'=>false,'createdAt'=>time()];
            foreach($state['receipts'] as $receiptId=>$receipt)if(($receipt['createdAt']??0)<time()-172800)unset($state['receipts'][$receiptId]);
            zr_write($prefix.'.json',$state);
        }
        if(empty($state['receipts'][$key]['sent'])){
            if($sender!==null)$sender($event['chatId'],$state['receipts'][$key]['text']);else zr_max_send($config,$event['chatId'],$state['receipts'][$key]['text']);
            $state['receipts'][$key]['sent']=true;zr_write($prefix.'.json',$state);
        }
    });
}
