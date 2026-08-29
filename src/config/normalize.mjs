/**
 * Parses and strictly validates that an input is a positive integer (>= 1).
 * Rejects floats ("1.5"), strings with trailing characters ("8abc", "100ms"), negative numbers, and 0.
 *
 * @param {unknown} val - Raw input to validate
 * @returns {number|null} Validated positive integer or null if invalid
 */
export function parsePositiveInteger(val) {
  if (typeof val === 'number') {
    return Number.isInteger(val) && val >= 1 ? val : null;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^[1-9]\d*$/.test(trimmed)) {
      return parseInt(trimmed, 10);
    }
  }
  return null;
}

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
 * - `concurrency` (number): Max parallel HTTP requests (must be >= 1)
 * - `dryRun` (boolean): Preview updates without writing to disk
 * - `timeoutMs` (number): Registry lookup request timeout in milliseconds (must be >= 1)
 * - `workspaces` (Record<string, object>): Per-workspace override configurations
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

  // Concurrency limit for registry requests.
  // Validate entire integer string/number to reject floats (1.5) or strings with trailing characters (8abc).
  if (rawConfig.concurrency !== undefined) {
    const parsed = parsePositiveInteger(rawConfig.concurrency);
    if (parsed === null) {
      throw new Error(`Invalid concurrency value: "${rawConfig.concurrency}". Must be a positive integer.`);
    }
    config.concurrency = parsed;
  }

  // Dry run mode
  if (rawConfig.dryRun !== undefined) {
    config.dryRun = Boolean(rawConfig.dryRun);
  }

  // Registry HTTP timeout in milliseconds.
  // Validate entire integer string/number to reject floats or strings with trailing characters.
  if (rawConfig.timeoutMs !== undefined) {
    const parsed = parsePositiveInteger(rawConfig.timeoutMs);
    if (parsed === null) {
      throw new Error(`Invalid timeoutMs value: "${rawConfig.timeoutMs}". Must be a positive integer.`);
    }
    config.timeoutMs = parsed;
  }

  // Recursively sanitize per-workspace configuration overrides (keyed by directory path, glob pattern, or package name)
  if (rawConfig.workspaces && typeof rawConfig.workspaces === 'object' && !Array.isArray(rawConfig.workspaces)) {
    config.workspaces = {};
    for (const [wsKey, wsVal] of Object.entries(rawConfig.workspaces)) {
      if (wsVal && typeof wsVal === 'object' && !Array.isArray(wsVal)) {
        config.workspaces[wsKey] = normalizeConfig(wsVal);
      }
    }
  }

  return config;
}
