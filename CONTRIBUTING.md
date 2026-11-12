# Contributing to pkgpin

Thanks for your interest in improving `pkgpin`! This guide covers local setup, the test suite, and the commit conventions used in this repository.

## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) `>=18.0.0`
- npm (or pnpm / yarn / bun)
- Git

### Getting started

1. Fork the repository and clone your fork:

   ```bash
   git clone https://github.com/<your-username>/pkgpin.git
   cd pkgpin
   ```

2. Install dependencies (including the commit helper):

   ```bash
   npm install
   ```

3. Create a branch for your change:

   ```bash
   git checkout -b my-feature
   ```

## Testing

Run the full test suite with Node's built-in test runner:

```bash
npm test
```

Please make sure the suite passes before opening a pull request, and add tests for any new behavior.

You can also exercise the CLI locally:

```bash
# Preview changes in the current repository
node bin/cli.mjs --dry-run

# Show available options
node bin/cli.mjs --help
```

## Commit Conventions

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>(<scope>): <description>
```

- **type** — the kind of change (see the table below).
- **scope** — optional; the package, module, or feature area that changed.
- **description** — a short, imperative summary without trailing punctuation.

Keep the subject line under 72 characters. Add a body with bullet points only when the change needs extra context.

### Commit types

| Type | Purpose |
| --- | --- |
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation-only changes |
| `test` | Adding or updating tests |
| `refactor` | Code changes that neither fix a bug nor add a feature |
| `perf` | Performance improvements |
| `chore` | Maintenance, tooling, or dependency updates |
| `ci` | CI configuration changes |
| `build` | Build system or packaging changes |

### Examples

```text
feat(cli): add --config flag for custom configuration files
fix(config): handle missing $schema field in JSON configs
docs: add contribution guide and commit workflow
test(runner): cover workspace override glob matching
```

## Using `git-aic` for Commit Messages

The repository includes [`git-aic`](https://www.npmjs.com/package/git-aic) as a dev dependency to help generate Conventional Commit messages. Its instructions live in [`git-aic.config.json`](./git-aic.config.json), so no extra setup is required.

See the [git-aic documentation](https://git-aic.pages.dev/docs) for setup, provider configuration, and CLI options.

Stage your changes, then run:

```bash
npm run commit
```

`git-aic` reads the staged diff and proposes a commit message that follows the format above. Review it, edit it if necessary, and confirm.

You can also use the tool directly:

```bash
npx git-aic
```

> **Note:** `git-aic` needs a configured AI provider/API key. If you prefer not to use it, writing a Conventional Commit message manually is perfectly fine — the resulting message is what matters.

## Pull Requests

1. Keep changes focused and scoped to a single concern.
2. Update the README or schema when behavior or configuration changes.
3. Make sure `npm test` passes.
4. Use a clear PR title that follows the Conventional Commits format.
5. Describe what changed and why, and link the related issue when applicable.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](./LICENSE).
