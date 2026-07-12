// src/jobs/licenseExpiry.ts
// node-cron daily job — checks driver license expiry and fires notifications.
// Also exposed as a manual trigger endpoint for demo purposes (Section 11, Section 14 item 5).
// Implemented by M1 in H2–3.5.

import cron from 'node-cron';

// Daily at 08:00
export function startLicenseExpiryJob(): void {
  cron.schedule('0 8 * * *', async () => {
    await runLicenseExpiryCheck();
  });
  console.log('License expiry cron job scheduled (daily 08:00)');
}

// Called by cron AND by the manual demo trigger endpoint
export async function runLicenseExpiryCheck(): Promise<void> {
  // TODO (M1, H2-3.5):
  // 1. Load license_warning_days from Settings (default [30, 60, 90])
  // 2. Query drivers where licenseExpiryDate is within any warning band AND status != SUSPENDED
  // 3. For each driver, create Notification for all SAFETY_OFFICERs
  // 4. Separately flag drivers with licenseExpiryDate < now() AND status = AVAILABLE
  //    → suggest suspension via notification
  console.log('[licenseExpiry] Check stub — implement in H2-3.5');
}
