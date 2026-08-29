import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { loadConfigFile } from '../src/index.mjs';

const CLI_PATH = path.resolve('bin/cli.mjs');

describe('--config / -C CLI Flag', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkgpin-config-flag-'));
    // Minimal package.json so the runner can resolve target files
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'config-flag-test', dependencies: { 'is-number': '6.0.0' } }),
      'utf8'
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // --- loadConfigFile unit tests ---

  it('should load a JSON config file by explicit path', async () => {
    const cfgPath = path.join(tmpDir, 'custom.json');
    fs.writeFileSync(cfgPath, JSON.stringify({ prefix: '~', concurrency: 3 }), 'utf8');

    const { config, filepath } = await loadConfigFile(cfgPath);
    assert.equal(filepath, cfgPath);
    assert.equal(config.prefix, '~');
    assert.equal(config.concurrency, 3);
  });

  it('should load a JS config file by explicit path', async () => {
    const cfgPath = path.join(tmpDir, 'my-config.mjs');
    fs.writeFileSync(cfgPath, `export default { prefix: '^', exclude: ['lodash'] };`, 'utf8');

    const { config, filepath } = await loadConfigFile(cfgPath);
    assert.equal(filepath, cfgPath);
    assert.equal(config.prefix, '^');
    assert.deepEqual(config.exclude, ['lodash']);
  });

  it('should throw when explicit config file does not exist', async () => {
    await assert.rejects(
      () => loadConfigFile(path.join(tmpDir, 'nonexistent.json')),
      /Configuration file not found/
    );
  });

  it('should discover and load config when a directory is specified', async () => {
    const customDir = path.join(tmpDir, 'custom-config-dir');
    fs.mkdirSync(customDir);
    fs.writeFileSync(
      path.join(customDir, 'pkgpin.config.json'),
      JSON.stringify({ prefix: '~', concurrency: 5 }),
      'utf8'
    );

    const { config, filepath } = await loadConfigFile(customDir);
    assert.equal(filepath, path.join(customDir, 'pkgpin.config.json'));
    assert.equal(config.prefix, '~');
    assert.equal(config.concurrency, 5);
  });

  it('should throw when specified directory contains no config files', async () => {
    const emptyDir = path.join(tmpDir, 'empty-dir');
    fs.mkdirSync(emptyDir);

    await assert.rejects(
      () => loadConfigFile(emptyDir),
      /No configuration file found in directory/
    );
  });

  // --- CLI integration tests ---

  it('should use --config flag to load a custom JSON config', () => {
    const cfgPath = path.join(tmpDir, 'ci-config.json');
    fs.writeFileSync(cfgPath, JSON.stringify({ prefix: '~', dryRun: true }), 'utf8');

    const result = execSync(
      `node ${CLI_PATH} --config=${cfgPath}`,
      { cwd: tmpDir, encoding: 'utf8', timeout: 15000 }
    );

    // Dry run output confirms the config was loaded
    assert.match(result, /DRY RUN/);
    assert.match(result, /~"/);
  });

  it('should use -C short flag to load a custom JS config', () => {
    const cfgPath = path.join(tmpDir, 'ci-config.mjs');
    fs.writeFileSync(cfgPath, `export default { prefix: '^', dryRun: true };`, 'utf8');

    const result = execSync(
      `node ${CLI_PATH} -C ${cfgPath}`,
      { cwd: tmpDir, encoding: 'utf8', timeout: 15000 }
    );

    assert.match(result, /DRY RUN/);
  });

  it('should let CLI flags override --config values', () => {
    const cfgPath = path.join(tmpDir, 'base.json');
    fs.writeFileSync(cfgPath, JSON.stringify({ prefix: '~', dryRun: true }), 'utf8');

    const result = execSync(
      `node ${CLI_PATH} --config=${cfgPath} --prefix=^`,
      { cwd: tmpDir, encoding: 'utf8', timeout: 15000 }
    );

    // CLI --prefix=^ should override config's prefix '~'
    assert.match(result, /DRY RUN/);
    assert.match(result, /\^"/);
  });

  it('should error when --config is given without a path', () => {
    assert.throws(
      () => execSync(`node ${CLI_PATH} --config`, { cwd: tmpDir, encoding: 'utf8', timeout: 5000 }),
      /Error: Option --config requires a file path argument/
    );
  });
});
