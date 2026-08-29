import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PkgpinRunner } from '../src/index.mjs';

describe('Config Precedence (async JS vs sync JSON)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkgpin-prec-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should not leak lower-precedence JSON config fields when JS config wins', async () => {
    // JSON config sets exclude and target — these should NOT leak through when a
    // higher-precedence JS config exists but omits those fields.
    fs.writeFileSync(
      path.join(tmpDir, 'pkgpin.config.json'),
      JSON.stringify({ prefix: 'json-prefix', exclude: ['leaked-pkg'], target: ['leaked-target'] }),
      'utf8'
    );
    // JS config only sets prefix — exclude and target are intentionally absent.
    fs.writeFileSync(
      path.join(tmpDir, 'pkgpin.config.js'),
      `export default { prefix: '~' };`,
      'utf8'
    );
    // Minimal package.json so run() can resolve target files
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'test-leak', dependencies: {} }),
      'utf8'
    );

    const runner = new PkgpinRunner({ cwd: tmpDir, dryRun: true });
    await runner.run();

    // The JS config should be the sole source: prefix '~', no exclude, no target
    assert.equal(runner.prefix, '~');
    assert.equal(runner.customExclusions.size, 0, 'exclude from JSON config should not leak');
    assert.equal(runner.targets.size, 0, 'target from JSON config should not leak');
  });

  it('should let programmatic options override JS config after reset', async () => {
    // JS config sets prefix and concurrency
    fs.writeFileSync(
      path.join(tmpDir, 'pkgpin.config.js'),
      `export default { prefix: '^', concurrency: 4 };`,
      'utf8'
    );
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'test-override', dependencies: {} }),
      'utf8'
    );

    // Programmatic caller passes prefix '~' — should override the JS config's '^'
    const runner = new PkgpinRunner({ cwd: tmpDir, prefix: '~', dryRun: true });
    await runner.run();

    assert.equal(runner.prefix, '~', 'user-provided prefix should override JS config');
    assert.equal(runner.concurrency, 4, 'JS config concurrency should still apply');
  });
});
