#!/usr/bin/env node

/**
 * pkgpin — Pin, update, and configure newer versions of your dependencies in your workspace package.json.
 * Version: 0.3.0
 */

import fs from 'node:fs';
import { PkgpinRunner, loadConfig, loadConfigFile, parsePositiveInteger } from '../src/index.mjs';

function getCliVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

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
  -C, --config <path>       Use a specific configuration file instead of auto-discovery
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
    console.log(`pkgpin v${getCliVersion()}`);
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

  // Parse concurrency flag (-c, --concurrency). Must be a positive integer >= 1.
  let hasConcurrency = false;
  let concurrency;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--concurrency=')) {
      hasConcurrency = true;
      const rawVal = arg.slice(14);
      const parsed = parsePositiveInteger(rawVal);
      if (parsed === null) {
        console.error(`\x1b[31mError: Invalid concurrency value "${rawVal}". Must be a positive integer.\x1b[0m`);
        process.exit(1);
      }
      concurrency = parsed;
    } else if (arg === '-c' || arg === '--concurrency') {
      hasConcurrency = true;
      if (argv[i + 1] && !argv[i + 1].startsWith('-')) {
        const rawVal = argv[i + 1];
        const parsed = parsePositiveInteger(rawVal);
        if (parsed === null) {
          console.error(`\x1b[31mError: Invalid concurrency value "${rawVal}". Must be a positive integer.\x1b[0m`);
          process.exit(1);
        }
        concurrency = parsed;
        i++;
      } else {
        console.error('\x1b[31mError: Option --concurrency requires a positive integer argument.\x1b[0m');
        process.exit(1);
      }
    }
  }

  // Parse -C / --config: explicit path to a configuration file, bypassing auto-discovery
  let configPath = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--config=')) {
      configPath = arg.slice(9);
    } else if (arg === '-C' || arg === '--config') {
      if (argv[i + 1] && !argv[i + 1].startsWith('-')) {
        configPath = argv[i + 1];
        i++;
      } else {
        console.error('\x1b[31mError: Option --config requires a file path argument.\x1b[0m');
        process.exit(1);
      }
    }
  }

  // Filter positional path arguments (skip flags and their values)
  const pathArgs = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('-')) {
      if (arg === '-e' || arg === '--exclude' || arg === '-t' || arg === '--target' || arg === '-p' || arg === '--prefix' || arg === '-c' || arg === '--concurrency' || arg === '-C' || arg === '--config') {
        i++; // skip next arg as it was a value
      }
      continue;
    }
    pathArgs.push(arg);
  }

  // Load config: use explicit path if provided, otherwise auto-discover
  const { config: fileConfig } = configPath
    ? await loadConfigFile(configPath)
    : await loadConfig(process.cwd());

  const cliFlags = {};
  if (hasDryRun) cliFlags.dryRun = true;
  if (hasPreservePrefix) cliFlags.preservePrefix = true;
  if (hasExclude) cliFlags.exclude = excludeList;
  if (hasTarget) cliFlags.target = targetList;
  if (hasPrefix) cliFlags.prefix = prefix;
  if (hasConcurrency) cliFlags.concurrency = concurrency;

  const runnerOptions = {
    _preloadedConfig: fileConfig,
    _cliOptions: cliFlags,
    ...cliFlags,
  };

  const runner = new PkgpinRunner(runnerOptions);

  await runner.run(pathArgs.length > 0 ? pathArgs : undefined);
}

main().catch((err) => {
  console.error(`\n\x1b[31mError: Fatal error in pkgpin:\x1b[0m ${err.message || err}`);
  process.exit(1);
});
