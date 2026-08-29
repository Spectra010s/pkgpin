/**
 * List of dynamic JavaScript / ESM configuration files in order of discovery precedence.
 */
export const JS_CONFIG_FILES = [
  'pkgpin.config.js',
  'pkgpin.config.mjs',
  'pkgpin.config.cjs',
  '.pkgpinrc.js',
  '.pkgpinrc.mjs',
  '.pkgpinrc.cjs',
];

/**
 * List of static JSON configuration files in order of discovery precedence.
 */
export const JSON_CONFIG_FILES = [
  'pkgpin.config.json',
  '.pkgpinrc.json',
  '.pkgpinrc',
];
