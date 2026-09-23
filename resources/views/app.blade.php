<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">

        <title inertia>{{ app(\App\Services\System\ApplicationIdentityService::class)->getAppName() }}</title>
        <link rel="icon" href="{{ app(\App\Services\System\ApplicationIdentityService::class)->getFaviconPath() }}">
        <link rel="icon" type="image/svg+xml" href="/branding/favicon.svg">
        <link rel="icon" type="image/png" sizes="32x32" href="/branding/favicon-32.png">
        <link rel="icon" type="image/png" sizes="16x16" href="/branding/favicon-16.png">
        <link rel="apple-touch-icon" sizes="180x180" href="/branding/favicon-180.png">

        <!-- Typography: Inter font -->
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">

        <!-- Inertia & Vite Assets -->
        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.tsx'])
        @inertiaHead
    </head>
    <body class="font-sans antialiased bg-background text-foreground min-h-screen">
        @inertia
    </body>
</html>
