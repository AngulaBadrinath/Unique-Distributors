<?php

namespace App\Console\Commands;

use App\Enums\AccountStatus;
use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class ProvisionClientSuperAdminCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'auth:provision-client-admin 
                            {--email=client.admin@uniquedistributors.com : The email address for the client super admin}
                            {--name=Client Super Administrator : The display name for the client account}
                            {--password= : Optional specific temporary password (if omitted, a secure one will be generated)}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Safely provision a dedicated Client Super Administrator account without affecting existing administrator identities';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $email = Str::lower(trim((string) $this->option('email')));
        $name = trim((string) $this->option('name'));
        $inputPassword = $this->option('password');

        $this->info("Checking existence of account: {$email}...");

        $existingUser = User::where('email', $email)->first();

        if ($existingUser) {
            $this->warn("CLIENT SUPER ADMIN ALREADY EXISTS: [ID: {$existingUser->id}]");
            $this->table(
                ['Field', 'Value'],
                [
                    ['ID', $existingUser->id],
                    ['Email', $existingUser->email],
                    ['Name', $existingUser->name],
                    ['Role', $existingUser->role->value],
                    ['Status', $existingUser->status->value],
                    ['MFA Status', $existingUser->hasMfaEnabled() ? 'Enrolled' : 'Pending Enrollment'],
                    ['Created At', $existingUser->created_at?->toIso8601String() ?? 'N/A'],
                ]
            );

            return Command::SUCCESS;
        }

        // Generate strong temporary password if not provided
        $temporaryPassword = $inputPassword ?: Str::password(24, letters: true, numbers: true, symbols: true, spaces: false);

        $user = User::create([
            'name' => $name,
            'email' => $email,
            'password' => Hash::make($temporaryPassword),
            'role' => UserRole::SUPER_ADMIN,
            'status' => AccountStatus::ACTIVE,
            'email_verified_at' => now(),
        ]);

        // Security Audit Log (Never log passwords, hashes, or secrets)
        Log::info('auth.security_event', [
            'action' => 'USER_PROVISIONED',
            'actor_id' => null,
            'target_user_id' => $user->id,
            'email' => $user->email,
            'role' => $user->role->value,
            'status' => $user->status->value,
            'reason' => 'Client super administrator provisioning',
            'timestamp' => now()->toIso8601String(),
        ]);

        $this->info('Client Super Administrator successfully provisioned!');
        $this->table(
            ['Field', 'Value'],
            [
                ['ID', $user->id],
                ['Email', $user->email],
                ['Name', $user->name],
                ['Role', $user->role->value],
                ['Status', $user->status->value],
                ['MFA Requirement', 'Mandatory (Client will enroll upon first login)'],
            ]
        );

        // Plaintext temporary password displayed only on standard console output for the operator
        $this->newLine();
        $this->info("Generated Temporary Password: {$temporaryPassword}");
        $this->warn('NOTE: Securely deliver this temporary password to the client via private channel. Never commit it to Git.');

        return Command::SUCCESS;
    }
}
