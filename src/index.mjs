import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { loadConfig, loadConfigSync, normalizeConfig } from './config/index.mjs';

export { loadConfig, loadConfigSync, normalizeConfig };

// Protocols / prefixes to ignore
const IGNORED_VERSION_PREFIXES = [
  'workspace:',
  'file:',
  'link:',
  'portal:',
  'git:',
  'git+',
  'http:',
  'https:',
  'github:',
];

// Directories to ignore when auto-discovering package.json files
const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.turbo',
  'dist',
  'build',
  'out',
  'coverage',
  '.github'
]);

/**
 * Helper to test wildcard / glob patterns against workspace directories (e.g. "apps/*", "packages/**")
 */
function matchWorkspacePattern(pattern, dir) {
  if (pattern === dir) return true;
  if (pattern.endsWith('/*')) {
    const base = pattern.slice(0, -2);
    if (dir.startsWith(base + '/')) {
      const remainder = dir.slice(base.length + 1);
      return remainder.length > 0 && !remainder.includes('/');
    }
  }
  if (pattern.endsWith('/**') || pattern.endsWith('*')) {
    const base = pattern.replace(/\/\*\*?$/, '');
    return dir === base || dir.startsWith(base + '/');
  }
  return false;
}

export class PkgpinRunner {
  constructor(options = {}) {
    this.cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
    this._skipConfig = Boolean(options.skipConfig);
    this._userOptions = options;
    this._cliOptions = options._cliOptions || {};

    const fileConfig = this._skipConfig
      ? {}
      : (options._preloadedConfig || loadConfigSync(this.cwd).config);

    this.isDryRun = options.dryRun !== undefined ? Boolean(options.dryRun) : Boolean(fileConfig.dryRun);
    this.prefix = options.prefix !== undefined ? options.prefix : (fileConfig.prefix ?? ''); // default: exact pinned (no ^ or ~)
    this.preservePrefix = options.preservePrefix !== undefined ? Boolean(options.preservePrefix) : Boolean(fileConfig.preservePrefix);
    this.concurrency = options.concurrency || fileConfig.concurrency || 8;
    this.timeoutMs = options.timeoutMs || fileConfig.timeoutMs || 6000;

    const excludes = options.exclude !== undefined ? options.exclude : (fileConfig.exclude || []);
    this.customExclusions = new Set(
      (Array.isArray(excludes) ? excludes : [excludes]).map((p) => String(p).trim().toLowerCase()).filter(Boolean)
    );

    const targets = options.target !== undefined ? options.target : (fileConfig.target || []);
    this.targets = new Set(
      (Array.isArray(targets) ? targets : [targets]).map((p) => String(p).trim().toLowerCase()).filter(Boolean)
    );

    this.defaultPaths = options.paths !== undefined ? options.paths : (fileConfig.paths || []);
    this.workspaces = options.workspaces || fileConfig.workspaces || {};
    this.versionCache = new Map();
  }

