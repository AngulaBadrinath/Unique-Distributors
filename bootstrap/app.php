<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: function (): void {
            \Illuminate\Support\Facades\Route::get('/health', \App\Http\Controllers\HealthCheckController::class)
                ->middleware('throttle:60,1')
                ->name('health');
            \Illuminate\Support\Facades\Route::get('/ready', \App\Http\Controllers\ReadyCheckController::class)
                ->middleware('throttle:60,1')
                ->name('ready');
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->trustProxies(at: env('TRUSTED_PROXIES', '*'));

        $middleware->web(append: [
            \App\Http\Middleware\SecurityHeadersMiddleware::class,
            \App\Http\Middleware\HandleInertiaRequests::class,
        ]);

        $middleware->alias([
            'account.active' => \App\Http\Middleware\EnsureAccountIsActive::class,
            'permission' => \App\Http\Middleware\EnsureUserHasPermission::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->is('health*') || $request->is('ready*') || $request->is('up*') || $request->expectsJson(),
        );

        $exceptions->respond(function (\Symfony\Component\HttpFoundation\Response $response, \Throwable $exception, Request $request) {
            $status = $response->getStatusCode();

            if (! $request->is('api/*') && ! $request->is('health*') && ! $request->is('ready*') && ! $request->is('up*') && ! $request->expectsJson()) {
                if (in_array($status, [403, 404, 503], true) || ($status === 500 && ! app()->hasDebugModeEnabled())) {
                    try {
                        return \Inertia\Inertia::render('Error', [
                            'status' => $status,
                            'message' => match ($status) {
                                403 => 'You do not have permission to access this administrative resource.',
                                404 => 'The page or operational resource you requested could not be found.',
                                503 => 'The service is temporarily unavailable for maintenance. Please try again shortly.',
                                default => 'An unexpected server error occurred. Please try again or contact support.',
                            },
                        ])->toResponse($request)->setStatusCode($status);
                    } catch (\Throwable $renderException) {
                        return response(
                            "<!DOCTYPE html><html><head><title>Service Unavailable</title></head><body><h1>Service Unavailable</h1><p>An unexpected error occurred. Please try again shortly.</p></body></html>",
                            $status,
                            ['Content-Type' => 'text/html; charset=UTF-8']
                        );
                    }
                }

                if ($status === 419) {
                    return back()->with([
                        'message' => 'The page expired, please try again.',
                    ]);
                }
            }

            return $response;
        });
    })->create();
