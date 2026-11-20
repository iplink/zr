#!/usr/bin/env bash
set -euo pipefail
umask 077

ARCHIVE=${1:?Archive name required}
case "$ARCHIVE" in .zaliv-upload-[0-9]*.zip) ;; *) echo 'Invalid archive name'; exit 1 ;; esac
case "$ARCHIVE" in */*) echo 'Invalid archive path'; exit 1 ;; esac
HOME_REAL=$(cd "$HOME" && pwd -P)
ARCHIVE_PATH="$HOME_REAL/$ARCHIVE"
SCRIPT_PATH="$HOME_REAL/${ARCHIVE%.zip}.sh"
STAGE=''
cleanup() {
  # These are exactly the two temporary files uploaded for this release.
  rm -f -- "$ARCHIVE_PATH" "$SCRIPT_PATH"
}
trap cleanup EXIT

command -v unzip >/dev/null
command -v tar >/dev/null
command -v crontab >/dev/null
test -f "$ARCHIVE_PATH"

ROOTS=()
for candidate in "$HOME_REAL/www/zaliv-retreat.ru" "$HOME_REAL/data/www/zaliv-retreat.ru" "/var/www/u3735216/data/www/zaliv-retreat.ru"; do
  if [ -d "$candidate" ]; then ROOTS+=("$(cd "$candidate" && pwd -P)"); fi
done
if [ ${#ROOTS[@]} -eq 0 ]; then
  while IFS= read -r candidate; do ROOTS+=("$(cd "$candidate" && pwd -P)"); done < <(find "$HOME_REAL" -maxdepth 5 -type d -name zaliv-retreat.ru 2>/dev/null)
fi
mapfile -t ROOTS < <(printf '%s\n' "${ROOTS[@]}" | sed '/^$/d' | sort -u)
if [ ${#ROOTS[@]} -ne 1 ]; then echo 'Cannot identify a unique site directory. No site files changed.'; exit 1; fi
SITE_ROOT=${ROOTS[0]}
case "$SITE_ROOT" in "$HOME_REAL"/*/zaliv-retreat.ru|/var/www/u3735216/data/www/zaliv-retreat.ru) ;; *) echo 'Unexpected site location'; exit 1 ;; esac
PARENT=$(dirname "$SITE_ROOT")
PRIVATE="$PARENT/zaliv-private"
test ! -L "$PRIVATE"
test -w "$SITE_ROOT"
test -w "$PARENT"

PHP=''
for candidate in /opt/php83/bin/php /opt/php/8.3/bin/php /usr/bin/php83 "$(command -v php || true)"; do
  if [ -x "$candidate" ] && "$candidate" -r 'exit(PHP_SAPI === "cli" && PHP_VERSION_ID >= 80300 && extension_loaded("curl") && extension_loaded("openssl") && extension_loaded("ctype") ? 0 : 1);' 2>/dev/null; then PHP=$candidate; break; fi
done
if [ -z "$PHP" ]; then echo 'PHP 8.3 CLI with required extensions was not found. No site files changed.'; exit 1; fi

STAGE=$(mktemp -d "$PARENT/.zaliv-release-XXXXXXXX")
unzip -q "$ARCHIVE_PATH" -d "$STAGE"
test -f "$STAGE/zaliv-retreat.ru/index.html"
test -f "$STAGE/zaliv-retreat.ru/.htaccess"
test -f "$STAGE/zaliv-private/config.php"
while IFS= read -r -d '' file; do "$PHP" -l "$file" >/dev/null; done < <(find "$STAGE" -name '*.php' -type f -print0)
"$PHP" -r 'require $argv[1]."/app.php"; if (!zr_ready(zr_config()) || !zr_max_ready(zr_config())) exit(1);' "$STAGE/zaliv-private"

BACKUP="$HOME_REAL/.zaliv-backups/$(date -u +%Y%m%dT%H%M%SZ)-$$"
mkdir -p "$BACKUP"
chmod 700 "$HOME_REAL/.zaliv-backups" "$BACKUP"
tar -czf "$BACKUP/site.tar.gz" -C "$PARENT" zaliv-retreat.ru
if [ -d "$PRIVATE" ]; then tar -czf "$BACKUP/private.tar.gz" -C "$PARENT" zaliv-private; fi
crontab -l >"$BACKUP/crontab.txt" 2>/dev/null || true

find "$STAGE/zaliv-retreat.ru" -type d -exec chmod 755 {} +
find "$STAGE/zaliv-retreat.ru" -type f -exec chmod 644 {} +
find "$STAGE/zaliv-private" -type d -exec chmod 700 {} +
find "$STAGE/zaliv-private" -type f -exec chmod 600 {} +
mkdir -p "$PRIVATE"
chmod 700 "$PRIVATE"
cp -a "$STAGE/zaliv-private/." "$PRIVATE/"
cp -a "$STAGE/zaliv-retreat.ru/." "$SITE_ROOT/"

CRON_LINE="* * * * * $PHP '$PRIVATE/cron.php' >/dev/null 2>&1"
if ! grep -Fq "$PRIVATE/cron.php" "$BACKUP/crontab.txt"; then
  { cat "$BACKUP/crontab.txt"; printf '\n%s\n' "$CRON_LINE"; } | crontab -
fi
printf 'ZALIV_DEPLOY_OK\nSite: %s\nPrivate: %s\nPHP: %s\nBackup: %s\n' "$SITE_ROOT" "$PRIVATE" "$PHP" "$BACKUP"
