import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { normalizeConfig } from './normalize.mjs';

/**
 * Detects module system mismatches (CommonJS vs ESM) and returns a friendly explanation.
 * Modeled after npm-check-updates' getModuleMismatchError.
 *
 * @param {string} errorMessage
 * @param {string} filename
 * @returns {string|null}
 */
export function getModuleMismatchError(errorMessage, filename) {
  const basename = path.basename(filename);

  const isCjsInEsm =
    errorMessage.includes('__filename is not defined') ||
    errorMessage.includes('__dirname is not defined') ||
    errorMessage.includes('require is not defined') ||
    errorMessage.includes('module is not defined') ||
    errorMessage.includes('exports is not defined');

  const isEsmInCjs =
    errorMessage.includes('Cannot use import statement outside a module') ||
    errorMessage.includes("Unexpected token 'export'") ||
    errorMessage.includes("Unexpected token 'import'") ||
    errorMessage.includes('SyntaxError: export ') ||
    (errorMessage.includes('SyntaxError') && errorMessage.includes('import'));

  const isJsFile = filename.endsWith('.js');

  if (isCjsInEsm && isJsFile) {
    return (
      `${basename} uses CommonJS syntax (require/module.exports) in an ES Module project.\n\n` +
      `Fix:\n` +
      `  • Convert to ESM (export default { ... })\n` +
      `  • Or rename to ${basename.replace(/\.js$/, '.cjs')}`
    );
  }

  if (isEsmInCjs && isJsFile) {
    return (
      `${basename} uses ESM syntax (import/export) in a CommonJS project.\n\n` +
      `Fix:\n` +
      `  • Add "type": "module" to your package.json\n` +
      `  • Or rename to ${basename.replace(/\.js$/, '.mjs')}`
    );
  }

  return null;
}

/**
 * Loads and evaluates a JavaScript / ESM configuration file.
 *
 * @param {string} fullPath - Absolute path to the JS/ESM config file
 * @returns {Promise<Record<string, any>>}
 */
export async function loadJsConfig(fullPath) {
  try {
    const fileUrl = pathToFileURL(fullPath).href;
    const imported = await import(fileUrl);
    let rawConfig = imported.default !== undefined ? imported.default : imported;

    if (typeof rawConfig === 'function') {
      rawConfig = await rawConfig();
    }

    if (typeof rawConfig !== 'object' || rawConfig === null || Array.isArray(rawConfig)) {
      throw new Error('Configuration must export an object or a function returning an object');
    }

    // Strip $schema if present
    const { $schema: _, ...cleanConfig } = rawConfig;
    return normalizeConfig(cleanConfig);
  } catch (err) {
    const mismatch = getModuleMismatchError(err.message || '', fullPath);
    if (mismatch) {
      throw new Error(`Failed to load configuration file "${fullPath}":\n${mismatch}`);
    }
    throw new Error(`Failed to load configuration file "${fullPath}": ${err.message}`);
  }
}

/**
 * Loads and parses a static JSON configuration file.
 *
 * @param {string} fullPath - Absolute path to the JSON config file
 * @returns {Record<string, any>}
 */
export function loadJsonConfig(fullPath) {
  try {
    const raw = fs.readFileSync(fullPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('Configuration must be a JSON object');
    }
    const { $schema: _, ...cleanConfig } = parsed;
    return normalizeConfig(cleanConfig);
  } catch (err) {
    throw new Error(`Failed to parse configuration file "${fullPath}": ${err.message}`);
  }
}

/**
 * Reads "pkgpin" field from package.json.
 *
 * @param {string} pkgJsonPath - Absolute path to package.json
 * @returns {Record<string, any>|null}
 */
export function loadPackageJsonConfig(pkgJsonPath) {
  try {
    const raw = fs.readFileSync(pkgJsonPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.pkgpin === 'object' && parsed.pkgpin !== null && !Array.isArray(parsed.pkgpin)) {
      const { $schema: _, ...cleanConfig } = parsed.pkgpin;
      return normalizeConfig(cleanConfig);
    }
    return null;
  } catch (err) {
    throw new Error(`Failed to parse "${pkgJsonPath}": ${err.message}`);
  }
}
