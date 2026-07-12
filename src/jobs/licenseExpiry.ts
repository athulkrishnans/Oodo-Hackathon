// src/jobs/licenseExpiry.ts
// node-cron daily job — checks driver license expiry and fires notifications.
// Also exposed as a manual trigger endpoint for demo purposes (Section 11, Section 14 item 5).

import cron from 'node-cron';
import { prisma } from '../shared/prisma';
import { notify } from '../shared/notify';
import { getSettings } from '../shared/settings';

// Daily at 08:00
export function startLicenseExpiryJob(): void {
  cron.schedule('0 8 * * *', () => {
    runLicenseExpiryCheck().catch((e) => console.error('[licenseExpiry] failed', e));
  });
  console.log('License expiry cron job scheduled (daily 08:00)');
}

export interface LicenseCheckResult {
  warned: number;
  expired: number;
  bands: number[];
}

// Called by cron AND by the manual demo trigger endpoint.
export async function runLicenseExpiryCheck(): Promise<LicenseCheckResult> {
  const settings = await getSettings();
  const bands = [...settings.licenseWarningDays].sort((a, b) => a - b);
  const maxBand = bands.length > 0 ? bands[bands.length - 1] : 90;
  const now = new Date();
  const horizon = new Date(now.getTime() + maxBand * 864e5);

  // Drivers whose license expires within the widest warning band and who aren't already suspended.
  const expiringSoon = await prisma.driver.findMany({
    where: { status: { not: 'SUSPENDED' }, licenseExpiryDate: { gt: now, lte: horizon } },
  });
  for (const d of expiringSoon) {
    const days = Math.ceil((d.licenseExpiryDate.getTime() - now.getTime()) / 864e5);
    await notify.sendToRole(
      'SAFETY_OFFICER',
      'LICENSE_EXPIRING',
      `Driver ${d.name}'s license expires in ${days} day(s) — ${d.licenseExpiryDate.toISOString().slice(0, 10)}.`,
    );
  }

  // Already expired but still AVAILABLE — suggest suspension (Section 11).
  const expiredActive = await prisma.driver.findMany({
    where: { status: 'AVAILABLE', licenseExpiryDate: { lte: now } },
  });
  for (const d of expiredActive) {
    await notify.sendToRole(
      'SAFETY_OFFICER',
      'LICENSE_EXPIRING',
      `Driver ${d.name}'s license has EXPIRED but they are still AVAILABLE — consider suspension.`,
    );
  }

  console.log(`[licenseExpiry] warned=${expiringSoon.length} expired=${expiredActive.length}`);
  return { warned: expiringSoon.length, expired: expiredActive.length, bands };
}
