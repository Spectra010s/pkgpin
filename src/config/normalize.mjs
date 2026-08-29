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
export function normalizeList(val) {
  if (Array.isArray(val)) {
    return val.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof val === 'string') {
    return val.split(/[,\s]+/).map((v) => v.trim()).filter(Boolean);
  }
  return [];
}

/**
 * Normalizes and validates configuration object properties.
 * Strips $schema and non-config fields.
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
 * @param {Record<string, any>} [rawConfig={}] - Raw parsed configuration object
 * @returns {Record<string, any>} Sanitized configuration object
 */
export function normalizeConfig(rawConfig = {}) {
  const config = {};
  if (!rawConfig || typeof rawConfig !== 'object') return config;

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
