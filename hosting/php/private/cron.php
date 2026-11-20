<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__.'/app.php';
try {
    $config = zr_config();
    if (!zr_ready($config)) throw new RuntimeException('Booking configuration is incomplete');
    zr_drain($config,10);
    // Session contents expire after 30 minutes; duplicate-update receipts remain
    // for two days so Telegram retries cannot recreate an accepted booking.
    foreach (['sessions'=>172800,'max-sessions'=>172800,'limits'=>1800] as $kind=>$lifetime) {
        foreach (glob(zr_directory($config,$kind).'/*.json') ?: [] as $file) {
            if ($kind === 'sessions' || $kind === 'max-sessions') zr_locked(substr($file,0,-5).'.lock',function () use ($file) {
                $record = zr_read($file);
                if (isset($record['session']['step']) && ($record['session']['updated'] ?? 0)<time()-1800) {
                    $record['session'] = []; zr_write($file,$record);
                }
            });
            if (filemtime($file) >= time()-$lifetime) continue;
            zr_locked(substr($file,0,-5).'.lock', function () use ($file,$lifetime) {
                clearstatcache(true,$file);
                if (is_file($file) && filemtime($file)<time()-$lifetime) unlink($file);
            });
        }
    }
} catch (Throwable $error) { error_log('Zaliv maintenance failed; check configuration, storage and network'); exit(1); }
