import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadConfigFile } from '../src/index.mjs';

describe('loadConfigFile', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkgpin-load-config-file-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

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
});
