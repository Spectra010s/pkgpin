import fs from 'node:fs';
import path from 'node:path';

/**
 * List of static JSON configuration files in order of discovery precedence.
 * pkgpin.config.json takes precedence over .pkgpinrc.json and .pkgpinrc.
 */
const JSON_CONFIG_FILES = [
  'pkgpin.config.json',
  '.pkgpinrc.json',
  '.pkgpinrc',
];

/**
 * Normalizes input list that can be passed as an array or a comma/space-separated string.
 * Examples:
 *   - ['react', 'react-dom'] -> ['react', 'react-dom']
 *   - 'react, react-dom'     -> ['react', 'react-dom']
 *   - 'react react-dom'       -> ['react', 'react-dom']
 *
 * @param {string[]|string|unknown} val - Raw list value from config or CLI
 * @returns {string[]} Cleaned array of non-empty strings
 */
function normalizeList(val) {
  if (Array.isArray(val)) {
    return val.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof val === 'string') {
    return val.split(/[,\s]+/).map((v) => v.trim()).filter(Boolean);
  }
  return [];
}

/**
 * Searches for and reads JSON configuration in the target directory.
 *
 * Discovery & Precedence Order:
 * 1. `pkgpin.config.json`
 * 2. `.pkgpinrc.json`
 * 3. `.pkgpinrc` (parsed as JSON)
 * 4. `package.json` under `"pkgpin"` field
 *
 * @param {string} [dir=process.cwd()] - Directory to search in
 * @returns {{ config: Record<string, any>, filepath: string | null }} Loaded configuration object and file path
 * @throws {Error} If a configuration file exists but contains malformed JSON
 */
export function loadConfig(dir = process.cwd()) {
  const searchDir = path.resolve(dir);

  // 1. Check for standalone JSON config files
  for (const filename of JSON_CONFIG_FILES) {
    const fullPath = path.join(searchDir, filename);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      try {
        const raw = fs.readFileSync(fullPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          throw new Error('Configuration must be a JSON object');
        }
        return {
          config: normalizeConfig(parsed),
          filepath: fullPath,
        };
      } catch (err) {
        throw new Error(`Failed to parse configuration file "${fullPath}": ${err.message}`);
      }
    }
  }

  // 2. Check root package.json for "pkgpin" property
  const pkgJsonPath = path.join(searchDir, 'package.json');
  if (fs.existsSync(pkgJsonPath) && fs.statSync(pkgJsonPath).isFile()) {
    try {
      const raw = fs.readFileSync(pkgJsonPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.pkgpin === 'object' && parsed.pkgpin !== null && !Array.isArray(parsed.pkgpin)) {
        return {
          config: normalizeConfig(parsed.pkgpin),
          filepath: pkgJsonPath,
        };
      }
    } catch (err) {
      // If root package.json is invalid JSON, throw error so user is aware
      throw new Error(`Failed to parse "${pkgJsonPath}": ${err.message}`);
    }
  }

  // 3. No config file found; return empty config
  return {
    config: {},
    filepath: null,
  };
}

/**
 * Normalizes and validates configuration object properties.
 *
 * Supported properties:
 * - `prefix` (string): Version prefix ("" for exact, "^", "~")
 * - `preservePrefix` (boolean): Whether to retain dependency's current prefix
 * - `exclude` (string[]|string): Packages to skip during updates
 * - `target` (string[]|string): Packages to exclusively update
 * - `paths` (string[]|string): Default workspace paths/patterns to target
 * - `concurrency` (number): Max parallel HTTP requests
 * - `dryRun` (boolean): Preview updates without writing to disk
 * - `timeoutMs` (number): Registry lookup request timeout in milliseconds
 *
 * @param {Record<string, any>} [rawConfig={}] - Raw parsed JSON object
 * @returns {Record<string, any>} Sanitized configuration object
 */
export function normalizeConfig(rawConfig = {}) {
  const config = {};

  // Version prefix (e.g. "", "^", "~")
  if (rawConfig.prefix !== undefined) {
    config.prefix = String(rawConfig.prefix);
  }

  // Preserve existing prefix on each dependency
  if (rawConfig.preservePrefix !== undefined) {
    config.preservePrefix = Boolean(rawConfig.preservePrefix);
  }

  // Packages to skip
  if (rawConfig.exclude !== undefined) {
    config.exclude = normalizeList(rawConfig.exclude);
  }

  // Only update these packages
  if (rawConfig.target !== undefined) {
    config.target = normalizeList(rawConfig.target);
  }

  // Target paths / workspaces
  if (rawConfig.paths !== undefined) {
    config.paths = normalizeList(rawConfig.paths);
  }

  // Concurrency limit for registry requests
  if (rawConfig.concurrency !== undefined) {
    const parsed = parseInt(rawConfig.concurrency, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      config.concurrency = parsed;
    }
  }

  // Dry run mode
  if (rawConfig.dryRun !== undefined) {
    config.dryRun = Boolean(rawConfig.dryRun);
  }

  // Registry HTTP timeout in milliseconds
  if (rawConfig.timeoutMs !== undefined) {
    const parsed = parseInt(rawConfig.timeoutMs, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      config.timeoutMs = parsed;
    }
  }

  return config;
}
