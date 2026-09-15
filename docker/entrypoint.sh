#!/bin/sh
set -e

# Adjust Apache listening port if PORT environment variable is provided (Render standard)
TARGET_PORT="${PORT:-80}"
if [ -f /etc/apache2/ports.conf ]; then
    sed -i "s/Listen 80/Listen ${TARGET_PORT}/g" /etc/apache2/ports.conf
fi
if [ -f /etc/apache2/sites-available/000-default.conf ]; then
    sed -i "s/<VirtualHost \*:80>/<VirtualHost \*:${TARGET_PORT}>/g" /etc/apache2/sites-available/000-default.conf
fi

# Ensure storage and cache permissions
chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache

exec "$@"
