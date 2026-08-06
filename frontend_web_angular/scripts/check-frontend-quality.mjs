import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const SRC_APP = join(ROOT, 'src', 'app');
const TRACKED_EXTENSIONS = new Set(['.ts', '.html', '.scss']);
const DEFAULT_MAX_LINES = 700;

const legacyLineBudgets = new Map(
  Object.entries({
    'src/app/features/appointments/presentation/pages/appointment-detail-page/appointment-detail-page.component.ts': 3950,
    'src/app/features/medicine/presentation/pages/doctor-space-page/doctor-space-page.component.ts': 3075,
    'src/app/features/services/presentation/pages/service-proposal/service-proposal.component.ts': 2800,
    'src/app/features/medicine/presentation/pages/doctor-space-page/doctor-space-page.component.html': 1700,
    'src/app/features/messages/presentation/pages/messages-page/messages-page.component.ts': 1600,
    'src/app/features/account/pages/settings/settings-page.component.scss': 1575,
    'src/app/features/medicine/presentation/pages/doctor-space-page/doctor-space-page.component.scss': 1525,
    'src/app/features/appointments/presentation/pages/appointment-detail-page/appointment-detail-page.component.html': 1450,
    'src/app/features/account/pages/settings/settings-page.component.ts': 1375,
    'src/app/features/services/presentation/pages/service-proposal/service-proposal.component.html': 1325,
    'src/app/features/appointments/presentation/pages/appointment-detail-page/appointment-detail-tracking.component.scss': 1325,
    'src/app/features/medicine/presentation/pages/doctor-space-page/styles/_doctor-space-agenda.scss': 1225,
    'src/app/features/appointments/presentation/pages/appointment-detail-page/appointment-detail-map.component.scss': 1100,
    'src/app/features/appointments/presentation/pages/appointment-detail-page/appointment-detail-page.component.scss': 1100,
    'src/app/shared/ui/app-navbar/app-navbar.component.scss': 1050,
    'src/app/features/services/presentation/pages/service-proposal/service-proposal.component.scss': 1025,
    'src/app/features/medicine/presentation/pages/medicine-appointment-booking/medicine-appointment-booking.component.ts': 1000,
    'src/app/features/admin/presentation/components/admin-service-structure-panel/admin-service-structure-panel.component.ts': 975,
    'src/app/features/appointments/presentation/pages/appointment-qr-code-page/appointment-qr-code-page.component.ts': 925,
    'src/app/features/appointments/presentation/pages/appointments-page/appointments-page.component.ts': 925,
    'src/app/features/medicine/presentation/pages/medicine-appointment-booking/medicine-appointment-booking.component.scss': 925,
    'src/app/features/services/presentation/pages/service-proposal/service-proposal-negotiation-state.component.scss': 925,
    'src/app/features/appointments/presentation/pages/appointment-payment-page/appointment-payment-page.component.scss': 825,
    'src/app/features/services/presentation/pages/services/services.component.ts': 800,
    'src/app/features/messages/presentation/pages/messages-page/messages-page.component.scss': 775,
    'src/app/features/admin/presentation/pages/admin-dashboard-page/admin-dashboard-page.component.ts': 775,
    'src/app/features/admin/data-access/admin.models.ts': 750,
  }),
);

const allowedSensitivePatterns = new Map(
  Object.entries({
    'src/main.ts': ['console.'],
    'src/app/features/account/pages/dispute-report/dispute-report-page.component.ts': [
      'bypassSecurityTrust',
    ],
    'src/app/features/appointments/presentation/pages/appointment-detail-page/appointment-detail-page.component.ts': [
      'localStorage',
    ],
    'src/app/features/appointments/presentation/pages/appointment-detail-page/appointment-document-renderer.service.ts': [
      'innerHTML',
    ],
    'src/app/features/appointments/presentation/pages/appointment-qr-code-page/appointment-qr-code-page.component.ts': [
      'localStorage',
    ],
    'src/app/features/services/presentation/components/service-proposal-interactive-map/service-proposal-interactive-map.component.ts': [
      'bypassSecurityTrust',
      'innerHTML',
    ],
    'src/app/features/tracking/presentation/tracking-google-map-renderer.service.ts': [
      'innerHTML',
    ],
    'src/app/features/services/presentation/pages/provider-profile/provider-profile.component.ts': [
      'bypassSecurityTrust',
    ],
    'src/app/features/services/presentation/pages/service-proposal/service-proposal.component.ts': [
      'sessionStorage',
    ],
    'src/app/features/medicine/presentation/pages/medicine-doctor-profile/medicine-doctor-profile.component.ts': [
      'bypassSecurityTrust',
    ],
    'src/app/core/auth/auth-session.service.ts': ['localStorage', 'sessionStorage'],
    'src/app/core/storage/tab-session-storage.service.ts': ['sessionStorage'],
  }),
);

const sensitivePatterns = [
  'innerHTML',
  'bypassSecurityTrust',
  'localStorage',
  'sessionStorage',
  'document.cookie',
  'eval(',
  'new Function',
  'console.',
  '@ts-ignore',
  'eslint-disable',
];

const failures = [];
const warnings = [];

for (const file of listFiles(SRC_APP)) {
  const relativePath = normalizePath(relative(ROOT, file));
  const content = readFileSync(file, 'utf8');
  checkLineBudget(relativePath, content);
  checkSensitivePatterns(relativePath, content);
}

if (warnings.length > 0) {
  console.log('\nFrontend quality warnings:');
  for (const warning of warnings) console.log(`- ${warning}`);
}

if (failures.length > 0) {
  console.error('\nFrontend quality check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Frontend quality check passed.');

function listFiles(directory) {
  const entries = readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(path);
    return TRACKED_EXTENSIONS.has(extensionOf(entry.name)) ? [path] : [];
  });
}

function extensionOf(fileName) {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex === -1 ? '' : fileName.slice(dotIndex);
}

function checkLineBudget(relativePath, content) {
  const lineCount = content.split(/\r\n|\r|\n/).length;
  const maxLines = legacyLineBudgets.get(relativePath) ?? DEFAULT_MAX_LINES;

  if (lineCount > maxLines) {
    warnings.push(
      `${relativePath} has ${lineCount} lines. Maximum allowed is ${maxLines}. Split responsibilities before adding more code.`,
    );
    return;
  }

  if (legacyLineBudgets.has(relativePath)) {
    warnings.push(
      `${relativePath} is legacy-large (${lineCount}/${maxLines}). Refactor by extracting domain state, view models, and presentational components.`,
    );
  }
}

function checkSensitivePatterns(relativePath, content) {
  const allowedPatterns = allowedSensitivePatterns.get(relativePath) ?? [];

  for (const pattern of sensitivePatterns) {
    if (pattern === 'console.' && !relativePath.endsWith('.ts')) continue;
    if (!content.includes(pattern)) continue;
    if (allowedPatterns.includes(pattern)) continue;
    failures.push(`${relativePath} uses sensitive pattern "${pattern}" without an explicit quality whitelist.`);
  }
}

function normalizePath(path) {
  return path.split(sep).join('/');
}
