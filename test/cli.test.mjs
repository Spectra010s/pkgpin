import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const CLI_PATH = path.resolve('./bin/cli.mjs');

describe('CLI Integration with Config (Issue #1)', () => {
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
});
