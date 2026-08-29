import fs from 'node:fs';
import path from 'node:path';
import { JS_CONFIG_FILES, JSON_CONFIG_FILES } from './constants.mjs';
import {
  loadJsConfig,
  loadJsonConfig,
  loadPackageJsonConfig,
  getModuleMismatchError,
} from './loaders.mjs';
import { normalizeConfig, normalizeList, parsePositiveInteger } from './normalize.mjs';

export {
  JS_CONFIG_FILES,
  JSON_CONFIG_FILES,
  loadJsConfig,
  loadJsonConfig,
  loadPackageJsonConfig,
  getModuleMismatchError,
  normalizeConfig,
  normalizeList,
  parsePositiveInteger,
};

/**
 * Searches for and reads configuration (JS/ESM, JSON, or package.json) in the target directory.
 *
 * Discovery & Precedence Order:
 * 1. `pkgpin.config.js`
 * 2. `pkgpin.config.mjs`
 * 3. `pkgpin.config.cjs`
 * 4. `.pkgpinrc.js`
 * 5. `.pkgpinrc.mjs`
 * 6. `.pkgpinrc.cjs`
 * 7. `pkgpin.config.json`
 * 8. `.pkgpinrc.json`
 * 9. `.pkgpinrc` (parsed as JSON)
 * 10. `package.json` under `"pkgpin"` field
 *
 * @param {string} [dir=process.cwd()] - Directory to search in
 * @returns {Promise<{ config: Record<string, any>, filepath: string | null }>} Loaded configuration object and file path
 */
export async function loadConfig(dir = process.cwd()) {
  const searchDir = path.resolve(dir);

  // 1. Check for dynamic JS / ESM / CJS config files
  for (const filename of JS_CONFIG_FILES) {
    const fullPath = path.join(searchDir, filename);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      const config = await loadJsConfig(fullPath);
      return { config, filepath: fullPath };
    }
  }

  // 2. Check for standalone JSON config files
  for (const filename of JSON_CONFIG_FILES) {
    const fullPath = path.join(searchDir, filename);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      const config = loadJsonConfig(fullPath);
      return { config, filepath: fullPath };
    }
  }

  // 3. Check package.json for "pkgpin" field
  const pkgJsonPath = path.join(searchDir, 'package.json');
  if (fs.existsSync(pkgJsonPath) && fs.statSync(pkgJsonPath).isFile()) {
    const config = loadPackageJsonConfig(pkgJsonPath);
    if (config) {
      return { config, filepath: pkgJsonPath };
    }
  }

  return {
    config: {},
    filepath: null,
  };
}

/**
 * Loads a single, explicitly specified configuration file by path.
 * Dispatches to the correct loader based on file extension:
 *   .js / .mjs / .cjs  → loadJsConfig (async dynamic import)
 *   .json / no ext      → loadJsonConfig (synchronous JSON parse)
 *
 * Used by the -C / --config CLI flag so users can point to a non-standard
 * config file outside the normal discovery search.
 *
 * @param {string} filePath - Path to the config file (resolved against cwd)
 * @returns {Promise<{ config: Record<string, any>, filepath: string }>}
 */
export async function loadConfigFile(filePath) {
  const resolved = path.resolve(filePath);

  if (!fs.existsSync(resolved)) {
    throw new Error(`Configuration file not found: "${resolved}"`);
  }

  // If a directory was provided, search for standard config files within it
  if (fs.statSync(resolved).isDirectory()) {
    const result = await loadConfig(resolved);
    if (!result.filepath) {
      throw new Error(`No configuration file found in directory "${resolved}"`);
    }
    return result;
  }

  const ext = path.extname(resolved).toLowerCase();
  let config;

  if (ext === '.js' || ext === '.mjs' || ext === '.cjs') {
    config = await loadJsConfig(resolved);
  } else {
    // .json, .pkgpinrc (no ext), or any other extension: parse as JSON
    config = loadJsonConfig(resolved);
  }

  return { config, filepath: resolved };
}

/**
 * Synchronous loader for JSON config files and package.json.
 *
 * @param {string} [dir=process.cwd()] - Directory to search in
 * @returns {{ config: Record<string, any>, filepath: string | null }}
 */
export function loadConfigSync(dir = process.cwd()) {
  const searchDir = path.resolve(dir);

  for (const filename of JSON_CONFIG_FILES) {
    const fullPath = path.join(searchDir, filename);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      const config = loadJsonConfig(fullPath);
      return { config, filepath: fullPath };
    }
  }

  const pkgJsonPath = path.join(searchDir, 'package.json');
  if (fs.existsSync(pkgJsonPath) && fs.statSync(pkgJsonPath).isFile()) {
    const config = loadPackageJsonConfig(pkgJsonPath);
    if (config) {
      return { config, filepath: pkgJsonPath };
    }
  }

  return {
    config: {},
    filepath: null,
  };
}
