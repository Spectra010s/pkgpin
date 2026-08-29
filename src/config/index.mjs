import fs from 'node:fs';
import path from 'node:path';
import { JS_CONFIG_FILES, JSON_CONFIG_FILES } from './constants.mjs';
import {
  loadJsConfig,
  loadJsonConfig,
  loadPackageJsonConfig,
  getModuleMismatchError,
} from './loaders.mjs';
import { normalizeConfig, normalizeList } from './normalize.mjs';

export {
  JS_CONFIG_FILES,
  JSON_CONFIG_FILES,
  loadJsConfig,
  loadJsonConfig,
  loadPackageJsonConfig,
  getModuleMismatchError,
  normalizeConfig,
  normalizeList,
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
