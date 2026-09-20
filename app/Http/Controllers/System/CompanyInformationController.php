<?php

namespace App\Http\Controllers\System;

use App\Http\Controllers\Controller;
use App\Http\Requests\System\UpdateCompanyInformationRequest;
use App\Services\System\CompanyInformationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CompanyInformationController extends Controller
{
    public function __construct(
        protected CompanyInformationService $companyInformationService
    ) {}

    /**
     * Display the company information settings screen.
     */
    public function index(Request $request): Response
    {
        $company = $this->companyInformationService->getPublicDetails();

        return Inertia::render('System/CompanyInformation/Index', [
            'company' => $company,
        ]);
    }

    /**
     * Update the company information settings.
     */
    public function update(UpdateCompanyInformationRequest $request): RedirectResponse|JsonResponse
    {
        $actor = $request->user();
        $dto = $request->toDto();

        $updated = $this->companyInformationService->update(
            data: $dto,
            actor: $actor,
            ip: $request->ip()
        );

        if ($request->wantsJson()) {
            return response()->json([
                'message' => 'Company information updated successfully.',
                'company' => $updated->toPublicArray(),
            ]);
        }

        return redirect()->route('system.company.index')->with('status', 'Company information updated successfully.');
    }
}
