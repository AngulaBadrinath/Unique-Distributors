<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HealthCheckController extends Controller
{
    /**
     * Perform lightweight application liveness check.
     * Returns 200 whenever the web server and PHP runtime are operational.
     */
    public function __invoke(Request $request): JsonResponse
    {
        return response()->json([
            'status' => 'healthy',
            'timestamp' => now()->toIso8601String(),
            'application' => [
                'name' => app(\App\Services\System\CompanyInformationService::class)->get()?->legal_name ?? config('app.name', 'Wholesale Distribution'),
                'environment' => config('app.env'),
            ],
        ], 200);
    }
}
