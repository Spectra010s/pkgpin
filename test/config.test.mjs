import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadConfig, normalizeConfig, PkgpinRunner } from '../src/index.mjs';

describe('Config Loader (Issue #1)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkgpin-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should return empty config and null filepath when no config exists', () => {
    const { config, filepath } = loadConfig(tmpDir);
    assert.deepEqual(config, {});
    assert.equal(filepath, null);
  });

  it('should load config from package.json "pkgpin" field', () => {
    const pkgJson = {
      name: 'test-pkg',
      pkgpin: {
        prefix: '^',
        exclude: ['typescript', 'eslint'],
        concurrency: 12,
        preservePrefix: true,
        paths: ['apps/web'],
      },
    };
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(pkgJson), 'utf8');

    const { config, filepath } = loadConfig(tmpDir);
    assert.equal(filepath, path.join(tmpDir, 'package.json'));
    assert.equal(config.prefix, '^');
    assert.deepEqual(config.exclude, ['typescript', 'eslint']);
    assert.equal(config.concurrency, 12);
    assert.equal(config.preservePrefix, true);
    assert.deepEqual(config.paths, ['apps/web']);
  });

  it('should load config from .pkgpinrc (JSON)', () => {
    const rcConfig = {
      prefix: '~',
      exclude: 'react, react-dom',
      target: ['zustand'],
      dryRun: true,
    };
    fs.writeFileSync(path.join(tmpDir, '.pkgpinrc'), JSON.stringify(rcConfig), 'utf8');

    const { config, filepath } = loadConfig(tmpDir);
    assert.equal(filepath, path.join(tmpDir, '.pkgpinrc'));
    assert.equal(config.prefix, '~');
    assert.deepEqual(config.exclude, ['react', 'react-dom']);
    assert.deepEqual(config.target, ['zustand']);
    assert.equal(config.dryRun, true);
  });

  it('should load config from .pkgpinrc.json', () => {
    const rcJsonConfig = {
      prefix: '',
      exclude: ['lodash'],
    };
    fs.writeFileSync(path.join(tmpDir, '.pkgpinrc.json'), JSON.stringify(rcJsonConfig), 'utf8');

    const { config, filepath } = loadConfig(tmpDir);
    assert.equal(filepath, path.join(tmpDir, '.pkgpinrc.json'));
    assert.equal(config.prefix, '');
    assert.deepEqual(config.exclude, ['lodash']);
  });

  it('should load config from pkgpin.config.json', () => {
    const pkgpinConfig = {
      prefix: '^',
      concurrency: 4,
    };
    fs.writeFileSync(path.join(tmpDir, 'pkgpin.config.json'), JSON.stringify(pkgpinConfig), 'utf8');

    const { config, filepath } = loadConfig(tmpDir);
    assert.equal(filepath, path.join(tmpDir, 'pkgpin.config.json'));
    assert.equal(config.prefix, '^');
    assert.equal(config.concurrency, 4);
  });

  it('should respect discovery precedence: pkgpin.config.json > .pkgpinrc.json > .pkgpinrc > package.json', () => {
    // Write all 4 files
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'pkg', pkgpin: { prefix: 'pkgjson' } }),
      'utf8'
    );
    fs.writeFileSync(
      path.join(tmpDir, '.pkgpinrc'),
      JSON.stringify({ prefix: 'rc' }),
      'utf8'
    );
    fs.writeFileSync(
      path.join(tmpDir, '.pkgpinrc.json'),
      JSON.stringify({ prefix: 'rcjson' }),
      'utf8'
    );
    fs.writeFileSync(
      path.join(tmpDir, 'pkgpin.config.json'),
      JSON.stringify({ prefix: 'configjson' }),
      'utf8'
    );

    // pkgpin.config.json takes precedence
    let res = loadConfig(tmpDir);
    assert.equal(res.config.prefix, 'configjson');
    assert.equal(res.filepath, path.join(tmpDir, 'pkgpin.config.json'));

    // Remove pkgpin.config.json -> .pkgpinrc.json
    fs.unlinkSync(path.join(tmpDir, 'pkgpin.config.json'));
    res = loadConfig(tmpDir);
    assert.equal(res.config.prefix, 'rcjson');
    assert.equal(res.filepath, path.join(tmpDir, '.pkgpinrc.json'));

    // Remove .pkgpinrc.json -> .pkgpinrc
    fs.unlinkSync(path.join(tmpDir, '.pkgpinrc.json'));
    res = loadConfig(tmpDir);
    assert.equal(res.config.prefix, 'rc');
    assert.equal(res.filepath, path.join(tmpDir, '.pkgpinrc'));

    // Remove .pkgpinrc -> package.json
    fs.unlinkSync(path.join(tmpDir, '.pkgpinrc'));
    res = loadConfig(tmpDir);
    assert.equal(res.config.prefix, 'pkgjson');
    assert.equal(res.filepath, path.join(tmpDir, 'package.json'));
  });

  it('should throw clear error on malformed JSON config', () => {
    fs.writeFileSync(path.join(tmpDir, '.pkgpinrc.json'), '{ malformed json: true }', 'utf8');

    assert.throws(
      () => loadConfig(tmpDir),
      /Failed to parse configuration file/
    );
  });

  it('should allow PkgpinRunner constructor options to override file config', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'pkgpin.config.json'),
      JSON.stringify({
        prefix: '^',
        exclude: ['typescript'],
        concurrency: 4,
        dryRun: false,
      }),
      'utf8'
    );

    const runner = new PkgpinRunner({
      cwd: tmpDir,
      prefix: '~',
      exclude: ['eslint'],
      concurrency: 16,
      dryRun: true,
    });

    assert.equal(runner.prefix, '~');
    assert.deepEqual([...runner.customExclusions], ['eslint']);
    assert.equal(runner.concurrency, 16);
    assert.equal(runner.isDryRun, true);
  });

  it('should apply file config in PkgpinRunner when options are not passed', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'pkgpin.config.json'),
      JSON.stringify({
        prefix: '^',
        exclude: ['typescript', 'react'],
        target: ['zustand'],
        concurrency: 4,
        preservePrefix: true,
      }),
      'utf8'
    );

    const runner = new PkgpinRunner({
      cwd: tmpDir,
    });

    assert.equal(runner.prefix, '^');
    assert.deepEqual([...runner.customExclusions], ['typescript', 'react']);
    assert.deepEqual([...runner.targets], ['zustand']);
    assert.equal(runner.concurrency, 4);
    assert.equal(runner.preservePrefix, true);
  });

  it('should correctly normalizeConfig options', () => {
    const normalized = normalizeConfig({
      prefix: '^',
      preservePrefix: 1,
      exclude: 'a, b  c',
      target: ['x', 'y'],
      concurrency: '10',
      dryRun: true,
      timeoutMs: '5000',
    });

    assert.equal(normalized.prefix, '^');
    assert.equal(normalized.preservePrefix, true);
    assert.deepEqual(normalized.exclude, ['a', 'b', 'c']);
    assert.deepEqual(normalized.target, ['x', 'y']);
    assert.equal(normalized.concurrency, 10);
    assert.equal(normalized.dryRun, true);
    assert.equal(normalized.timeoutMs, 5000);
  });
});
