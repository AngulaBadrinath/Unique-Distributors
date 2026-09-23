<?php

namespace App\Services\System;

use App\DTOs\System\ApplicationIdentity;

class ApplicationIdentityService
{
    public const DEFAULT_NAME = 'Unique Distributors';
    public const DEFAULT_COMPANY_NAME = 'Unique Distributors Inc.';
    public const DEFAULT_TAGLINE = 'B2B Wholesale Commerce & Distribution Platform';
    public const DEFAULT_SUPPORT_EMAIL = 'support@example.com';
    public const DEFAULT_SUPPORT_PHONE = '+1 (800) 555-0199';
    public const DEFAULT_LOGO_PATH = '/branding/horizontal-dark.svg';
    public const DEFAULT_FAVICON_PATH = '/branding/favicon.ico';
    public const DEFAULT_FOOTER_TEXT = 'Unique Distributors';

    /**
     * Resolve the authoritative application identity value object.
     */
    public function get(): ApplicationIdentity
    {
        return new ApplicationIdentity(
            name: $this->getAppName(),
            company_name: $this->getCompanyName(),
            tagline: $this->getTagline(),
            support_email: $this->getSupportEmail(),
            support_phone: $this->getSupportPhone(),
            logo_path: $this->getLogoPath(),
            favicon_path: $this->getFaviconPath(),
            footer_text: $this->getFooterText(),
        );
    }

    /**
     * Get the authoritative product / application name.
     */
    public function getAppName(): string
    {
        $name = config('app_identity.name') ?? config('app.name');

        return is_string($name) && trim($name) !== '' && $name !== 'Laravel'
            ? trim($name)
            : self::DEFAULT_NAME;
    }

    /**
     * Get the authoritative business / company name.
     */
    public function getCompanyName(): string
    {
        $company = config('app_identity.company_name');

        return is_string($company) && trim($company) !== ''
            ? trim($company)
            : self::DEFAULT_COMPANY_NAME;
    }

    /**
     * Get the company tagline or short description.
     */
    public function getTagline(): string
    {
        $tagline = config('app_identity.tagline');

        return is_string($tagline) && trim($tagline) !== ''
            ? trim($tagline)
            : self::DEFAULT_TAGLINE;
    }

    /**
     * Get the support email address.
     */
    public function getSupportEmail(): string
    {
        $email = config('app_identity.support_email');

        return is_string($email) && trim($email) !== ''
            ? trim($email)
            : self::DEFAULT_SUPPORT_EMAIL;
    }

    /**
     * Get the support phone number.
     */
    public function getSupportPhone(): string
    {
        $phone = config('app_identity.support_phone');

        return is_string($phone) && trim($phone) !== ''
            ? trim($phone)
            : self::DEFAULT_SUPPORT_PHONE;
    }

    /**
     * Get the logo web path.
     */
    public function getLogoPath(): string
    {
        $logo = config('app_identity.logo_path');

        return is_string($logo) && trim($logo) !== ''
            ? trim($logo)
            : self::DEFAULT_LOGO_PATH;
    }

    /**
     * Get the favicon web path.
     */
    public function getFaviconPath(): string
    {
        $favicon = config('app_identity.favicon_path');

        return is_string($favicon) && trim($favicon) !== ''
            ? trim($favicon)
            : self::DEFAULT_FAVICON_PATH;
    }

    /**
     * Get the footer copyright / identity text.
     */
    public function getFooterText(): string
    {
        $footer = config('app_identity.footer_text');

        return is_string($footer) && trim($footer) !== ''
            ? trim($footer)
            : self::DEFAULT_FOOTER_TEXT;
    }

    /**
     * Retrieve the public identity structure shared with frontend and public views.
     *
     * @return array<string, string>
     */
    public function getPublicIdentity(): array
    {
        return $this->get()->toArray();
    }
}
