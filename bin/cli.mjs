#!/usr/bin/env node

/**
 * pkgpin — Pin, update, and configure newer versions of your dependencies in your workspace package.json.
 * Version: 0.2.0
 */

import { PkgpinRunner, loadConfig } from '../src/index.mjs';

function printHelp() {
  console.log(`
Pin, update, and configure newer versions of your dependencies in your workspace package.json.

Usage:
  npx pkgpin [paths...] [options]
  pkgpin [paths...] [options]

Examples:
  pkgpin                              # Auto-discovers and pins all workspaces
  pkgpin apps/web apps/api            # Target specific workspace folders
  pkgpin package.json --dry-run       # Dry run preview on root package.json
  pkgpin --exclude=react,react-dom    # Custom exclusions
  pkgpin --target=react               # Update only the specified packages
  pkgpin --prefix=^                   # Update to latest with caret prefix

Options:
  -d, --dry-run             Preview changes without modifying package.json files
  -e, --exclude <pkgs>      Comma-separated list of packages to skip (e.g. typescript,eslint)
  -t, --target <pkgs>       Only update these packages (e.g. react,react-dom)
  -p, --prefix <prefix>     Set version prefix: "" (pinned/exact, default), "^", "~"
      --preserve-prefix     Keep whatever prefix (^ or ~) each dependency currently has
  -c, --concurrency <n>     Parallel requests limit (default: 8)
  -h, --help                Show this help message
  -v, --version             Show CLI version
`);
}

async function main() {
  const argv = process.argv.slice(2);

  if (argv.includes('-h') || argv.includes('--help')) {
    printHelp();
    process.exit(0);
  }

  if (argv.includes('-v') || argv.includes('--version')) {
    console.log('pkgpin v0.2.0');
    process.exit(0);
  }

  const hasDryRun = argv.includes('-d') || argv.includes('--dry-run');
  const hasPreservePrefix = argv.includes('--preserve-prefix');

  // Parse --exclude or -e
  // Split on commas and/or whitespace: PowerShell shims join comma lists
  // into a single space-separated string, so handle both forms.
  let hasExclude = false;
  let excludeList = [];
  const parseExcludes = (raw) => raw.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--exclude=')) {
      hasExclude = true;
      const custom = parseExcludes(arg.slice(10));
      excludeList = [...new Set([...excludeList, ...custom])];
    } else if (arg === '-e' || arg === '--exclude') {
      hasExclude = true;
      if (argv[i + 1] && !argv[i + 1].startsWith('-')) {
        const custom = parseExcludes(argv[i + 1]);
        excludeList = [...new Set([...excludeList, ...custom])];
        i++;
      }
    }
  }

  // Parse --target or -t: only update these packages (empty = all)
  let hasTarget = false;
  let targetList = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--target=')) {
      hasTarget = true;
      const custom = parseExcludes(arg.slice(9));
      targetList = [...new Set([...targetList, ...custom])];
    } else if (arg === '-t' || arg === '--target') {
      hasTarget = true;
      if (argv[i + 1] && !argv[i + 1].startsWith('-')) {
        const custom = parseExcludes(argv[i + 1]);
        targetList = [...new Set([...targetList, ...custom])];
        i++;
      }
    }
  }

  // Parse custom prefix
  let hasPrefix = false;
  let prefix;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--prefix=')) {
      hasPrefix = true;
      prefix = arg.slice(9);
    } else if (arg === '-p' || arg === '--prefix') {
      hasPrefix = true;
      if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('-')) {
        prefix = argv[i + 1];
        i++;
      } else {
        prefix = '';
      }
    }
  }

  // Parse concurrency
  let hasConcurrency = false;
  let concurrency;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--concurrency=')) {
      hasConcurrency = true;
      concurrency = parseInt(arg.slice(14), 10) || 8;
    } else if (arg === '-c' || arg === '--concurrency') {
      hasConcurrency = true;
      if (argv[i + 1] && !argv[i + 1].startsWith('-')) {
        concurrency = parseInt(argv[i + 1], 10) || 8;
        i++;
      }
    }
  }

  // Filter positional path arguments
  const pathArgs = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('-')) {
      if (arg === '-e' || arg === '--exclude' || arg === '-t' || arg === '--target' || arg === '-p' || arg === '--prefix' || arg === '-c' || arg === '--concurrency') {
        i++; // skip next arg as it was a value
      }
      continue;
    }
    pathArgs.push(arg);
  }

  const { config: fileConfig } = await loadConfig(process.cwd());

  const runnerOptions = {
    _preloadedConfig: fileConfig,
  };
  if (hasDryRun) runnerOptions.dryRun = true;
  if (hasPreservePrefix) runnerOptions.preservePrefix = true;
  if (hasExclude) runnerOptions.exclude = excludeList;
  if (hasTarget) runnerOptions.target = targetList;
  if (hasPrefix) runnerOptions.prefix = prefix;
  if (hasConcurrency) runnerOptions.concurrency = concurrency;

  const runner = new PkgpinRunner(runnerOptions);

  await runner.run(pathArgs.length > 0 ? pathArgs : undefined);
}

main().catch((err) => {
  console.error('\n❌ Fatal error in pkgpin:', err.message || err);
  process.exit(1);
});
