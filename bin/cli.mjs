#!/usr/bin/env node

/**
 * pkgpin — Pin, update, and configure newer versions of your dependencies in your workspace package.json.
 * Version: 0.1.0
 */

import { PkgpinRunner } from '../src/index.mjs';

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
  pkgpin --prefix=^                   # Update to latest with caret prefix

Options:
  -d, --dry-run             Preview changes without modifying package.json files
  -e, --exclude <pkgs>      Comma-separated list of packages to skip (e.g. typescript,eslint)
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
    console.log('pkgpin v0.1.0');
    process.exit(0);
  }

  const isDryRun = argv.includes('-d') || argv.includes('--dry-run');
  const preservePrefix = argv.includes('--preserve-prefix');

  // Default exclusions (none by default)
  let excludeList = [];

  // Parse --exclude or -e
  // Split on commas and/or whitespace: PowerShell shims join comma lists
  // into a single space-separated string, so handle both forms.
  const parseExcludes = (raw) => raw.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--exclude=')) {
      const custom = parseExcludes(arg.slice(10));
      excludeList = [...new Set([...excludeList, ...custom])];
    } else if (arg === '-e' || arg === '--exclude') {
      if (argv[i + 1] && !argv[i + 1].startsWith('-')) {
        const custom = parseExcludes(argv[i + 1]);
        excludeList = [...new Set([...excludeList, ...custom])];
        i++;
      }
    }
  }

  // Parse custom prefix
  let prefix = ''; // default pinned exact
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--prefix=')) {
      prefix = arg.slice(9);
    } else if (arg === '-p' || arg === '--prefix') {
      if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('-')) {
        prefix = argv[i + 1];
        i++;
      }
    }
  }

  // Parse concurrency
  let concurrency = 8;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--concurrency=')) {
      concurrency = parseInt(arg.slice(14), 10) || 8;
    } else if (arg === '-c' || arg === '--concurrency') {
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
      if (arg === '-e' || arg === '--exclude' || arg === '-p' || arg === '--prefix' || arg === '-c' || arg === '--concurrency') {
        i++; // skip next arg as it was a value
      }
      continue;
    }
    pathArgs.push(arg);
  }

  const runner = new PkgpinRunner({
    dryRun: isDryRun,
    exclude: excludeList,
    prefix,
    preservePrefix,
    concurrency,
  });

  await runner.run(pathArgs);
}

main().catch((err) => {
  console.error('\n❌ Fatal error in pkgpin:', err.message || err);
  process.exit(1);
});
