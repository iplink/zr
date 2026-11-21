<?php
declare(strict_types=1);
require_once __DIR__.'/app.php';
function zr_bot_booking_id(string $chatId,int $updateId,array $config): string {
    return ($config['booking_source']??'telegram')==='max' ? 'max-'.hash('sha256',$chatId.':'.($config['max_event_id']??$updateId)) : 'tg-'.$chatId.'-'.$updateId;
}

// Pure transition: private storage and webhook delivery are handled by the caller.
function zr_bot_step(array $session, string $text, string $chatId, int $updateId, array $config): array {
    $prompts = ['Какой дом выберете?\n1 — Белый дом, 200 м², до 8 гостей\n2 — Уединённый, 100 м², до 4 гостей\n3 — Дом с баней, 65 м², до 4 гостей\n\nОтправьте 1, 2 или 3.', 'Дата заезда? Формат: ДД.ММ.ГГГГ.', 'Дата выезда? Формат: ДД.ММ.ГГГГ.', 'Сколько гостей, включая детей? Укажите число.', 'Как к вам обращаться?', 'Укажите телефон в формате +79027850002.'];
    $prompts[0] = str_replace('\\n', "\n", $prompts[0]);
    $reply = ''; $booking = null; $completed = false; $text = trim($text);
    if (($session['updated'] ?? 0) < time()-1800) $session = [];
    if ($text === '/id') $reply = 'Ваш chat_id: '.$chatId;
    elseif ($text === '/start' || $text === '/help') $reply = "Добро пожаловать в Залив-Ретрит 🌲\nТри авторских дома в хвойном лесу рядом с Горьковским водохранилищем.\n\n/book — оставить заявку\n/cancel — отменить заполнение\n/id — номер вашего чата\n\nСайт: ".$config['site_url']."\nТелефон: +7 902 785-00-02\nБронирование подтверждает администратор.";
    elseif ($text === '/cancel') { $accepted = ($session['step'] ?? -1) === 7; $session = []; $reply = $accepted ? 'Основная заявка уже принята. Дополнительные пожелания не добавлены.' : 'Заявка отменена. Начать заново: /book'; }
    elseif ($text === '/skip' && ($session['step'] ?? -1) === 7) { $session = []; $reply = 'Хорошо, заявка остаётся без дополнительных пожеланий. Администратор свяжется с вами.'; }
    elseif ($text === '/book') {
        if (!zr_ready($config) || (($config['booking_source']??'telegram')==='max'&&!zr_max_ready($config))) $reply = 'Приём заявок пока подключается. Позвоните +7 902 785-00-02.';
        else { $session = ['step'=>0,'data'=>[]]; $reply = $prompts[0]; }
    } elseif (!isset($session['step'])) $reply = 'Чтобы оставить заявку на отдых, отправьте /book.';
    else {
        $step = $session['step']; $data = $session['data']; $error = '';
        if ($step === 0) {
            $house = ['1'=>'white','2'=>'secluded','3'=>'bath'][$text] ?? null;
            if ($house === null) $error = $prompts[0]; else $data['house'] = $house;
        } elseif ($step === 1 || $step === 2) {
            $date = zr_parse_date($text);
            if ($date === null) $error = 'Введите существующую дату в формате ДД.ММ.ГГГГ.';
            elseif ($step === 1 && $date < zr_today()) $error = 'Заезд не может быть в прошлом.';
            elseif ($step === 2 && $date <= $data['checkIn']) $error = 'Выезд должен быть позже заезда.';
            else $data[$step === 1 ? 'checkIn' : 'checkOut'] = $date;
        } elseif ($step === 3) {
            $max = ZR_HOUSES[$data['house']]['capacity'];
            if (!ctype_digit($text) || (int)$text < 1 || (int)$text > $max) $error = 'Укажите от 1 до '.$max.' гостей.';
            else $data['guests'] = (int)$text;
        } elseif ($step === 4) {
            if (zr_length($text)<2 || zr_length($text)>80 || preg_match('/[\x00-\x1f]/',$text)) $error = 'Укажите имя от 2 до 80 символов.'; else $data['name'] = $text;
        } elseif ($step === 5) {
            if (!zr_valid_phone($text)) $error = 'Укажите российский телефон: +7 и ещё 10 цифр.'; else $data['phone'] = $text;
        } elseif ($step === 6) {
            if (!preg_match('/^соглас(ен|на)$/uiD',$text)) $error = 'Для отправки напишите «Согласен» или /cancel для отмены.';
            else {
                $completed = true;
                try {
                    $data['consent'] = true; $booking = zr_validate($data); $booking['id'] = zr_bot_booking_id($chatId,$updateId,$config); $booking['source'] = $config['booking_source']??'telegram';
                    $session = ['step'=>7,'data'=>$booking]; $reply = "Спасибо! Заявка принята. Администратор свяжется с вами для уточнения стоимости и подтверждения бронирования.\n\nЕсть ли у вас пожелания к отдыху? Напишите их одним сообщением — мы передадим администратору. Если пожеланий нет, отправьте /skip.";
                } catch (InvalidArgumentException $validationError) { $session = []; $reply = $validationError->getMessage().' Начните заново: /book'; }
            }
        } elseif ($step === 7) {
            if ($text === '' || zr_length($text)>1000 || str_starts_with($text,'/')) $error = 'Напишите пожелания одним сообщением до 1000 символов или отправьте /skip.';
            else { $completed = true; $booking = [...$data,'id'=>zr_bot_booking_id($chatId,$updateId,$config),'parentId'=>$data['id'],'kind'=>'wishes','comment'=>$text,'createdAt'=>gmdate('c')]; $session = []; $reply = 'Пожелания приняты и добавлены к вашей заявке. Спасибо!'; }
        }
        if ($error !== '') $reply = $error;
        elseif (!$completed) {
            $session['data'] = $data; $session['step'] = $step+1;
            if ($step+1 === 6) $reply = "Проверьте заявку:\n".ZR_HOUSES[$data['house']]['name']."\nЗаезд: ".zr_format_date($data['checkIn'])."\nВыезд: ".zr_format_date($data['checkOut'])."\nГостей: ".$data['guests']."\nИмя: ".$data['name']."\nТелефон: ".$data['phone']."\n\nДля ответа на заявку эти данные будут отправлены администратору на почту и в мессенджеры базы отдыха. Подробнее: ".$config['site_url']."/privacy.html\n\nОтправьте «Согласен», если согласны на обработку данных, или /cancel для отмены.";
            else $reply = $prompts[$step+1];
        }
    }
    $session['updated'] = time();
    return ['session'=>$session,'reply'=>$reply,'booking'=>$booking];
}
