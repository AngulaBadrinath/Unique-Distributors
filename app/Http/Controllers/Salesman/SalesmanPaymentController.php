<?php

namespace App\Http\Controllers\Salesman;

use App\Http\Controllers\Controller;
use App\Http\Requests\Payment\CorrectPaymentRequest;
use App\Http\Requests\Payment\CreateCashPaymentRequest;
use App\Http\Requests\Payment\CreateChequePaymentRequest;
use App\Http\Requests\Payment\CreateMoneyOrderPaymentRequest;
use App\Models\Payment;
use App\Services\Payment\PaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;

class SalesmanPaymentController extends Controller
{
    public function __construct(
        protected PaymentService $paymentService,
    ) {}

    /**
     * Store a cash payment collected by a salesman for an assigned customer.
     */
    public function storeCash(CreateCashPaymentRequest $request): JsonResponse|RedirectResponse
    {
        $actor = $request->user();
        $payment = $this->paymentService->recordCashPayment($request->validated(), $actor);

        if ($request->wantsJson() && ! $request->header('X-Inertia')) {
            return response()->json([
                'message' => "Cash payment {$payment->payment_number} recorded successfully.",
                'payment' => $payment->load(['customer', 'order']),
            ], 201);
        }

        $fallback = $payment->order_id ? route('salesman.orders.show', $payment->order_id) : route('salesman.orders.index');

        return redirect()->back(fallback: $fallback)->with('success', "Cash payment {$payment->payment_number} recorded successfully.");
    }

    /**
     * Store a cheque payment collected by a salesman for an assigned customer.
     */
    public function storeCheque(CreateChequePaymentRequest $request): JsonResponse|RedirectResponse
    {
        $actor = $request->user();
        $evidenceFile = $request->file('evidence');
        $payment = $this->paymentService->recordChequePayment($request->validated(), $evidenceFile, $actor);

        if ($request->wantsJson() && ! $request->header('X-Inertia')) {
            return response()->json([
                'message' => "Cheque payment {$payment->payment_number} recorded successfully.",
                'payment' => $payment->load(['customer', 'order']),
            ], 201);
        }

        $fallback = $payment->order_id ? route('salesman.orders.show', $payment->order_id) : route('salesman.orders.index');

        return redirect()->back(fallback: $fallback)->with('success', "Cheque payment {$payment->payment_number} recorded successfully.");
    }

    /**
     * Store a money order payment collected by a salesman for an assigned customer.
     */
    public function storeMoneyOrder(CreateMoneyOrderPaymentRequest $request): JsonResponse|RedirectResponse
    {
        $actor = $request->user();
        $evidenceFile = $request->file('evidence');
        $payment = $this->paymentService->recordMoneyOrderPayment($request->validated(), $evidenceFile, $actor);

        if ($request->wantsJson() && ! $request->header('X-Inertia')) {
            return response()->json([
                'message' => "Money order payment {$payment->payment_number} recorded successfully.",
                'payment' => $payment->load(['customer', 'order']),
            ], 201);
        }

        $fallback = $payment->order_id ? route('salesman.orders.show', $payment->order_id) : route('salesman.orders.index');

        return redirect()->back(fallback: $fallback)->with('success', "Money order payment {$payment->payment_number} recorded successfully.");
    }

    /**
     * Correct and resubmit a rejected payment.
     */
    public function correct(CorrectPaymentRequest $request, Payment $payment): JsonResponse|RedirectResponse
    {
        $actor = $request->user();
        $evidenceFile = $request->file('evidence');
        $resubmittedPayment = $this->paymentService->correctAndResubmitPayment($payment, $request->validated(), $evidenceFile, $actor);

        if ($request->wantsJson() && ! $request->header('X-Inertia')) {
            return response()->json([
                'message' => "Payment {$resubmittedPayment->payment_number} corrected and resubmitted for verification.",
                'payment' => $resubmittedPayment,
            ]);
        }

        return redirect()->back(fallback: route('salesman.orders.index'))->with('success', "Payment {$resubmittedPayment->payment_number} corrected and resubmitted.");
    }
}
