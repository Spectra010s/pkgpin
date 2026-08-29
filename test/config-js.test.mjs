import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadConfig } from '../src/index.mjs';

describe('JavaScript & ESM Configuration Loader', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkgpin-js-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should load config from pkgpin.config.js (ESM export default)', async () => {
    const content = `export default { prefix: '^', exclude: ['typescript'], concurrency: 10 };`;
    fs.writeFileSync(path.join(tmpDir, 'pkgpin.config.js'), content, 'utf8');

    const { config, filepath } = await loadConfig(tmpDir);
    assert.equal(filepath, path.join(tmpDir, 'pkgpin.config.js'));
    assert.equal(config.prefix, '^');
    assert.deepEqual(config.exclude, ['typescript']);
    assert.equal(config.concurrency, 10);
  });

  it('should load config from pkgpin.config.mjs with functional export', async () => {
    const content = `export default async () => ({ prefix: '~', target: ['react', 'react-dom'], dryRun: true });`;
    fs.writeFileSync(path.join(tmpDir, 'pkgpin.config.mjs'), content, 'utf8');

    const { config, filepath } = await loadConfig(tmpDir);
    assert.equal(filepath, path.join(tmpDir, 'pkgpin.config.mjs'));
    assert.equal(config.prefix, '~');
    assert.deepEqual(config.target, ['react', 'react-dom']);
    assert.equal(config.dryRun, true);
  });

  it('should load config from pkgpin.config.cjs (CommonJS)', async () => {
    const content = `module.exports = { prefix: '^', preservePrefix: true, concurrency: 6 };`;
    fs.writeFileSync(path.join(tmpDir, 'pkgpin.config.cjs'), content, 'utf8');

    const { config, filepath } = await loadConfig(tmpDir);
    assert.equal(filepath, path.join(tmpDir, 'pkgpin.config.cjs'));
    assert.equal(config.prefix, '^');
    assert.equal(config.preservePrefix, true);
    assert.equal(config.concurrency, 6);
  });

  it('should load config from .pkgpinrc.js and .pkgpinrc.mjs', async () => {
    const content = `export default { prefix: '^', exclude: ['eslint'] };`;
    fs.writeFileSync(path.join(tmpDir, '.pkgpinrc.js'), content, 'utf8');

    const { config, filepath } = await loadConfig(tmpDir);
    assert.equal(filepath, path.join(tmpDir, '.pkgpinrc.js'));
    assert.equal(config.prefix, '^');
    assert.deepEqual(config.exclude, ['eslint']);
  });

  it('should prioritize JS config over JSON config', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'pkgpin.config.json'),
      JSON.stringify({ prefix: 'json-prefix' }),
      'utf8'
    );
    fs.writeFileSync(
      path.join(tmpDir, 'pkgpin.config.js'),
      `export default { prefix: 'js-prefix' };`,
      'utf8'
    );

    const { config, filepath } = await loadConfig(tmpDir);
    assert.equal(filepath, path.join(tmpDir, 'pkgpin.config.js'));
    assert.equal(config.prefix, 'js-prefix');
  });

  it('should throw clear error when JS config file throws runtime error', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'pkgpin.config.js'),
      `throw new Error('intentional error');`,
      'utf8'
    );

    await assert.rejects(
      async () => loadConfig(tmpDir),
      /Failed to load configuration file.*intentional error/
    );
  });
});
