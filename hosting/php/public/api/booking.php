<?php
declare(strict_types=1);
require dirname(__DIR__,2).'/zaliv-private/app.php';
try {
    $config = zr_config();
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') { header('Allow: POST'); zr_json(405,['error'=>'Метод не поддерживается.']); exit; }
    if (!zr_origin($config)) { zr_json(403,['error'=>'Недопустимый источник запроса.']); exit; }
    if (!str_starts_with($_SERVER['CONTENT_TYPE'] ?? '', 'application/json')) { zr_json(415,['error'=>'Ожидается JSON.']); exit; }
    if (!zr_rate_limit($config,$_SERVER['REMOTE_ADDR'] ?? 'unknown')) { header('Retry-After: 900'); zr_json(429,['error'=>'Слишком много заявок. Позвоните +7 902 785-00-02.']); exit; }
    $data = zr_request();
    if (!empty($data['website'])) { zr_json(400,['error'=>'Не удалось отправить заявку.']); exit; }
    $booking = zr_validate($data);
    if (!zr_ready($config)) { zr_json(503,['error'=>'Онлайн-заявки пока подключаются. Позвоните +7 902 785-00-02.']); exit; }
    zr_enqueue($config,$booking);
    zr_json(202,['ok'=>true,'id'=>$booking['id']]);
    if (function_exists('fastcgi_finish_request')) fastcgi_finish_request();
    try { zr_drain($config,1); } catch (Throwable $error) { error_log('Zaliv queue delivery deferred to maintenance'); }
} catch (LengthException $error) { zr_json(413,['error'=>$error->getMessage()]); }
catch (JsonException | InvalidArgumentException $error) { zr_json(400,['error'=>$error instanceof JsonException?'Некорректный запрос.':$error->getMessage()]); }
catch (Throwable $error) { error_log('Zaliv booking failed'); if (!headers_sent()) zr_json(500,['error'=>'Не удалось принять заявку. Позвоните +7 902 785-00-02.']); }
