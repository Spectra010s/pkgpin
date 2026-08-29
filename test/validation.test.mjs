import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { normalizeConfig, PkgpinRunner } from '../src/index.mjs';

describe('Numeric Configuration Validation (concurrency & timeoutMs)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkgpin-val-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should accept valid positive integers for concurrency and timeoutMs', () => {
    const raw = {
      concurrency: 12,
      timeoutMs: 8000,
    };
    const normalized = normalizeConfig(raw);
    assert.equal(normalized.concurrency, 12);
    assert.equal(normalized.timeoutMs, 8000);
  });

  it('should reject concurrency of 0 or negative numbers in normalizeConfig', () => {
    assert.throws(
      () => normalizeConfig({ concurrency: 0 }),
      /Invalid concurrency value.*Must be a positive integer/
    );

    assert.throws(
      () => normalizeConfig({ concurrency: -5 }),
      /Invalid concurrency value.*Must be a positive integer/
    );

    assert.throws(
      () => normalizeConfig({ concurrency: 'invalid' }),
      /Invalid concurrency value.*Must be a positive integer/
    );

    assert.throws(
      () => normalizeConfig({ concurrency: '8abc' }),
      /Invalid concurrency value.*Must be a positive integer/
    );

    assert.throws(
      () => normalizeConfig({ concurrency: '1.5' }),
      /Invalid concurrency value.*Must be a positive integer/
    );

    assert.throws(
      () => normalizeConfig({ concurrency: 1.5 }),
      /Invalid concurrency value.*Must be a positive integer/
    );
  });

  it('should reject timeoutMs of 0 or negative numbers in normalizeConfig', () => {
    assert.throws(
      () => normalizeConfig({ timeoutMs: 0 }),
      /Invalid timeoutMs value.*Must be a positive integer/
    );

    assert.throws(
      () => normalizeConfig({ timeoutMs: -1000 }),
      /Invalid timeoutMs value.*Must be a positive integer/
    );

    assert.throws(
      () => normalizeConfig({ timeoutMs: 'invalid' }),
      /Invalid timeoutMs value.*Must be a positive integer/
    );

    assert.throws(
      () => normalizeConfig({ timeoutMs: '100ms' }),
      /Invalid timeoutMs value.*Must be a positive integer/
    );

    assert.throws(
      () => normalizeConfig({ timeoutMs: 2500.5 }),
      /Invalid timeoutMs value.*Must be a positive integer/
    );
  });

  it('should reject invalid concurrency or timeoutMs in PkgpinRunner constructor', () => {
    assert.throws(
      () => new PkgpinRunner({ cwd: tmpDir, concurrency: 0 }),
      /Invalid concurrency value.*Must be a positive integer/
    );

    assert.throws(
      () => new PkgpinRunner({ cwd: tmpDir, concurrency: '8abc' }),
      /Invalid concurrency value.*Must be a positive integer/
    );

    assert.throws(
      () => new PkgpinRunner({ cwd: tmpDir, concurrency: 2.5 }),
      /Invalid concurrency value.*Must be a positive integer/
    );

    assert.throws(
      () => new PkgpinRunner({ cwd: tmpDir, timeoutMs: 0 }),
      /Invalid timeoutMs value.*Must be a positive integer/
    );

    assert.throws(
      () => new PkgpinRunner({ cwd: tmpDir, timeoutMs: '100ms' }),
      /Invalid timeoutMs value.*Must be a positive integer/
    );
  });

  it('should preserve valid custom numbers and defaults in PkgpinRunner', () => {
    const defaultRunner = new PkgpinRunner({ cwd: tmpDir, skipConfig: true });
    assert.equal(defaultRunner.concurrency, 8);
    assert.equal(defaultRunner.timeoutMs, 6000);

    const customRunner = new PkgpinRunner({ cwd: tmpDir, skipConfig: true, concurrency: 16, timeoutMs: 3000 });
    assert.equal(customRunner.concurrency, 16);
    assert.equal(customRunner.timeoutMs, 3000);
  });
});
