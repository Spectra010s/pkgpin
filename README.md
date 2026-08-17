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

---

## Features

- **Zero-Install:** Bump versions in your `package.json` without running `npm install`.
- **Pin Exact Versions:** Strips `^` and `~` to prevent phantom CI breakage from unexpected minor/patch releases.
- **Fast HTTP Lookups:** Direct parallel HTTP requests to the npm registry with global in-memory caching.
- **Skip Packages:** Exclude any packages with `--exclude` (plus local monorepo protocols like `workspace:*`, `file:`, `link:` are always skipped).
- **Targeted Updates:** Update only the packages you want with `--target`.
- **Auto Discovery:** Seamlessly detects all workspace `package.json` files or lets you target specific paths.
- **Dry Run Mode:** Preview updates before writing a single byte to disk.

---

## Usage Examples

```bash
# 1. Update everything in the repo (auto-discover)
npx pkgpin

# 2. Target specific workspace directories or files
npx pkgpin apps/web apps/api

# 3. Dry run preview on root package.json
npx pkgpin package.json --dry-run

# 4. Skip specific packages
npx pkgpin --exclude=react,react-dom
# space-separated is also accepted:
npx pkgpin --exclude "react react-dom"
# or the short form:
npx pkgpin -e react,react-dom

# 5. Update only specific packages
npx pkgpin --target=react,react-dom
# or the short form:
npx pkgpin -t react react-dom

# 6. Keep caret (^) or tilde (~) prefixes if desired
npx pkgpin --preserve-prefix
# or force caret:
npx pkgpin --prefix=^
```

---

## CLI Options

| Flag | Description | Default |
|---|---|---|
| `-d, --dry-run` | Preview changes without modifying files | `false` |
| `-e, --exclude <list>` | Packages to skip; accepts comma-separated (`react,react-dom`), space-separated, or `=` form (`--exclude=react,react-dom`) | none |
| `-t, --target <list>` | Only update these packages; accepts the same forms as `--exclude` | all packages |
| `-p, --prefix <str>` | Version prefix to use (e.g. `""`, `"^"`, `"~"`) | `""` (pinned exact) |
| `--preserve-prefix` | Keep whatever prefix each dependency currently has | `false` |
| `-c, --concurrency <n>` | Max parallel registry requests | `8` |
| `-h, --help` | Display help screen | |
| `-v, --version` | Display CLI version | |

---

## Programmatic API

You can also use `pkgpin` directly in Node.js scripts:

```javascript
import { PkgpinRunner } from 'pkgpin';

const runner = new PkgpinRunner({
  dryRun: false,
  exclude: ['typescript', 'eslint'],
  prefix: '', // exact pinned
});

await runner.run(['apps/web', 'apps/api']);
```

---

## License

Released under the [MIT License](LICENSE).

---

## Author

Maintained by [Adeloye Adetayo](https://spectra010s.biuld.app) — GitHub: [@Spectra010s](https://github.com/Spectra010s)

