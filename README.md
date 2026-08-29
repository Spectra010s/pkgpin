# 📌 pkgpin

> **Pin, update, and configure newer versions of your dependencies in your workspace package.json.**

Dependabot is great for ongoing one-by-one maintenance PRs, but setting a baseline across multiple workspaces with loose `^` carets is tedious. `pkgpin` does a single, unified sweep in seconds: fetches latest stable versions from the npm registry, pins them down with zero loose prefixes, and skips whatever packages you tell it to with `--exclude`.

Run it on the spot with `npx pkgpin` — bump your dependency versions to the latest without running `npm install` to pull them in.

---

## Quick Start

You can run it instantly without installing:

```bash
# Preview changes across all workspaces in current repo:
npx pkgpin --dry-run

# Pin all dependencies to latest exact versions:
npx pkgpin
```

Or install it as a dev dependency:

```bash
npm install -D pkgpin
# or with pnpm / yarn / bun
pnpm add -D pkgpin
yarn add -D pkgpin
bun add -d pkgpin
```

---

## Features

- **Zero-Install:** Bump versions in your `package.json` without running `npm install`.
- **Pin Exact Versions:** Strips `^` and `~` to prevent phantom CI breakage from unexpected minor/patch releases.
- **Fast HTTP Lookups:** Direct parallel HTTP requests to the npm registry with global in-memory caching.
- **Skip Packages:** Exclude any packages with `--exclude` (local monorepo protocols like `workspace:*`, `file:`, `link:` are always skipped).
- **Targeted Updates:** Update only the packages you want with `--target`.
- **Auto Discovery:** Seamlessly detects all workspace `package.json` files or lets you target specific paths.
- **Configuration Files:** Supports `pkgpin.config.js`, `.mjs`, `.cjs`, `.json`, `.pkgpinrc`, and `package.json#pkgpin`.
- **Monorepo Workspace Overrides:** Configure custom rules per package, folder, or glob pattern.
- **JSON Schema:** IDE autocompletion and hover documentation out of the box.
- **Dry Run Mode:** Preview updates before writing a single byte to disk.
- **Zero Dependencies:** Pure Node.js with 0 third-party packages.

---

## Configuration Files

`pkgpin` automatically discovers configuration files in your repository using the following precedence order:

1. `pkgpin.config.js` / `.mjs` / `.cjs`
2. `.pkgpinrc.js` / `.mjs` / `.cjs`
3. `pkgpin.config.json`
4. `.pkgpinrc.json`
5. `.pkgpinrc` (JSON)
6. `"pkgpin"` field in `package.json`

### JavaScript / ESM Config (`pkgpin.config.js` or `pkgpin.config.mjs`)

Supports both static object exports and dynamic / asynchronous function exports:

```javascript
/** @type {import('pkgpin').Config} */
export default {
  prefix: '^',
  exclude: ['typescript', 'eslint'],
  concurrency: 12,
};
```

Or with dynamic functions:

```javascript
export default async () => {
  return {
    prefix: '~',
    target: ['react', 'react-dom'],
    dryRun: true,
  };
};
```

### JSON Config (`pkgpin.config.json` or `.pkgpinrc.json`)

Include `$schema` for instant autocompletion and validation in VS Code or WebStorm:

```json
{
  "$schema": "https://unpkg.com/pkgpin/schema.json",
  "prefix": "",
  "exclude": ["typescript", "eslint"],
  "concurrency": 8,
  "timeoutMs": 6000
}
```

### In `package.json`

```json
{
  "name": "my-project",
  "pkgpin": {
    "prefix": "^",
    "exclude": ["lodash"]
  }
}
```

---

## Monorepo Workspace Overrides

You can define granular rules for specific packages or folders in monorepos using the `workspaces` dictionary. Rules can match by **directory path**, **package name**, or **glob pattern**:

```javascript
// pkgpin.config.js
export default {
  prefix: '', // Default: pin exact versions across the repo
  exclude: ['eslint'],

  workspaces: {
    // Exact directory match
    'apps/web': {
      prefix: '^',
      exclude: ['next', 'react'],
    },

    // Package name match
    '@myrepo/api': {
      prefix: '~',
    },

    // Wildcard / Glob pattern match
    'packages/*': {
      prefix: '^',
    },
  },
};
```

**Resolution Precedence:**
`CLI Flags > Workspace Overrides > Root Config > Built-in Defaults`

---

## Usage Examples

```bash
# 1. Update everything in the repo (auto-discover)
npx pkgpin

# 2. Target specific workspace directories or files
npx pkgpin apps/web apps/api

# 3. Dry run preview on root package.json
npx pkgpin package.json --dry-run

# 4. Use a custom configuration file or directory
npx pkgpin --config configs/pkgpin.prod.json
npx pkgpin -C ./configs/

# 5. Skip specific packages
npx pkgpin --exclude=react,react-dom
# space-separated is also accepted:
npx pkgpin --exclude "react react-dom"
# or short form:
npx pkgpin -e react,react-dom

# 6. Update only specific packages
npx pkgpin --target=react,react-dom
# or short form:
npx pkgpin -t react,react-dom

# 7. Keep caret (^) or tilde (~) prefixes if desired
npx pkgpin --preserve-prefix
# or force caret:
npx pkgpin --prefix=^
```

---

## CLI Options

| Flag | Description | Default |
|---|---|---|
| `-C, --config <path>` | Path to a custom configuration file (`.js`, `.mjs`, `.cjs`, `.json`) or custom directory | auto-discover |
| `-d, --dry-run` | Preview changes without modifying files | `false` |
| `-e, --exclude <list>` | Packages to skip; accepts comma-separated (`react,react-dom`), space-separated, or `=` form (`--exclude=react,react-dom`) | none |
| `-t, --target <list>` | Only update these packages; accepts the same forms as `--exclude` | all packages |
| `-p, --prefix <str>` | Version prefix to use (e.g. `""`, `"^"`, `"~"`) | `""` (pinned exact) |
| `--preserve-prefix` | Keep whatever prefix each dependency currently has | `false` |
| `-c, --concurrency <n>` | Max parallel registry requests (positive integer) | `8` |
| `-h, --help` | Display help screen | |
| `-v, --version` | Display CLI version | |

---

## Programmatic API

You can also use `pkgpin` programmatically in Node.js:

```javascript
import { PkgpinRunner, loadConfig, loadConfigFile } from 'pkgpin';

// 1. Run programmatically
const runner = new PkgpinRunner({
  dryRun: false,
  exclude: ['typescript', 'eslint'],
  prefix: '', // exact pinned
});

await runner.run(['apps/web', 'apps/api']);

// 2. Load configuration explicitly
const { config, filepath } = await loadConfig(); // auto-discover
const { config: customConfig } = await loadConfigFile('./custom.config.js'); // explicit file/dir
```

---

## License

Released under the [MIT License](LICENSE).

---

## Author

Maintained by [Adeloye Adetayo](https://spectra010s.biuld.app) — GitHub: [@Spectra010s](https://github.com/Spectra010s)
