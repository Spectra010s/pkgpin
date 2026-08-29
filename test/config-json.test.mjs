import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadConfig, normalizeConfig, PkgpinRunner } from '../src/index.mjs';

describe('Static JSON & package.json Configuration Loader', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkgpin-json-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should return empty config and null filepath when no config exists', async () => {
    const { config, filepath } = await loadConfig(tmpDir);
    assert.deepEqual(config, {});
    assert.equal(filepath, null);
  });

  it('should load config from package.json "pkgpin" field', async () => {
    const pkgJson = {
      name: 'test-pkg',
      pkgpin: {
        prefix: '^',
        exclude: ['typescript', 'eslint'],
        preservePrefix: false,
        paths: ['apps/web'],
      },
    };
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(pkgJson), 'utf8');

    const { config, filepath } = await loadConfig(tmpDir);
    assert.equal(filepath, path.join(tmpDir, 'package.json'));
    assert.equal(config.prefix, '^');
    assert.deepEqual(config.exclude, ['typescript', 'eslint']);
    assert.equal(config.preservePrefix, false);
    assert.deepEqual(config.paths, ['apps/web']);
  });

  it('should load config from .pkgpinrc (JSON)', async () => {
    const rcConfig = {
      prefix: '~',
      exclude: 'react, react-dom',
      concurrency: 5,
      dryRun: true,
    };
    fs.writeFileSync(path.join(tmpDir, '.pkgpinrc'), JSON.stringify(rcConfig), 'utf8');

    const { config, filepath } = await loadConfig(tmpDir);
    assert.equal(filepath, path.join(tmpDir, '.pkgpinrc'));
    assert.equal(config.prefix, '~');
    assert.deepEqual(config.exclude, ['react', 'react-dom']);
    assert.equal(config.concurrency, 5);
    assert.equal(config.dryRun, true);
  });

  it('should load config from .pkgpinrc.json', async () => {
    const rcJsonConfig = {
      prefix: '',
      exclude: ['lodash'],
    };
    fs.writeFileSync(path.join(tmpDir, '.pkgpinrc.json'), JSON.stringify(rcJsonConfig), 'utf8');

    const { config, filepath } = await loadConfig(tmpDir);
    assert.equal(filepath, path.join(tmpDir, '.pkgpinrc.json'));
    assert.equal(config.prefix, '');
    assert.deepEqual(config.exclude, ['lodash']);
  });

  it('should load config from pkgpin.config.json', async () => {
    const pkgpinConfig = {
      prefix: '^',
      concurrency: 4,
    };
    fs.writeFileSync(path.join(tmpDir, 'pkgpin.config.json'), JSON.stringify(pkgpinConfig), 'utf8');

    const { config, filepath } = await loadConfig(tmpDir);
    assert.equal(filepath, path.join(tmpDir, 'pkgpin.config.json'));
    assert.equal(config.prefix, '^');
    assert.equal(config.concurrency, 4);
  });

  it('should respect discovery precedence: pkgpin.config.json > .pkgpinrc.json > .pkgpinrc > package.json', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ pkgpin: { prefix: 'pkgjson' } }),
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
    let res = await loadConfig(tmpDir);
    assert.equal(res.config.prefix, 'configjson');
    assert.equal(res.filepath, path.join(tmpDir, 'pkgpin.config.json'));

    // Remove pkgpin.config.json -> .pkgpinrc.json
    fs.unlinkSync(path.join(tmpDir, 'pkgpin.config.json'));
    res = await loadConfig(tmpDir);
    assert.equal(res.config.prefix, 'rcjson');
    assert.equal(res.filepath, path.join(tmpDir, '.pkgpinrc.json'));

    // Remove .pkgpinrc.json -> .pkgpinrc
    fs.unlinkSync(path.join(tmpDir, '.pkgpinrc.json'));
    res = await loadConfig(tmpDir);
    assert.equal(res.config.prefix, 'rc');
    assert.equal(res.filepath, path.join(tmpDir, '.pkgpinrc'));

    // Remove .pkgpinrc -> package.json
    fs.unlinkSync(path.join(tmpDir, '.pkgpinrc'));
    res = await loadConfig(tmpDir);
    assert.equal(res.config.prefix, 'pkgjson');
    assert.equal(res.filepath, path.join(tmpDir, 'package.json'));
  });

  it('should throw clear error on malformed JSON config', async () => {
    fs.writeFileSync(path.join(tmpDir, '.pkgpinrc.json'), '{ malformed json: true }', 'utf8');

    await assert.rejects(
      async () => loadConfig(tmpDir),
      /Failed to parse configuration file/
    );
  });
});
