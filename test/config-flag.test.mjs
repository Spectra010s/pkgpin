import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

const CLI_PATH = path.resolve('bin/cli.mjs');

describe('--config / -C CLI Flag', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkgpin-config-flag-'));
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'config-flag-test', dependencies: { 'is-number': '6.0.0' } }),
      'utf8'
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should use --config flag to load a custom JSON config', () => {
    const cfgPath = path.join(tmpDir, 'ci-config.json');
    fs.writeFileSync(cfgPath, JSON.stringify({ prefix: '~', dryRun: true }), 'utf8');

    const result = execSync(
      `node ${CLI_PATH} --config=${cfgPath}`,
      { cwd: tmpDir, encoding: 'utf8', timeout: 15000 }
    );

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

  it('should use --config flag pointing to a directory to discover config', () => {
    const customDir = path.join(tmpDir, 'build-configs');
    fs.mkdirSync(customDir);
    fs.writeFileSync(
      path.join(customDir, 'pkgpin.config.json'),
      JSON.stringify({ prefix: '~', dryRun: true }),
      'utf8'
    );

    const result = execSync(
      `node ${CLI_PATH} --config=${customDir}`,
      { cwd: tmpDir, encoding: 'utf8', timeout: 15000 }
    );

    assert.match(result, /DRY RUN/);
    assert.match(result, /~"/);
  });

  it('should resolve relative config paths against cwd in CLI', () => {
    const subDir = path.join(tmpDir, 'configs');
    fs.mkdirSync(subDir);
    fs.writeFileSync(
      path.join(subDir, 'relative.config.json'),
      JSON.stringify({ prefix: '^', dryRun: true }),
      'utf8'
    );

    const result = execSync(
      `node ${CLI_PATH} --config=./configs/relative.config.json`,
      { cwd: tmpDir, encoding: 'utf8', timeout: 15000 }
    );

    assert.match(result, /DRY RUN/);
    assert.match(result, /\^"/);
  });

  it('should let CLI flags override --config values', () => {
    const cfgPath = path.join(tmpDir, 'base.json');
    fs.writeFileSync(cfgPath, JSON.stringify({ prefix: '~', dryRun: true }), 'utf8');

    const result = execSync(
      `node ${CLI_PATH} --config=${cfgPath} --prefix=^`,
      { cwd: tmpDir, encoding: 'utf8', timeout: 15000 }
    );

    assert.match(result, /DRY RUN/);
    assert.match(result, /\^"/);
  });

  it('should error when --config points to a nonexistent file or directory', () => {
    assert.throws(
      () => execSync(`node ${CLI_PATH} --config=./missing-file.json`, { cwd: tmpDir, encoding: 'utf8', timeout: 5000 }),
      /Configuration file not found/
    );
  });

  it('should error when --config is given without a path', () => {
    assert.throws(
      () => execSync(`node ${CLI_PATH} --config`, { cwd: tmpDir, encoding: 'utf8', timeout: 5000 }),
      /Error: Option --config requires a file path argument/
    );
  });
});
