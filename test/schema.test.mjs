import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('JSON Schema (schema.json)', () => {
  const schemaPath = path.resolve('schema.json');
  const pkgJsonPath = path.resolve('package.json');

  it('should exist in repository root and be valid JSON', () => {
    assert.ok(fs.existsSync(schemaPath), 'schema.json should exist in root');
    const raw = fs.readFileSync(schemaPath, 'utf8');
    const schema = JSON.parse(raw);
    assert.equal(schema.$schema, 'http://json-schema.org/draft-07/schema#');
    assert.equal(schema.type, 'object');
  });

  it('should be included in package.json "files" array', () => {
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    assert.ok(Array.isArray(pkg.files), 'package.json should have files array');
    assert.ok(pkg.files.includes('schema.json'), 'package.json files should include schema.json');
  });

  it('should define all top-level configuration properties with correct types and constraints', () => {
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    const props = schema.properties;

    // $schema
    assert.equal(props.$schema.type, 'string');

    // prefix
    assert.equal(props.prefix.type, 'string');
    assert.deepEqual(props.prefix.enum, ['', '^', '~']);

    // preservePrefix
    assert.equal(props.preservePrefix.type, 'boolean');

    // exclude
    assert.equal(props.exclude.type, 'array');
    assert.equal(props.exclude.items.type, 'string');

    // target
    assert.equal(props.target.type, 'array');
    assert.equal(props.target.items.type, 'string');

    // concurrency
    assert.equal(props.concurrency.type, 'integer');
    assert.equal(props.concurrency.minimum, 1);

    // timeoutMs
    assert.equal(props.timeoutMs.type, 'integer');
    assert.equal(props.timeoutMs.minimum, 1);

    // dryRun
    assert.equal(props.dryRun.type, 'boolean');

    // paths
    assert.equal(props.paths.type, 'array');
    assert.equal(props.paths.items.type, 'string');

    // workspaces
    assert.equal(props.workspaces.type, 'object');
    assert.equal(schema.additionalProperties, false);
  });

  it('should define workspace override properties matching root capabilities', () => {
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    const wsItem = schema.properties.workspaces.additionalProperties;

    assert.equal(wsItem.type, 'object');
    assert.equal(wsItem.properties.prefix.type, 'string');
    assert.deepEqual(wsItem.properties.prefix.enum, ['', '^', '~']);
    assert.equal(wsItem.properties.preservePrefix.type, 'boolean');
    assert.equal(wsItem.properties.exclude.type, 'array');
    assert.equal(wsItem.properties.target.type, 'array');
    assert.equal(wsItem.properties.concurrency.type, 'integer');
    assert.equal(wsItem.additionalProperties, false);
  });
});
