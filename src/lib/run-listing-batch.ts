import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import type { DuplicateBatchResult } from './duplicate-pool';
import { runDuplicateBatchV2 } from './product-duplicator';

const RESULT_PATH = path.join(process.cwd(), 'scratch', 'last-batch-result.json');

function runPlaywrightBatchSubprocess(options: {
  startDate: string;
  endDate: string;
  count: number;
}): Promise<DuplicateBatchResult> {
  return new Promise((resolve, reject) => {
    const script = path.join(process.cwd(), 'scripts/playwright-duplicate-batch.ts');
    const child = spawn(
      'npx',
      ['tsx', script, options.startDate, options.endDate, String(options.count)],
      {
        cwd: process.cwd(),
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      const marker = '---RESULT---';
      const idx = stdout.indexOf(marker);
      if (idx >= 0) {
        const json = stdout.slice(idx + marker.length).trim();
        try {
          resolve(JSON.parse(json) as DuplicateBatchResult);
          return;
        } catch {
          /* fall through */
        }
      }
      if (fs.existsSync(RESULT_PATH)) {
        try {
          resolve(JSON.parse(fs.readFileSync(RESULT_PATH, 'utf-8')) as DuplicateBatchResult);
          return;
        } catch {
          /* fall through */
        }
      }
      reject(
        new Error(
          `Playwright batch exited ${code ?? 'unknown'}: ${stderr || stdout.slice(-500)}`
        )
      );
    });
  });
}

export async function runListingBatch(options?: {
  startDate?: string;
  endDate?: string;
  count?: number;
}): Promise<DuplicateBatchResult> {
  const startDate = options?.startDate ?? '2026-05-26';
  const endDate = options?.endDate ?? '2026-06-01';
  const count = options?.count ?? 5;
  const method = process.env.DUPLICATE_METHOD?.trim() || 'playwright';

  if (method === 'api') {
    return runDuplicateBatchV2({ startDate, endDate, count });
  }

  return runPlaywrightBatchSubprocess({ startDate, endDate, count });
}
