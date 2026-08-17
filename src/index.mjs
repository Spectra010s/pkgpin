import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

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

export class PkgpinRunner {
  constructor(options = {}) {
    this.cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
    this.isDryRun = Boolean(options.dryRun);
    this.prefix = options.prefix ?? ''; // default: exact pinned (no ^ or ~)
    this.preservePrefix = Boolean(options.preservePrefix);
    this.concurrency = options.concurrency || 8;
    this.timeoutMs = options.timeoutMs || 6000;
    this.customExclusions = new Set(
      (options.exclude || []).map((p) => p.trim().toLowerCase()).filter(Boolean)
    );
    this.versionCache = new Map();
  }

  /**
   * Check if a package should be excluded from update
   */
  shouldSkip(pkgName, currentVersion) {
    if (this.customExclusions.has(pkgName.toLowerCase())) {
      return { skip: true, reason: 'excluded' };
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
  formatVersion(oldVersionSpec, latestVersion) {
    if (!latestVersion) return oldVersionSpec;
    if (oldVersionSpec === '*' || oldVersionSpec === 'latest') return oldVersionSpec;

    if (this.preservePrefix) {
      const match = oldVersionSpec.match(/^([\^~>=<!]*\s*)/);
      const existingPrefix = match ? match[1] : '';
      return `${existingPrefix}${latestVersion}`;
    }

    return `${this.prefix}${latestVersion}`;
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

    const depTypes = ['dependencies', 'devDependencies'];
    let totalUpdated = 0;
    const updates = [];

    for (const depType of depTypes) {
      const deps = pkgData[depType];
      if (!deps || typeof deps !== 'object') continue;

      const depNames = Object.keys(deps);

      await this.mapConcurrent(depNames, this.concurrency, async (depName) => {
        const currentVersion = deps[depName];
        const skipCheck = this.shouldSkip(depName, currentVersion);

        if (skipCheck.skip) {
          return;
        }

        const latestVersion = await this.getLatestVersion(depName);
        if (!latestVersion) {
          return;
        }

        const newVersionSpec = this.formatVersion(currentVersion, latestVersion);

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

  /**
   * Run update on all targets
   */
  async run(inputPaths = []) {
    const targetFiles = this.resolveTargetFiles(inputPaths);

    if (this.isDryRun) {
      console.log('   \x1b[33m[DRY RUN: no files will be modified]\x1b[0m');
    }
    console.log(`   \x1b[90mExcluded:\x1b[0m ${[...this.customExclusions].join(', ') || 'none'}`);
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