  /**
   * Matches workspace override rules for a given file path or package name
   */
  resolveWorkspaceConfig(filePath, pkgName) {
    const dirRel = path.relative(this.cwd, path.dirname(filePath)).replace(/\\/g, '/');
    const cleanDir = dirRel === '' ? '.' : dirRel;

    let matchedWsConfig = null;

    if (this.workspaces && typeof this.workspaces === 'object') {
      // 1. Check exact directory match (e.g. "apps/web" or ".")
      if (this.workspaces[cleanDir]) {
        matchedWsConfig = this.workspaces[cleanDir];
      } else if (this.workspaces[dirRel]) {
        matchedWsConfig = this.workspaces[dirRel];
      }
      // 2. Check package name match (e.g. "@repo/web")
      else if (pkgName && this.workspaces[pkgName]) {
        matchedWsConfig = this.workspaces[pkgName];
      }
      // 3. Check glob/wildcard patterns (e.g. "apps/*", "packages/**")
      else {
        for (const [pattern, wsConfig] of Object.entries(this.workspaces)) {
          if (matchWorkspacePattern(pattern, cleanDir)) {
            matchedWsConfig = wsConfig;
            break;
          }
        }
      }
    }

    // Resolve merged options: CLI Flags > Workspace Overrides > Root Config > Default
    const cli = this._cliOptions;

    const prefix = cli.prefix !== undefined
      ? cli.prefix
      : (matchedWsConfig?.prefix !== undefined ? matchedWsConfig.prefix : this.prefix);

    const preservePrefix = cli.preservePrefix !== undefined
      ? cli.preservePrefix
      : (matchedWsConfig?.preservePrefix !== undefined ? matchedWsConfig.preservePrefix : this.preservePrefix);

    const concurrency = cli.concurrency !== undefined
      ? cli.concurrency
      : (matchedWsConfig?.concurrency !== undefined ? matchedWsConfig.concurrency : this.concurrency);

    let customExclusions = this.customExclusions;
    if (cli.exclude !== undefined) {
      customExclusions = new Set(
        (Array.isArray(cli.exclude) ? cli.exclude : [cli.exclude])
          .map((p) => String(p).trim().toLowerCase())
          .filter(Boolean)
      );
    } else if (matchedWsConfig?.exclude !== undefined) {
      // Combine root exclusions with workspace exclusions
      const wsExcludes = Array.isArray(matchedWsConfig.exclude) ? matchedWsConfig.exclude : [matchedWsConfig.exclude];
      customExclusions = new Set([
        ...this.customExclusions,
        ...wsExcludes.map((p) => String(p).trim().toLowerCase()).filter(Boolean),
      ]);
    }

    let targets = this.targets;
    if (cli.target !== undefined) {
      targets = new Set(
        (Array.isArray(cli.target) ? cli.target : [cli.target])
          .map((p) => String(p).trim().toLowerCase())
          .filter(Boolean)
      );
    } else if (matchedWsConfig?.target !== undefined) {
      const wsTargets = Array.isArray(matchedWsConfig.target) ? matchedWsConfig.target : [matchedWsConfig.target];
      targets = new Set(
        wsTargets.map((p) => String(p).trim().toLowerCase()).filter(Boolean)
      );
    }

    return {
      prefix,
      preservePrefix,
      concurrency,
      customExclusions,
      targets,
    };
  }

  /**
   * Check if a package should be excluded from update
   */
  shouldSkip(pkgName, currentVersion, context = this) {
    const exclusions = context.customExclusions || this.customExclusions;
    const targets = context.targets || this.targets;

    if (exclusions.has(pkgName.toLowerCase())) {
      return { skip: true, reason: 'excluded' };
    }

    if (targets.size > 0 && !targets.has(pkgName.toLowerCase())) {
      return { skip: true, reason: 'not targeted' };
    }

    if (typeof currentVersion !== 'string') {
      return { skip: true, reason: 'invalid version format' };
    }

    for (const pfx of IGNORED_VERSION_PREFIXES) {
      if (currentVersion.startsWith(pfx)) {
        return { skip: true, reason: `uses ${pfx} protocol` };
      }
    }

    return { skip: false };
  }

  /**
   * Format new version according to prefix settings
   */
  formatVersion(oldVersionSpec, latestVersion, context = this) {
    if (!latestVersion) return oldVersionSpec;
    if (oldVersionSpec === '*' || oldVersionSpec === 'latest') return oldVersionSpec;

    const preservePrefix = context.preservePrefix !== undefined ? context.preservePrefix : this.preservePrefix;
    const prefix = context.prefix !== undefined ? context.prefix : this.prefix;

    if (preservePrefix) {
      const match = oldVersionSpec.match(/^([\^~>=<!]*\s*)/);
      const existingPrefix = match ? match[1] : '';
      return `${existingPrefix}${latestVersion}`;
    }

    return `${prefix}${latestVersion}`;
  }

  /**
   * Fetch latest package version from npm registry or npm view
   */
  async getLatestVersion(packageName) {
    if (this.versionCache.has(packageName)) {
      return this.versionCache.get(packageName);
    }

    const encodedName = packageName.startsWith('@')
      ? `@${encodeURIComponent(packageName.slice(1))}`
      : encodeURIComponent(packageName);

    const registryUrl = `https://registry.npmjs.org/${encodedName}/latest`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(registryUrl, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'pkgpin-cli',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        if (data && data.version) {
          this.versionCache.set(packageName, data.version);
          return data.version;
        }
      }
    } catch {
      // Fetch failed or timed out, fallback to npm view
    }

