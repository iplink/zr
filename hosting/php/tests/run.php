<?php
declare(strict_types=1);
require dirname(__DIR__).'/private/bot.php';
$passed = 0;
function check(bool $condition,string $message): void { if(!$condition) throw new RuntimeException($message); }
function example_booking(): array { return ['house'=>'white','checkIn'=>'2099-05-20','checkOut'=>'2099-05-22','guests'=>'8','name'=>'Анна','phone'=>'+7 (902) 785-00-02','consent'=>true]; }
function run_test(string $name,callable $test): void { global $passed; $test(); $passed++; echo 'PASS: '.$name.PHP_EOL; }
function rejects(array $data): bool { try { zr_validate($data); return false; } catch (InvalidArgumentException $error) { return true; } }
$config = require dirname(__DIR__).'/private/config.example.php';
foreach (['smtp_password','telegram_token','admin_chat_id'] as $key) $config[$key] = 'test';
$temporary = sys_get_temp_dir().'/zaliv-php-test-'.bin2hex(random_bytes(10));
$config['data_dir'] = $temporary;
try {
    run_test('valid booking, UTF-8 and Russian phone',function () { $booking=zr_validate(example_booking()); check($booking['guests']===8,'Guest normalization'); check(zr_length($booking['name'])===4,'UTF-8 length'); check(str_contains(zr_text($booking),'Белый дом'),'House name'); });
    run_test('capacity and known house validation',function () { foreach(['bath','secluded'] as $house) check(rejects([...example_booking(),'house'=>$house,'guests'=>5]),'Capacity'); foreach(['constructor','unknown'] as $house) check(rejects([...example_booking(),'house'=>$house]),'Unknown house'); });
    run_test('dates, consent, phone and header injection rejection',function () { foreach([['checkIn'=>'2020-01-01'],['checkOut'=>'2099-05-19'],['checkIn'=>'2099-02-30'],['phone'=>'123'],['consent'=>'true'],['name'=>"Анна\r\nBcc: x"]] as $change) check(rejects([...example_booking(),...$change]),'Invalid booking accepted'); });
    run_test('complete bot conversation and consent',function () use($config) {
        $session=[]; $id=1;
        foreach(['/book','2','2099-05-20','2099-05-22','4','Анна','+79027850002'] as $text) { $result=zr_bot_step($session,$text,'123',$id++,$config); check($result['booking']===null,'Premature booking'); $session=$result['session']; }
        check(str_contains($result['reply'],'Проверьте заявку'),'No summary');
        $result=zr_bot_step($session,'Согласна','123',$id,$config); check($result['booking']['house']==='secluded','House'); check($result['booking']['id']==='tg-123-'.$id,'Deterministic id'); check($result['booking']['source']==='telegram','Source');
    });
    run_test('bot preserves step on invalid answer and honours cancel',function () use($config) {
        $s=zr_bot_step([],'/book','123',1,$config)['session'];$s=zr_bot_step($s,'3','123',2,$config)['session'];
        $r=zr_bot_step($s,'2020-01-01','123',3,$config);check($r['session']['step']===1,'Invalid date advanced step');check(str_contains($r['reply'],'прошлом'),'Error not explained');
        $r=zr_bot_step($s,'/cancel','123',4,$config);check(!isset($r['session']['step']),'Cancel kept state');
    });
    run_test('queue survives sender failure and retries only missing channel',function () use($config) {
        $booking=zr_validate(example_booking());zr_enqueue($config,$booking);
        $email=0;$telegram=0;$fail=true;
        $senders=['email'=>function()use(&$email){$email++;},'telegram'=>function()use(&$telegram,&$fail){$telegram++;if($fail)throw new RuntimeException('Simulated network outage');}];
        zr_drain($config,3,$senders);$file=zr_directory($config,'queue').'/'.$booking['id'].'.json';$record=zr_read($file);
        check($record['email']===true && $record['telegram']===false,'Channel state not persisted');
        $record['retryAt']=0;zr_write($file,$record);$fail=false;zr_drain($config,3,$senders);
        check($email===1 && $telegram===2,'Completed channel redelivered');check(!is_file($file),'Delivered record retained');
    });
    run_test('duplicate booking ids do not overwrite delivery markers',function () use($config) {
        $booking=zr_validate(example_booking());zr_enqueue($config,$booking);$file=zr_directory($config,'queue').'/'.$booking['id'].'.json';$record=zr_read($file);$record['email']=true;zr_write($file,$record);zr_enqueue($config,$booking);check(zr_read($file)['email']===true,'Duplicate erased marker');
    });
    run_test('rate limits are persisted and independent by client',function () use($config) { for($i=0;$i<10;$i++)check(zr_rate_limit($config,'127.0.0.1'),'Blocked too soon');check(!zr_rate_limit($config,'127.0.0.1'),'Limit failed');check(zr_rate_limit($config,'127.0.0.2'),'Other client blocked'); });
    echo $passed.' PHP tests passed.'.PHP_EOL;
} finally {
    if(is_dir($temporary)) { $files=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($temporary,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST); foreach($files as $file) {if($file->isDir())rmdir($file->getPathname());else unlink($file->getPathname());}rmdir($temporary); }
}
