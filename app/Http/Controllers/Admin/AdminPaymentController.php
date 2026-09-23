<?php

namespace App\Http\Controllers\Admin;

use App\Enums\PaymentMethod;
use App\Enums\PaymentRejectionReason;
use App\Enums\PaymentReversalReason;
use App\Enums\PaymentTransactionStatus;
use App\Enums\Permission;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Payment\AdminPaymentIndexRequest;
use App\Http\Requests\Payment\CorrectPaymentRequest;
use App\Http\Requests\Payment\CreateCashPaymentRequest;
use App\Http\Requests\Payment\CreateChequePaymentRequest;
use App\Http\Requests\Payment\CreateMoneyOrderPaymentRequest;
use App\Http\Requests\Payment\RejectPaymentRequest;
use App\Http\Requests\Payment\ReversePaymentRequest;
use App\Models\Customer;
use App\Models\Payment;
use App\Services\Auth\PermissionService;
use App\Services\Payment\PaymentEvidenceService;
use App\Services\Payment\PaymentReversalService;
use App\Services\Payment\PaymentService;
use App\Services\Payment\PaymentVerificationService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AdminPaymentController extends Controller
{
    public function __construct(
        protected PermissionService $permissionService,
        protected PaymentEvidenceService $evidenceService,
        protected PaymentService $paymentService,
        protected PaymentVerificationService $verificationService,
        protected PaymentReversalService $reversalService,
    ) {}

    /**
     * Display the Admin Payments Workspace.
     *
     * @throws AuthorizationException
     */
    public function index(AdminPaymentIndexRequest $request): Response|JsonResponse
    {
        $actor = $request->user();
        $this->permissionService->authorize($actor, Permission::PAYMENT_VERIFY);

        $badgeCounts = PaymentVerificationService::getBadgeCounts($actor);
        $activeTab = $request->validated('tab', 'all');
        $statusFilter = $request->validated('status');
        $methodFilter = $request->validated('method');
        $searchTerm = $request->validated('search');
        $customerId = $request->validated('customer_id');
        $perPage = (int) $request->validated('per_page', 15);

        $query = Payment::with([
            'customer:id,name,code,contact_name,phone,email',
            'order:id,order_number,grand_total,payment_status',
            'recordedBy:id,name,role',
            'verifiedBy:id,name,role',
            'rejectedBy:id,name,role',
            'reversedBy:id,name,role',
        ]);

        // 1. Tab-based status filtering
        if ($activeTab === 'pending_verification') {
            $query->pending();
        } elseif ($activeTab === 'verified') {
            $query->verified();
        } elseif ($activeTab === 'rejected') {
            $query->rejected();
        } elseif ($activeTab === 'reversed') {
            $query->reversed();
        } elseif (! empty($statusFilter)) {
            $query->filterByStatus($statusFilter);
        }

        // 2. Method filtering
        if (! empty($methodFilter) && $methodFilter !== 'ALL') {
            $query->filterByMethod($methodFilter);
        }

        // 3. Customer filtering
        if (! empty($customerId)) {
            $query->forCustomer((int) $customerId);
        }

        // 4. Search query
        if (! empty($searchTerm)) {
            $query->search($searchTerm);
        }

        // 5. Anti-IDOR scoping for salesman role
        $query->forUser($actor);

        $payments = $query->orderBy('payment_date', 'desc')
            ->orderBy('id', 'desc')
            ->paginate($perPage)
            ->withQueryString();

        if ($request->expectsJson() || $request->wantsJson()) {
            return response()->json([
                'payments' => $payments,
                'counts' => $badgeCounts,
                'active_tab' => $activeTab,
            ]);
        }

        return Inertia::render('Admin/Payments/Index', [
            'payments' => $payments,
            'counts' => $badgeCounts,
            'filters' => [
                'tab' => $activeTab,
                'status' => $statusFilter,
                'method' => $methodFilter,
                'search' => $searchTerm,
                'customer_id' => $customerId,
                'per_page' => $perPage,
            ],
            'customers' => Customer::active()->select('id', 'name', 'code')->orderBy('name')->get(),
            'userPermissions' => $this->permissionService->getPermissionsForUser($actor),
        ]);
    }

    /**
     * Store a new cash payment entry from admin workspace.
     */
    public function storeCash(CreateCashPaymentRequest $request): JsonResponse|RedirectResponse
    {
        $actor = $request->user();
        $payment = $this->paymentService->recordCashPayment($request->validated(), $actor);

        if ($request->expectsJson() || $request->wantsJson()) {
            return response()->json([
                'message' => "Cash payment {$payment->payment_number} recorded successfully.",
                'payment' => $payment->load(['customer', 'order']),
            ], 201);
        }

        return redirect()->back()->with('success', "Cash payment {$payment->payment_number} recorded successfully.");
    }

    /**
     * Store a new cheque payment entry from admin workspace.
     */
    public function storeCheque(CreateChequePaymentRequest $request): JsonResponse|RedirectResponse
    {
        $actor = $request->user();
        $evidenceFile = $request->file('evidence');
        $payment = $this->paymentService->recordChequePayment($request->validated(), $evidenceFile, $actor);

        if ($request->expectsJson() || $request->wantsJson()) {
            return response()->json([
                'message' => "Cheque payment {$payment->payment_number} recorded successfully.",
                'payment' => $payment->load(['customer', 'order']),
            ], 201);
        }

        return redirect()->back()->with('success', "Cheque payment {$payment->payment_number} recorded successfully.");
    }

    /**
     * Store a new money order payment entry from admin workspace.
     */
    public function storeMoneyOrder(CreateMoneyOrderPaymentRequest $request): JsonResponse|RedirectResponse
    {
        $actor = $request->user();
        $evidenceFile = $request->file('evidence');
        $payment = $this->paymentService->recordMoneyOrderPayment($request->validated(), $evidenceFile, $actor);

        if ($request->expectsJson() || $request->wantsJson()) {
            return response()->json([
                'message' => "Money order payment {$payment->payment_number} recorded successfully.",
                'payment' => $payment->load(['customer', 'order']),
            ], 201);
        }

        return redirect()->back()->with('success', "Money order payment {$payment->payment_number} recorded successfully.");
    }

    /**
     * Verify and reconcile an incoming payment entry.
     *
     * @throws AuthorizationException
     */
    public function verify(Request $request, Payment $payment): JsonResponse|RedirectResponse
    {
        Gate::authorize('verify', $payment);

        $actor = $request->user();
        $verifiedPayment = $this->verificationService->verifyPayment($payment, $actor);

        if ($request->expectsJson() || $request->wantsJson()) {
            return response()->json([
                'message' => "Payment {$verifiedPayment->payment_number} successfully verified.",
                'payment' => $verifiedPayment,
            ]);
        }

        return redirect()->back()->with('success', "Payment {$verifiedPayment->payment_number} verified and reconciled.");
    }

    /**
     * Reject a pending payment with documented operational reason.
     *
     * @throws AuthorizationException
     */
    public function reject(RejectPaymentRequest $request, Payment $payment): JsonResponse|RedirectResponse
    {
        Gate::authorize('reject', $payment);

        $actor = $request->user();
        $reason = PaymentRejectionReason::from($request->validated('rejection_reason_code'));
        $notes = (string) $request->validated('rejection_notes');

        $rejectedPayment = $this->verificationService->rejectPayment($payment, $actor, $reason, $notes);

        if ($request->expectsJson() || $request->wantsJson()) {
            return response()->json([
                'message' => "Payment {$rejectedPayment->payment_number} has been rejected.",
                'payment' => $rejectedPayment,
            ]);
        }

        return redirect()->back()->with('success', "Payment {$rejectedPayment->payment_number} rejected.");
    }

    /**
     * Correct and resubmit a rejected payment.
     *
     * @throws AuthorizationException
     */
    public function correct(CorrectPaymentRequest $request, Payment $payment): JsonResponse|RedirectResponse
    {
        Gate::authorize('correct', $payment);

        $actor = $request->user();
        $evidenceFile = $request->file('evidence');
        $resubmittedPayment = $this->paymentService->correctAndResubmitPayment($payment, $request->validated(), $evidenceFile, $actor);

        if ($request->expectsJson() || $request->wantsJson()) {
            return response()->json([
                'message' => "Payment {$resubmittedPayment->payment_number} corrected and resubmitted for verification.",
                'payment' => $resubmittedPayment,
            ]);
        }

        return redirect()->back()->with('success', "Payment {$resubmittedPayment->payment_number} corrected and resubmitted.");
    }

    /**
     * Authoritatively reverse a verified payment (e.g. bounced cheque, NSF, bank dispute).
     *
     * @throws AuthorizationException
     */
    public function reverse(ReversePaymentRequest $request, Payment $payment): JsonResponse|RedirectResponse
    {
        Gate::authorize('reverse', $payment);

        $actor = $request->user();
        $reason = PaymentReversalReason::from($request->validated('reversal_reason_code'));
        $notes = (string) $request->validated('reversal_notes');

        $reversedPayment = $this->reversalService->reversePayment($payment, $actor, $reason, $notes);

        if ($request->expectsJson() || $request->wantsJson()) {
            return response()->json([
                'message' => "Payment {$reversedPayment->payment_number} has been reversed.",
                'payment' => $reversedPayment,
            ]);
        }

        return redirect()->back()->with('success', "Payment {$reversedPayment->payment_number} reversed.");
    }

    /**
     * Get a secure, temporary presigned URL for payment evidence preview.
     *
     * @throws AuthorizationException
     */
    public function evidenceUrl(Request $request, Payment $payment): JsonResponse
    {
        Gate::authorize('view', $payment);

        $actor = $request->user();

        if (! $payment->hasEvidence() || empty($payment->evidence_object_key)) {
            return response()->json([
                'message' => 'This payment record has no visual evidence attached.',
            ], 422);
        }

        $url = $this->evidenceService->getTemporaryPreviewUrl($payment, $actor, 15);
        $expiresAt = now()->addMinutes(15)->toIso8601String();

        return response()->json([
            'url' => $url,
            'expires_at' => $expiresAt,
            'mime_type' => $payment->evidence_mime_type ?? 'image/jpeg',
            'original_name' => $payment->evidence_original_name ?? 'payment_evidence.jpg',
            'size_bytes' => $payment->evidence_size_bytes,
        ]);
    }

    /**
     * Authenticated, secure stream for private storage drivers in local/staging environments.
     *
     * @throws AuthorizationException
     */
    public function streamEvidence(Request $request, Payment $payment): StreamedResponse
    {
        Gate::authorize('streamEvidence', $payment);

        if (! $payment->hasEvidence() || empty($payment->evidence_object_key)) {
            abort(404, 'No evidence file associated with this payment.');
        }

        $disk = $this->evidenceService->getDisk();
        $objectKey = $payment->evidence_object_key;

        if (! Storage::disk($disk)->exists($objectKey)) {
            abort(404, 'Evidence file not found in secure storage.');
        }

        return Storage::disk($disk)->response($objectKey, $payment->evidence_original_name ?? 'evidence.jpg', [
            'Content-Type' => $payment->evidence_mime_type ?? 'image/jpeg',
            'Cache-Control' => 'private, no-cache, no-store, must-revalidate',
        ]);
    }
}
