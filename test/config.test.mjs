import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadConfig, normalizeConfig, PkgpinRunner } from '../src/index.mjs';

describe('Static JSON & package.json Config Loader', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkgpin-test-'));
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
        concurrency: 12,
        preservePrefix: true,
        paths: ['apps/web'],
      },
    };
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(pkgJson), 'utf8');

    const { config, filepath } = await loadConfig(tmpDir);
    assert.equal(filepath, path.join(tmpDir, 'package.json'));
    assert.equal(config.prefix, '^');
    assert.deepEqual(config.exclude, ['typescript', 'eslint']);
    assert.equal(config.concurrency, 12);
    assert.equal(config.preservePrefix, true);
    assert.deepEqual(config.paths, ['apps/web']);
  });

  it('should load config from .pkgpinrc (JSON)', async () => {
    const rcConfig = {
      prefix: '~',
      exclude: 'react, react-dom',
      target: ['zustand'],
      dryRun: true,
    };
    fs.writeFileSync(path.join(tmpDir, '.pkgpinrc'), JSON.stringify(rcConfig), 'utf8');

    const { config, filepath } = await loadConfig(tmpDir);
    assert.equal(filepath, path.join(tmpDir, '.pkgpinrc'));
    assert.equal(config.prefix, '~');
    assert.deepEqual(config.exclude, ['react', 'react-dom']);
    assert.deepEqual(config.target, ['zustand']);
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

describe('JavaScript & ESM Config Loader', () => {
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

describe('Monorepo Workspace Overrides', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkgpin-ws-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should normalize workspaces configuration object', () => {
    const raw = {
      prefix: '^',
      exclude: ['typescript'],
      workspaces: {
        'apps/web': {
          target: ['react', 'react-dom'],
          preservePrefix: true,
        },
        'apps/api': {
          prefix: '~',
          exclude: 'fastify, pino',
        },
      },
    };

    const normalized = normalizeConfig(raw);
    assert.equal(normalized.prefix, '^');
    assert.deepEqual(normalized.exclude, ['typescript']);
    assert.ok(normalized.workspaces);
    assert.deepEqual(normalized.workspaces['apps/web'].target, ['react', 'react-dom']);
    assert.equal(normalized.workspaces['apps/web'].preservePrefix, true);
    assert.equal(normalized.workspaces['apps/api'].prefix, '~');
    assert.deepEqual(normalized.workspaces['apps/api'].exclude, ['fastify', 'pino']);
  });

  it('should resolve workspace config by directory path', () => {
    const runner = new PkgpinRunner({
      cwd: tmpDir,
      prefix: '^',
      exclude: ['typescript'],
      workspaces: {
        'apps/web': {
          prefix: '',
          target: ['react'],
        },
        'apps/api': {
          prefix: '~',
          exclude: ['fastify'],
        },
      },
    });

    const webConfig = runner.resolveWorkspaceConfig(
      path.join(tmpDir, 'apps/web/package.json'),
      'web-app'
    );
    assert.equal(webConfig.prefix, '');
    assert.deepEqual([...webConfig.targets], ['react']);
    assert.deepEqual([...webConfig.customExclusions], ['typescript']);

    const apiConfig = runner.resolveWorkspaceConfig(
      path.join(tmpDir, 'apps/api/package.json'),
      'api-app'
    );
    assert.equal(apiConfig.prefix, '~');
    assert.deepEqual([...apiConfig.customExclusions], ['typescript', 'fastify']);
  });

  it('should resolve workspace config by package name', () => {
    const runner = new PkgpinRunner({
      cwd: tmpDir,
      prefix: '^',
      workspaces: {
        '@myrepo/shared-ui': {
          prefix: '~',
          preservePrefix: true,
        },
      },
    });

    const wsConfig = runner.resolveWorkspaceConfig(
      path.join(tmpDir, 'packages/ui/package.json'),
      '@myrepo/shared-ui'
    );
    assert.equal(wsConfig.prefix, '~');
    assert.equal(wsConfig.preservePrefix, true);
  });

  it('should resolve workspace config by wildcard pattern (e.g. apps/*)', () => {
    const runner = new PkgpinRunner({
      cwd: tmpDir,
      prefix: '',
      workspaces: {
        'apps/*': {
          prefix: '^',
        },
        'packages/**': {
          prefix: '~',
        },
      },
    });

    const app1Config = runner.resolveWorkspaceConfig(
      path.join(tmpDir, 'apps/frontend/package.json'),
      'frontend'
    );
    assert.equal(app1Config.prefix, '^');

    const pkgConfig = runner.resolveWorkspaceConfig(
      path.join(tmpDir, 'packages/utils/common/package.json'),
      'common-utils'
    );
    assert.equal(pkgConfig.prefix, '~');
  });

  it('should allow CLI options to override workspace configuration', () => {
    const runner = new PkgpinRunner({
      cwd: tmpDir,
      _cliOptions: {
        prefix: '>=', // passed explicitly on CLI
        exclude: ['custom-cli-exclude'], // passed explicitly on CLI
      },
      workspaces: {
        'apps/web': {
          prefix: '~',
          exclude: ['fastify'],
        },
      },
    });

    const wsConfig = runner.resolveWorkspaceConfig(
      path.join(tmpDir, 'apps/web/package.json'),
      'web'
    );
    // CLI flag takes ultimate precedence
    assert.equal(wsConfig.prefix, '>=');
    assert.deepEqual([...wsConfig.customExclusions], ['custom-cli-exclude']);
  });
});

