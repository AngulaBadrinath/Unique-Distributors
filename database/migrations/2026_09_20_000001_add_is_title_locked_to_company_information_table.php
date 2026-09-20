<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (! Schema::hasColumn('company_information', 'is_title_locked')) {
            Schema::table('company_information', function (Blueprint $table) {
                $table->boolean('is_title_locked')->default(true)->after('is_singleton');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('company_information', 'is_title_locked')) {
            Schema::table('company_information', function (Blueprint $table) {
                $table->dropColumn('is_title_locked');
            });
        }
    }
};