    try {
      const version = execSync(`npm view ${packageName} version`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 8000,
      }).trim();

      if (version) {
        this.versionCache.set(packageName, version);
        return version;
      }
    } catch {
      // Fallback failed
    }

    this.versionCache.set(packageName, null);
    return null;
  }

  /**
   * Concurrency runner
   */
  async mapConcurrent(items, limit, fn) {
    const results = [];
    const executing = [];

    for (const item of items) {
      const p = Promise.resolve().then(() => fn(item));
      results.push(p);

      if (limit <= items.length) {
        const e = p.then(() => executing.splice(executing.indexOf(e), 1));
        executing.push(e);
        if (executing.length >= limit) {
          await Promise.race(executing);
        }
      }
    }

    return Promise.all(results);
  }

  /**
   * Recursively discover package.json files in a directory
   */
  discoverPackageJsonFiles(dir = this.cwd, fileList = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) {
          this.discoverPackageJsonFiles(fullPath, fileList);
        }
      } else if (entry.isFile() && entry.name === 'package.json') {
        fileList.push(fullPath);
      }
    }

    return fileList;
  }

  /**
   * Parse target paths or auto-discover
   */
  resolveTargetFiles(inputPaths = []) {
    if (inputPaths && inputPaths.length > 0) {
      const targets = [];
      for (const p of inputPaths) {
        let full = path.resolve(this.cwd, p);
        if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
          full = path.join(full, 'package.json');
        } else if (!full.endsWith('package.json')) {
          const nested = path.join(full, 'package.json');
          if (fs.existsSync(nested)) {
            full = nested;
          }
        }
        targets.push(full);
      }
      return targets;
    }

    // Auto-discover if no explicit targets are provided
    return this.discoverPackageJsonFiles(this.cwd);
  }

  /**
   * Process a single package.json file
   */
  async processFile(filePath) {
    const relativePath = path.relative(this.cwd, filePath);

    if (!fs.existsSync(filePath)) {
      console.error(`\x1b[31mFile not found: \x1b[0m\x1b[33m${relativePath}\x1b[0m`);
      return { filePath, relativePath, updated: 0, error: 'File not found' };
    }

    let rawContent;
    let pkgData;

    try {
      rawContent = fs.readFileSync(filePath, 'utf8');
      pkgData = JSON.parse(rawContent);
    } catch (err) {
      console.error(`❌ Failed to parse ${relativePath}:`, err.message);
      return { filePath, relativePath, updated: 0, error: err.message };
    }

    console.log(`\nChecking \x1b[36m${relativePath}\x1b[0m (${pkgData.name || 'unnamed'})`);

    const fileContext = this.resolveWorkspaceConfig(filePath, pkgData.name);

    const depTypes = ['dependencies', 'devDependencies'];
    let totalUpdated = 0;
    const updates = [];

    for (const depType of depTypes) {
      const deps = pkgData[depType];
      if (!deps || typeof deps !== 'object') continue;

      const depNames = Object.keys(deps);

      await this.mapConcurrent(depNames, fileContext.concurrency, async (depName) => {
        const currentVersion = deps[depName];
        const skipCheck = this.shouldSkip(depName, currentVersion, fileContext);

        if (skipCheck.skip) {
          return;
        }

        const latestVersion = await this.getLatestVersion(depName);
        if (!latestVersion) {
          return;
        }

        const newVersionSpec = this.formatVersion(currentVersion, latestVersion, fileContext);

        if (newVersionSpec !== currentVersion) {
          deps[depName] = newVersionSpec;
          totalUpdated++;
          updates.push({
            type: depType,
            name: depName,
            from: currentVersion,
            to: newVersionSpec,
          });
        }
      });
    }

    if (updates.length > 0) {
      for (const u of updates) {
        console.log(
          `   • \x1b[33m${u.name}\x1b[0m: \x1b[90m${u.from}\x1b[0m -> \x1b[32m${u.to}\x1b[0m \x1b[90m(${u.type})\x1b[0m`
        );
      }

      if (!this.isDryRun) {
        const endsWithNewline = rawContent.endsWith('\n');
        const formattedJson = JSON.stringify(pkgData, null, 2) + (endsWithNewline ? '\n' : '');
        fs.writeFileSync(filePath, formattedJson, 'utf8');
        console.log(`   Updated \x1b[32m${totalUpdated}\x1b[0m dependencies in ${relativePath}`);
      } else {
        console.log(`   [DRY RUN] Would update \x1b[33m${totalUpdated}\x1b[0m dependencies`);
      }
    } else {
      console.log(`   ✓ All dependencies are up to date or excluded`);
    }

    return { filePath, relativePath, updated: totalUpdated, updates };
  }

  async run(inputPaths = []) {
    if (!this._skipConfig && !this._userOptions._preloadedConfig) {
      const { config: asyncConfig } = await loadConfig(this.cwd);
      if (asyncConfig) {
        if (this._userOptions.prefix === undefined && asyncConfig.prefix !== undefined) {
          this.prefix = asyncConfig.prefix;
        }
        if (this._userOptions.preservePrefix === undefined && asyncConfig.preservePrefix !== undefined) {
          this.preservePrefix = asyncConfig.preservePrefix;
        }
        if (this._userOptions.concurrency === undefined && asyncConfig.concurrency !== undefined) {
          this.concurrency = asyncConfig.concurrency;
        }
        if (this._userOptions.timeoutMs === undefined && asyncConfig.timeoutMs !== undefined) {
          this.timeoutMs = asyncConfig.timeoutMs;
        }
        if (this._userOptions.dryRun === undefined && asyncConfig.dryRun !== undefined) {
          this.isDryRun = asyncConfig.dryRun;
        }
        if (this._userOptions.exclude === undefined && asyncConfig.exclude !== undefined) {
          this.customExclusions = new Set(
            asyncConfig.exclude.map((p) => String(p).trim().toLowerCase()).filter(Boolean)
          );
        }
        if (this._userOptions.target === undefined && asyncConfig.target !== undefined) {
          this.targets = new Set(
            asyncConfig.target.map((p) => String(p).trim().toLowerCase()).filter(Boolean)
          );
        }
        if (this._userOptions.paths === undefined && asyncConfig.paths !== undefined) {
          this.defaultPaths = asyncConfig.paths;
        }
        if (this._userOptions.workspaces === undefined && asyncConfig.workspaces !== undefined) {
          this.workspaces = asyncConfig.workspaces;
        }
      }
    }

    const pathsToUse = inputPaths && inputPaths.length > 0 ? inputPaths : this.defaultPaths;
    const targetFiles = this.resolveTargetFiles(pathsToUse);

    if (this.isDryRun) {
      console.log('   \x1b[33m[DRY RUN: no files will be modified]\x1b[0m');
    }
    console.log(`   \x1b[90mExcluded:\x1b[0m ${[...this.customExclusions].join(', ') || 'none'}`);
    console.log(`   \x1b[90mTarget:\x1b[0m ${this.targets.size > 0 ? [...this.targets].join(', ') : 'all packages'}`);
    console.log(`   \x1b[90mPrefix:\x1b[0m ${this.preservePrefix ? 'preserve existing' : this.prefix === '' ? 'exact (pinned)' : `"${this.prefix}"`}`);
    console.log(`   \x1b[90mTargets (${targetFiles.length}):\x1b[0m`);
    for (const file of targetFiles) {
      console.log(`     \x1b[90m•\x1b[0m ${path.relative(this.cwd, file)}`);
    }
    console.log('');

    const results = [];
    for (const file of targetFiles) {
      const res = await this.processFile(file);
      results.push(res);
    }

    const totalUpdated = results.reduce((acc, r) => acc + (r.updated || 0), 0);

    console.log(`\n🎉 Finished! Total dependencies updated: \x1b[32m${totalUpdated}\x1b[0m\n`);

    return { results, totalUpdated };
  }
}
