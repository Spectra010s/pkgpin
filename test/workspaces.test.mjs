import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { normalizeConfig, PkgpinRunner } from '../src/index.mjs';

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
    assert.equal(wsConfig.prefix, '>=');
    assert.deepEqual([...wsConfig.customExclusions], ['custom-cli-exclude']);
  });
});
