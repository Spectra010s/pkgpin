import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const CLI_PATH = path.resolve('./bin/cli.mjs');

describe('CLI Integration with Config & Workspaces', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkgpin-cli-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should read config from package.json pkgpin field when running CLI', () => {
    const pkgJson = {
      name: 'test-app',
      pkgpin: {
        exclude: ['fastify'],
        prefix: '^',
        dryRun: true,
      },
      dependencies: {
        fastify: '4.0.0',
      },
    };
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(pkgJson, null, 2), 'utf8');

    const output = execFileSync('node', [CLI_PATH, '--dry-run'], {
      cwd: tmpDir,
      encoding: 'utf8',
    });

    assert.match(output, /Excluded:.*fastify/);
    assert.match(output, /Prefix:.*\^/);
  });

  it('should allow CLI flag to override config exclude and prefix', () => {
    const pkgJson = {
      name: 'test-app',
      pkgpin: {
        exclude: ['fastify'],
        prefix: '^',
      },
      dependencies: {
        fastify: '4.0.0',
      },
    };
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(pkgJson, null, 2), 'utf8');

    const output = execFileSync('node', [CLI_PATH, '--exclude=express', '--prefix=~', '--dry-run'], {
      cwd: tmpDir,
      encoding: 'utf8',
    });

    assert.match(output, /Excluded:.*express/);
    assert.match(output, /Prefix:.*~/);
  });

  it('should read config from pkgpin.config.js when running CLI', () => {
    const pkgJson = {
      name: 'test-app',
      type: 'module',
      dependencies: {
        koa: '2.0.0',
      },
    };
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(pkgJson, null, 2), 'utf8');

    const configJs = `export default { prefix: '~', exclude: ['koa'], dryRun: true };`;
    fs.writeFileSync(path.join(tmpDir, 'pkgpin.config.js'), configJs, 'utf8');

    const output = execFileSync('node', [CLI_PATH], {
      cwd: tmpDir,
      encoding: 'utf8',
    });

    assert.match(output, /Excluded:.*koa/);
    assert.match(output, /Prefix:.*~/);
  });

  it('should apply workspace overrides in monorepo CLI run', () => {
    // Root config
    const rootPkgJson = {
      name: 'root-monorepo',
      type: 'module',
      pkgpin: {
        prefix: '^',
        exclude: ['global-dep'],
        dryRun: true,
        workspaces: {
          'apps/web': {
            prefix: '',
            exclude: ['web-local-dep'],
          },
          'apps/api': {
            prefix: '~',
          },
        },
      },
    };
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(rootPkgJson, null, 2), 'utf8');

    // apps/web
    fs.mkdirSync(path.join(tmpDir, 'apps/web'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'apps/web/package.json'),
      JSON.stringify({ name: 'web-pkg', dependencies: { 'web-local-dep': '1.0.0' } }),
      'utf8'
    );

    // apps/api
    fs.mkdirSync(path.join(tmpDir, 'apps/api'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'apps/api/package.json'),
      JSON.stringify({ name: 'api-pkg', dependencies: { 'api-dep': '1.0.0' } }),
      'utf8'
    );

    const output = execFileSync('node', [CLI_PATH], {
      cwd: tmpDir,
      encoding: 'utf8',
    });

    // Both apps checked
    assert.match(output, /apps\/web\/package\.json/);
    assert.match(output, /apps\/api\/package\.json/);
  });
});
