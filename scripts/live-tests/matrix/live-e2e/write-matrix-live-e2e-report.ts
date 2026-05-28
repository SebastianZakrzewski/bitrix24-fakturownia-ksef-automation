import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import type { MatrixLiveE2eRunSummary } from './matrix-live-e2e.types';
import { buildMatrixLiveE2eReportMarkdown } from './build-matrix-live-e2e-report';

export interface WriteMatrixLiveE2eReportOutput {
  jsonPath: string;
  markdownPath: string;
}

export async function writeMatrixLiveE2eReport(
  summary: MatrixLiveE2eRunSummary,
  options: { outputDir: string; timestamp?: Date },
): Promise<WriteMatrixLiveE2eReportOutput> {
  const timestamp = options.timestamp ?? new Date();
  const stamp = timestamp.toISOString().replace(/[:.]/g, '-');
  const outputDir = join(options.outputDir, 'matrix-live-e2e');
  await mkdir(outputDir, { recursive: true });

  const jsonPath = join(outputDir, `matrix-live-e2e-${stamp}.json`);
  const markdownPath = join(outputDir, `matrix-live-e2e-${stamp}.md`);

  await writeFile(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  await writeFile(markdownPath, `${buildMatrixLiveE2eReportMarkdown(summary)}\n`, 'utf8');

  return { jsonPath, markdownPath };
}
