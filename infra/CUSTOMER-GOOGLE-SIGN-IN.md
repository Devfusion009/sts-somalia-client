# Customer Google sign-in — production setup

Activation: disabled until the production release and feature switch. The owner reports connecting
Google to Supabase. The supplied Web OAuth client configuration was checked:
its public origin is `https://scoutsts.com` and its authorized redirect URI is
the production Supabase callback shown below. The client secret was not copied
into the repository. The Supabase app redirect allowlist, live provider settings,
and Google brand verification have not been independently verified. The website
feature switch remains off until activation through the normal release flow.
No database migration is required. The existing `handle_new_user` trigger creates
new profiles with the `customer` role.

## What this change enables

- “Continue with Google” on the public customer `/login` and `/signup` pages.
- Server-side OAuth with Supabase's PKCE cookie and code exchange.
- Return to the customer's booking or `/account`, with existing MFA enforced.
- Existing customer accounts use Supabase's verified-email account linking;
  this implementation does not manually link identities or change roles.
- Staff and business roles cannot complete this Google customer flow. Their
  existing portal sign-in methods remain available.

Both the initiation action and callback enforce all of these conditions:

1. `DEPLOYMENT_ENV=production`.
2. `CUSTOMER_GOOGLE_LOGIN_ENABLED=true`.
3. `NEXT_PUBLIC_SITE_URL` is the canonical HTTPS public STS origin, either
   `https://scoutsts.com` or `https://www.scoutsts.com`.
4. The request host matches that canonical public origin exactly.
5. Supabase uses `mdhftphdyqsbxpoblzsd.supabase.co` (production), or the
   optional verified custom Auth domain `auth.scoutsts.com`.

QA and localhost stay disabled, including when `NODE_ENV=production`. The
flag is server-side and defaults to off. Do not set it in the QA environment.

## 1. Create the Google OAuth client

Use a company-owned Google Cloud project. In Google Auth Platform:

- Configure the audience for external customers, rather than an internal
  Workspace-only app.
- In Branding, set the app name to **Scout Travel Solution** and upload the
  company logo. The original artwork is exported for this upload at
  `output/branding/sts-google-oauth-logo-120.png` (120 × 120 PNG, approximately 11 KB).
- Choose a monitored company support address available to the Google project.
  Use `info@scoutsts.com` if that address is eligible in the support dropdown.
- Set the homepage to `https://scoutsts.com`, privacy policy to
  `https://scoutsts.com/privacy`, and terms to `https://scoutsts.com/terms`.
  Use the canonical `www` origin consistently if that is your deployed origin.
- Verify ownership of `scoutsts.com`, and add it as an authorized domain.
- Request only `openid`, `email`, and `profile`. Gmail, Drive, Calendar, and
  offline access are not needed for customer sign-in.
- Create an OAuth client with application type **Web application**. Set the
  public origin to `https://scoutsts.com` and the authorized redirect URI to:

  ```text
  https://mdhftphdyqsbxpoblzsd.supabase.co/auth/v1/callback
  ```

This is Google's callback to Supabase. It is different from the application's
callback in the next step. Copy the exact provider callback shown in the
production Supabase dashboard if a custom Auth domain is already active.

Store the Google client secret directly in the production Supabase provider
settings. Do not put it in the repository, browser code, or this document.

## 2. Configure production Supabase only

Select production project **`mdhftphdyqsbxpoblzsd`**. Do not modify QA project
`uvmxxtdneryuuiqcwegx`.

In Authentication → Sign In / Providers → Google:

1. Enter the Google Web client ID and secret.
2. Enable Google sign-in. Keep nonce validation enabled.
3. In URL Configuration, retain the correct production Site URL and add this
   exact additional redirect URL:

   ```text
   https://scoutsts.com/auth/google/callback
   ```

Avoid a wildcard redirect. If the public origin is `www`, use that origin
instead in the app's callback and `NEXT_PUBLIC_SITE_URL`.

## 3. Show the STS name and logo on Google

Renaming the Supabase project does not publish Google branding. Google's app
name and logo come from Google Auth Platform → Branding. For external apps
in production, submit the brand for verification and then publish the approved
branding. Draft branding is not visible to all customers.

Review the public privacy policy before activation so it accurately describes
the Google profile data the service receives and uses for customer sign-in.
Google requires this information for production branding verification.

If you also want the Auth URL itself to show STS instead of a `supabase.co`
project address, configure a Supabase custom domain such as `auth.scoutsts.com`.
This is separate from Google brand verification and may require a Supabase
plan/add-on change. Do not activate a custom domain without completing its
DNS and certificate setup.

Before activating a custom Auth domain, add its provider callback to the
Google client **alongside** the existing callback:

```text
https://auth.scoutsts.com/auth/v1/callback
```

After domain verification, update `NEXT_PUBLIC_SUPABASE_URL` through the normal
release configuration and rebuild the web app. Keep the publishable key for
the same production project. Retest existing password sign-in, reset links,
and portal sessions; changing the Supabase URL can change session cookie names.
The custom domain is optional for Google sign-in itself.

## 4. Release with Google still disabled, then activate

Follow the repository release flow: verify the code on QA with Google disabled,
then promote through `main` → `production` when authorized. Do not enable
Google on QA to test a production account.

Once Google branding and the production provider are ready, add this server
variable to the production web environment through the normal configuration
release path:

```text
CUSTOMER_GOOGLE_LOGIN_ENABLED=true
```

`DEPLOYMENT_ENV=production` is already set by the production web Compose service.
No new public build variable or Google secret is needed in the web app.
Restart/redeploy the production web service after applying the server variable.
Do not enable the flag before the Google provider is configured.

## 5. Acceptance checks after activation

- New Google customer: correct STS brand, customer profile created, `/account`
  opens, and the customer can book using existing flows.
- Existing verified customer email: signing in returns the same profile and
  bookings. Check both Google and the existing password method.
- Customer with MFA: Google returns to the existing verification screen.
- Checkout entry: sign-in returns to the same booking/payment step.
- Cancelled consent, expired code, and replayed callback: clear failure on the
  customer login page, no success redirect.
- Admin, manager, and business-role Google accounts: customer callback rejects
  them and removes the local sign-in session.
- QA, localhost, and all staff login pages: no Google button; direct callback
  requests outside the enabled production public host return 404.
- Existing password sign-in, recovery, and notification emails still work.

Disable by removing the switch or setting it to `false`, then restart the web
service. Password sign-in remains available. No migration rollback is needed.

## Provider documentation

- [Supabase Google sign-in](https://supabase.com/docs/guides/auth/social-sign-in/auth-google)
- [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Supabase custom domains](https://supabase.com/docs/guides/platform/custom-domains)
- [Google OAuth app branding](https://support.google.com/cloud/answer/15549049)
