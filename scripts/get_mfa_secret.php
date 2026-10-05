<?php

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$email = $argv[1] ?? '';
if ($email) {
    $user = App\Models\User::where('email', $email)->first();
    echo $user?->two_factor_secret ?? '';
}
