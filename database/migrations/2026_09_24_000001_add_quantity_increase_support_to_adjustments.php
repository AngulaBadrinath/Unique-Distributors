<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $isPgsql = DB::connection()->getDriverName() === 'pgsql';

        // 1. Add increased_quantity to order_items
        Schema::table('order_items', function (Blueprint $table) {
            $table->integer('increased_quantity')->default(0)->after('cancelled_quantity');
        });

        // 2. Add addition projection columns to order_adjustments
        Schema::table('order_adjustments', function (Blueprint $table) {
            $table->decimal('projected_subtotal_addition', 12, 2)->default(0.00)->after('projected_subtotal_reduction');
            $table->decimal('projected_tax_addition', 12, 2)->default(0.00)->after('projected_tax_reduction');
            $table->decimal('projected_grand_total_addition', 12, 2)->default(0.00)->after('projected_grand_total_reduction');
        });

        // 3. Add increase columns and action_type to order_adjustment_items
        Schema::table('order_adjustment_items', function (Blueprint $table) {
            $table->string('action_type', 20)->default('DECREASE')->after('requested_quantity_reduction');
            $table->integer('requested_quantity_increase')->default(0)->after('action_type');
            $table->integer('requested_quantity_delta')->default(0)->after('requested_quantity_increase');
        });

        if ($isPgsql) {
            DB::statement('ALTER TABLE order_items ADD CONSTRAINT order_items_increased_quantity_check CHECK (increased_quantity >= 0)');
            DB::statement('ALTER TABLE order_adjustment_items DROP CONSTRAINT IF EXISTS order_adj_items_requested_qty_check');
            DB::statement('ALTER TABLE order_adjustment_items ADD CONSTRAINT order_adj_items_quantity_action_check CHECK (
                (requested_quantity_reduction >= 0) AND 
                (requested_quantity_increase >= 0) AND 
                (requested_quantity_reduction > 0 OR requested_quantity_increase > 0 OR requested_quantity_delta != 0)
            )');
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $isPgsql = DB::connection()->getDriverName() === 'pgsql';

        if ($isPgsql) {
            DB::statement('ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_increased_quantity_check');
            DB::statement('ALTER TABLE order_adjustment_items DROP CONSTRAINT IF EXISTS order_adj_items_quantity_action_check');
            DB::statement('ALTER TABLE order_adjustment_items ADD CONSTRAINT order_adj_items_requested_qty_check CHECK (requested_quantity_reduction > 0)');
        }

        Schema::table('order_adjustment_items', function (Blueprint $table) {
            $table->dropColumn(['action_type', 'requested_quantity_increase', 'requested_quantity_delta']);
        });

        Schema::table('order_adjustments', function (Blueprint $table) {
            $table->dropColumn(['projected_subtotal_addition', 'projected_tax_addition', 'projected_grand_total_addition']);
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn(['increased_quantity']);
        });
    }
};
