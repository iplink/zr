<?php
declare(strict_types=1);

const ZR_HOUSES = [
    'white' => ['name' => 'Белый дом', 'capacity' => 8],
    'secluded' => ['name' => 'Уединённый', 'capacity' => 4],
    'bath' => ['name' => 'Дом с баней', 'capacity' => 4],
];

function zr_config(): array {
    $file = __DIR__ . '/config.php';
    return is_file($file) ? require $file : require __DIR__ . '/config.example.php';
}
function zr_ready(array $config): bool {
    foreach (['site_url','email_to','smtp_host','smtp_user','smtp_password','smtp_from','telegram_token','admin_chat_id'] as $key) {
        if (empty($config[$key]) || !is_string($config[$key])) return false;
    }
    return true;
}
function zr_directory(array $config, string $kind): string {
    $base = $config['data_dir'] ?: __DIR__ . '/data';
    $directory = $base . '/' . $kind;
    if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) throw new RuntimeException('Storage unavailable');
    return $directory;
}
function zr_read(string $file): array {
    if (!is_file($file)) return [];
    $value = json_decode((string) file_get_contents($file), true, 64, JSON_THROW_ON_ERROR);
    if (!is_array($value)) throw new RuntimeException('Invalid storage record');
    return $value;
}
function zr_write(string $file, array $record): void {
    $content = json_encode($record, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    $temporary = $file . '.tmp-' . bin2hex(random_bytes(6));
    if (file_put_contents($temporary, $content, LOCK_EX) !== strlen($content)) throw new RuntimeException('Storage write failed');
    chmod($temporary, 0600);
    if (!rename($temporary, $file)) { @unlink($temporary); throw new RuntimeException('Storage update failed'); }
}
function zr_locked(string $file, callable $callback): mixed {
    $handle = fopen($file, 'c');
    if ($handle === false) throw new RuntimeException('Lock unavailable');
    chmod($file, 0600);
    try {
        if (!flock($handle, LOCK_EX)) throw new RuntimeException('Lock unavailable');
        return $callback();
    } finally { flock($handle, LOCK_UN); fclose($handle); }
}
function zr_today(): string { return (new DateTimeImmutable('now', new DateTimeZone('Europe/Moscow')))->format('Y-m-d'); }
function zr_valid_date(mixed $date): bool {
    if (!is_string($date) || !preg_match('/^\d{4}-\d{2}-\d{2}$/D', $date)) return false;
    [$year,$month,$day] = array_map('intval', explode('-', $date));
    return checkdate($month,$day,$year);
}
function zr_parse_date(string $value): ?string {
    if (!preg_match('/^(\d{2})\.(\d{2})\.(\d{4})$/D',trim($value),$parts)) return null;
    $iso = $parts[3].'-'.$parts[2].'-'.$parts[1];
    return zr_valid_date($iso) ? $iso : null;
}
function zr_format_date(string $iso): string {
    return preg_match('/^(\d{4})-(\d{2})-(\d{2})$/D',$iso,$parts) ? $parts[3].'.'.$parts[2].'.'.$parts[1] : $iso;
}
function zr_length(string $text): int { return preg_match_all('/./us', $text) ?: 0; }
function zr_valid_phone(string $phone): bool {
    return (bool) preg_match('/^[+\d\s()\-]{10,24}$/D', $phone) && (bool) preg_match('/^[78]\d{10}$/D', preg_replace('/\D/', '', $phone));
}
function zr_validate(array $data, ?string $today = null): array {
    $house = $data['house'] ?? null;
    if (!is_string($house) || !isset(ZR_HOUSES[$house])) throw new InvalidArgumentException('Выберите дом.');
    if (!zr_valid_date($data['checkIn'] ?? null) || !zr_valid_date($data['checkOut'] ?? null) || $data['checkIn'] < ($today ?? zr_today()) || $data['checkOut'] <= $data['checkIn']) throw new InvalidArgumentException('Проверьте даты: выезд должен быть позже заезда, заезд — не в прошлом.');
    $guests = filter_var($data['guests'] ?? null, FILTER_VALIDATE_INT);
    if ($guests === false || $guests < 1 || $guests > ZR_HOUSES[$house]['capacity']) throw new InvalidArgumentException('В этом доме может разместиться до ' . ZR_HOUSES[$house]['capacity'] . ' гостей.');
    $name = is_string($data['name'] ?? null) ? trim($data['name']) : '';
    if (zr_length($name) < 2 || zr_length($name) > 80 || preg_match('/[\x00-\x1f]/', $name)) throw new InvalidArgumentException('Укажите имя от 2 до 80 символов.');
    $phone = is_string($data['phone'] ?? null) ? trim($data['phone']) : '';
    if (!zr_valid_phone($phone)) throw new InvalidArgumentException('Укажите российский телефон: +7 и ещё 10 цифр.');
    if (($data['consent'] ?? null) !== true) throw new InvalidArgumentException('Необходимо согласие на обработку данных.');
    $comment = is_string($data['comment'] ?? null) ? trim($data['comment']) : '';
    if (zr_length($comment) > 1000) throw new InvalidArgumentException('Пожелания должны быть не длиннее 1000 символов.');
    return ['id'=>'web-'.bin2hex(random_bytes(16)), 'house'=>$house, 'checkIn'=>$data['checkIn'], 'checkOut'=>$data['checkOut'], 'guests'=>$guests, 'name'=>$name, 'phone'=>$phone, 'comment'=>$comment, 'consent'=>true, 'createdAt'=>gmdate('c'), 'source'=>'website'];
}
function zr_text(array $booking): string {
    return implode("\n", [($booking['kind'] ?? '') === 'wishes' ? 'Пожелания к заявке · Залив-Ретрит' : 'Новая заявка · Залив-Ретрит', 'Номер заявки: '.($booking['parentId'] ?? $booking['id']), ...(isset($booking['parentId']) ? ['Номер дополнения: '.$booking['id']] : []), 'Источник: '.($booking['source']==='telegram'?'Telegram-бот':'Сайт'), 'Дом: '.ZR_HOUSES[$booking['house']]['name'], 'Заезд: '.zr_format_date($booking['checkIn']), 'Выезд: '.zr_format_date($booking['checkOut']), 'Гостей: '.$booking['guests'], 'Имя: '.$booking['name'], 'Телефон: '.$booking['phone'], 'Пожелания: '.($booking['comment'] ?: '—'), 'Согласие на обработку данных: получено', 'Необходимо связаться с гостем и подтвердить условия.']);
}
function zr_enqueue(array $config, array $booking): void {
    if (!zr_ready($config)) throw new RuntimeException('NOT_CONFIGURED');
    if (!preg_match('/^(web-[a-f0-9]{32}|tg-\d+-\d+)$/D', $booking['id'])) throw new RuntimeException('Invalid booking id');
    $directory = zr_directory($config, 'queue');
    zr_locked($directory.'/write.lock', function () use ($directory, $booking) {
        $file = $directory.'/'.$booking['id'].'.json';
        if (!is_file($file)) zr_write($file, ['booking'=>$booking, 'email'=>false, 'telegram'=>false, 'attempts'=>0, 'retryAt'=>0]);
    });
}
function zr_email(array $config, array $booking): void {
    require_once __DIR__.'/vendor/PHPMailer/Exception.php';
    require_once __DIR__.'/vendor/PHPMailer/SMTP.php';
    require_once __DIR__.'/vendor/PHPMailer/PHPMailer.php';
    $mail = new PHPMailer\PHPMailer\PHPMailer(true);
    $mail->isSMTP(); $mail->Host = $config['smtp_host']; $mail->Port = (int)$config['smtp_port'];
    $mail->SMTPAuth = true; $mail->Username = $config['smtp_user']; $mail->Password = $config['smtp_password'];
    $mail->SMTPSecure = $mail->Port === 465 ? 'ssl' : 'tls'; $mail->Timeout = 8; $mail->getSMTPInstance()->Timelimit = 10;
    $mail->CharSet = 'UTF-8'; $mail->setFrom($config['smtp_from'], 'Залив-Ретрит'); $mail->addAddress($config['email_to']);
    $mail->Subject = (($booking['kind'] ?? '') === 'wishes' ? 'Пожелания к заявке: ' : 'Заявка: ').zr_format_date($booking['checkIn']).' · Залив-Ретрит';
    $mail->MessageID = '<'.$booking['id'].'@zaliv-retreat.ru>'; $mail->Body = zr_text($booking); $mail->send();
}
function zr_telegram(array $config, string $method, array $body): mixed {
    if (!extension_loaded('curl')) throw new RuntimeException('cURL unavailable');
    $curl = curl_init('https://api.telegram.org/bot'.$config['telegram_token'].'/'.$method);
    curl_setopt_array($curl, [CURLOPT_POST=>true, CURLOPT_POSTFIELDS=>json_encode($body,JSON_THROW_ON_ERROR), CURLOPT_HTTPHEADER=>['Content-Type: application/json'], CURLOPT_RETURNTRANSFER=>true, CURLOPT_CONNECTTIMEOUT=>5, CURLOPT_TIMEOUT=>10, CURLOPT_SSL_VERIFYPEER=>true, CURLOPT_SSL_VERIFYHOST=>2]);
    try {
        $response = curl_exec($curl); $code = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        if (!is_string($response) || $code !== 200) throw new RuntimeException('Telegram request failed');
        $result = json_decode($response,true,64,JSON_THROW_ON_ERROR);
        if (empty($result['ok'])) throw new RuntimeException('Telegram request failed');
        return $result['result'] ?? null;
    } finally { curl_close($curl); }
}
function zr_drain(array $config, int $limit = 3, array $senders = []): int {
    if (!zr_ready($config)) return 0;
    $directory = zr_directory($config, 'queue'); $handle = fopen($directory.'/drain.lock','c');
    if ($handle === false) throw new RuntimeException('Queue unavailable');
    if (!flock($handle, LOCK_EX | LOCK_NB)) { fclose($handle); return 0; }
    $processed = 0; $deadline = microtime(true) + 25;
    try {
        foreach (glob($directory.'/*.json') ?: [] as $file) {
            if ($processed >= $limit || microtime(true) > $deadline) break;
            $record = zr_read($file);
            if (($record['retryAt'] ?? PHP_INT_MAX) > time()) continue;
            $processed++;
            foreach (['email','telegram'] as $channel) {
                if ($record[$channel]) continue;
                try {
                    if (isset($senders[$channel])) $senders[$channel]($record['booking']);
                    elseif ($channel === 'email') zr_email($config, $record['booking']);
                    else zr_telegram($config,'sendMessage',['chat_id'=>$config['admin_chat_id'],'text'=>zr_text($record['booking'])]);
                    $record[$channel] = true; zr_write($file,$record);
                } catch (Throwable $error) { error_log('Zaliv delivery failed: '.$channel.', '.$record['booking']['id']); }
            }
            if ($record['email'] && $record['telegram']) unlink($file);
            else { $record['attempts']++; $record['retryAt'] = time() + min(3600, 30 * (2 ** min(7,$record['attempts']))); zr_write($file,$record); }
        }
    } finally { flock($handle,LOCK_UN); fclose($handle); }
    return $processed;
}
function zr_rate_limit(array $config, string $ip): bool {
    $prefix = zr_directory($config,'limits').'/'.hash('sha256',$ip);
    return zr_locked($prefix.'.lock', function () use ($prefix) {
        $entry = zr_read($prefix.'.json');
        if (($entry['until'] ?? 0) < time()) $entry = ['count'=>0,'until'=>time()+900];
        $entry['count']++; zr_write($prefix.'.json',$entry); return $entry['count'] <= 10;
    });
}
function zr_json(int $status, array $body): void {
    http_response_code($status); header('Content-Type: application/json; charset=utf-8'); header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff'); echo json_encode($body,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
}
function zr_request(int $limit = 8192): array {
    $body = file_get_contents('php://input',false,null,0,$limit+1);
    if ($body === false || strlen($body)>$limit) throw new LengthException('Слишком большой запрос.');
    $data = json_decode($body,true,64,JSON_THROW_ON_ERROR);
    if (!is_array($data)) throw new InvalidArgumentException('Некорректный запрос.');
    return $data;
}
function zr_origin(array $config): bool {
    if (empty($_SERVER['HTTP_ORIGIN'])) return true;
    return rtrim($_SERVER['HTTP_ORIGIN'],'/') === rtrim($config['site_url'],'/');
}
