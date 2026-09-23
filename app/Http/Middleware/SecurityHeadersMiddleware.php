<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SecurityHeadersMiddleware
{
    /**
     * Handle an incoming request and attach enterprise HTTP security headers.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        // Core transport and framing security
        $response->headers->set('X-Frame-Options', 'SAMEORIGIN');
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->headers->set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

        // HSTS enforcement when operating on HTTPS
        if ($request->isSecure()) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        // Build tailored Content Security Policy (CSP)
        $csp = $this->buildContentSecurityPolicy();
        $response->headers->set('Content-Security-Policy', $csp);

        return $response;
    }

    /**
     * Build the tailored Content Security Policy string based on environment.
     */
    protected function buildContentSecurityPolicy(): string
    {
        $isLocalOrTesting = app()->environment('local', 'testing');

        // Script sources
        $scriptSrc = ["'self'", "'unsafe-inline'"];
        if ($isLocalOrTesting) {
            $scriptSrc[] = "'unsafe-eval'";
            $scriptSrc[] = 'http://localhost:5173';
            $scriptSrc[] = 'http://127.0.0.1:5173';
        }

        // Style sources (includes Google Fonts CSS and Vite dev server)
        $styleSrc = ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'];
        if ($isLocalOrTesting) {
            $styleSrc[] = 'http://localhost:5173';
            $styleSrc[] = 'http://127.0.0.1:5173';
        }

        // Font sources (includes Google Fonts files)
        $fontSrc = ["'self'", 'https://fonts.gstatic.com', 'data:'];

        // Image sources (includes S3 signed URLs and inline data/blob previews)
        $imgSrc = [
            "'self'",
            'data:',
            'blob:',
            'https://*.amazonaws.com',
            'https://*.s3.amazonaws.com',
        ];

        // Connect sources (includes Inertia JSON, XHR, Vite HMR WebSocket in dev, and S3 direct)
        $connectSrc = ["'self'", 'https://*.amazonaws.com'];
        if ($isLocalOrTesting) {
            $connectSrc[] = 'http://localhost:5173';
            $connectSrc[] = 'http://127.0.0.1:5173';
            $connectSrc[] = 'ws://localhost:5173';
            $connectSrc[] = 'ws://127.0.0.1:5173';
            $connectSrc[] = 'http://localhost:4747';
            $connectSrc[] = 'http://127.0.0.1:4747';
            $connectSrc[] = 'ws://localhost:4747';
            $connectSrc[] = 'ws://127.0.0.1:4747';
        }

        $directives = [
            "default-src 'self'",
            'script-src ' . implode(' ', $scriptSrc),
            'style-src ' . implode(' ', $styleSrc),
            'font-src ' . implode(' ', $fontSrc),
            'img-src ' . implode(' ', $imgSrc),
            'connect-src ' . implode(' ', $connectSrc),
            "frame-ancestors 'self'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
        ];

        return implode('; ', $directives);
    }
}
