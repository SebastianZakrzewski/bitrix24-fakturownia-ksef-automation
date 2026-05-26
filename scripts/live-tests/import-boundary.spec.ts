import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const LIVE_TESTS_ROOT = join(__dirname);
const SOURCE_FILE_PATTERN = /\.ts$/;
const SPEC_FILE_PATTERN = /\.spec\.ts$/;

const FORBIDDEN_IMPORT_PATTERNS: RegExp[] = [
  /\bBitrix24Client\b/,
  /\bFakturowniaClient\b/,
  /\bCreateInvoiceFromBitrixDealUseCase\b/,
  /modules\/bitrix24/i,
  /modules\/invoices\/use-cases/i,
  /modules\/invoices\/integrations\/fakturownia/i,
  /\/repositories\//i,
  /\bfrom\s+['"]pg['"]/,
  /\bfrom\s+['"][^'"]*\/src\//,
  /\bfrom\s+['"][^'"]*controllers\//i,
  /integrations\/bitrix24/i,
  /integrations\/fakturownia/i,
  /\bsupabase\b/i,
  /\bprisma\b/i,
];

function listSourceFiles(directory: string): string[] {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(fullPath));
      continue;
    }

    if (
      SOURCE_FILE_PATTERN.test(entry.name) &&
      !SPEC_FILE_PATTERN.test(entry.name)
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

function extractImportLines(content: string): string[] {
  return content
    .split('\n')
    .filter((line) => /^\s*import\s+/.test(line) || /require\(/.test(line));
}

describe('scripts/live-tests import boundary', () => {
  const sourceFiles = listSourceFiles(LIVE_TESTS_ROOT);

  it('includes live-test runner sources', () => {
    expect(sourceFiles.some((file) => file.endsWith('run-live-test.ts'))).toBe(
      true,
    );
  });

  it.each(sourceFiles.map((file) => [file.replace(LIVE_TESTS_ROOT, ''), file]))(
    '%s does not import forbidden Bitrix/Fakturownia/backend/DB modules',
    (_label, filePath) => {
      const content = readFileSync(filePath, 'utf8');
      const importLines = extractImportLines(content);

      for (const line of importLines) {
        for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
          expect(line).not.toMatch(pattern);
        }
      }

      expect(content).not.toMatch(/\.\.\/\.\.\/src\//);
    },
  );

  it('uses scripts-local env loader instead of src/load-env', () => {
    const runnerSource = readFileSync(
      join(LIVE_TESTS_ROOT, 'run-live-test.ts'),
      'utf8',
    );
    const envLoaderSource = readFileSync(
      join(LIVE_TESTS_ROOT, 'load-env.ts'),
      'utf8',
    );

    expect(runnerSource).toContain("import './load-env'");
    expect(runnerSource).not.toContain('../../src/load-env');
    expect(envLoaderSource).toContain('override: false');
    expect(envLoaderSource).not.toMatch(/override:\s*true/);
  });
});
