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

# Clear any stale bootstrap caches to ensure runtime environment variables take effect
rm -f /var/www/html/bootstrap/cache/config.php
rm -f /var/www/html/bootstrap/cache/routes*.php
rm -f /var/www/html/bootstrap/cache/events*.php

# Diagnostic check for essential encryption key
if [ -z "$APP_KEY" ]; then
    echo "WARNING: APP_KEY environment variable is not set! Encrypted sessions and cookies will fail." >&2
fi

# Run database migrations safely if database is configured
if [ -n "$DATABASE_URL" ] || [ -n "$DB_HOST" ]; then
    echo "Running database migrations on container startup..."
    php artisan migrate --force --isolated || echo "WARNING: Database migration failed or database temporarily unreachable during startup." >&2
fi

# Ensure storage and cache permissions
chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache

exec "$@"
