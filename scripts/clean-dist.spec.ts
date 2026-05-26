import { execSync } from 'child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';

function distHasCompiledOutput(distDir: string): boolean {
  if (!existsSync(distDir)) {
    return false;
  }

  const entries = readdirSync(distDir, { recursive: true }) as string[];
  return entries.some((entry) => entry.toString().endsWith('.js'));
}

describe('prebuild dist cleanup', () => {
  const distDir = join(process.cwd(), 'dist');
  const nestedFile = join(distDir, 'nested', 'stale.js');

  it('removes non-empty dist before nest build via prebuild', () => {
    mkdirSync(join(distDir, 'nested'), { recursive: true });
    writeFileSync(nestedFile, 'console.log("stale");', 'utf8');

    expect(existsSync(nestedFile)).toBe(true);

    execSync('node scripts/clean-dist.cjs', {
      cwd: process.cwd(),
      stdio: 'pipe',
    });

    expect(existsSync(distDir)).toBe(false);

    execSync('npm run build', {
      cwd: process.cwd(),
      stdio: 'pipe',
    });

    expect(distHasCompiledOutput(distDir)).toBe(true);
  });
});
