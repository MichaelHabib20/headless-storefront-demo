import Ajv from 'ajv';
import addFormats from 'ajv-formats';

/**
 * OpenAPI 3.0 schema → JSON Schema that Ajv understands. `isMap` marks a map of named schemas
 * (`properties`, the schemas list): its keys are names, not keywords — a property may be called
 * `example` (AuthSettings.phone.example) or `nullable` without being stripped.
 */
export function toJsonSchema(node, isMap = false) {
  if (Array.isArray(node)) return node.map((item) => toJsonSchema(item));
  if (!node || typeof node !== 'object') return node;
  if (isMap) return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, toJsonSchema(v)]));
  const { nullable, discriminator, example, ...rest } = node;
  const out = Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, toJsonSchema(v, k === 'properties')]));
  if (typeof out.$ref === 'string') out.$ref = out.$ref.replace('#/components/schemas/', 'openapi#/definitions/');
  return nullable ? { anyOf: [out, { type: 'null' }] } : out;
}

/** Returns (schemaName, data) => string[] of violations (empty = valid). */
export function createValidator(contract) {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  ajv.addSchema({ $id: 'openapi', definitions: toJsonSchema(contract.components.schemas, true) });
  const cache = new Map();
  return (schemaName, data) => {
    if (!cache.has(schemaName)) cache.set(schemaName, ajv.compile({ $ref: `openapi#/definitions/${schemaName}` }));
    const validate = cache.get(schemaName);
    return validate(data) ? [] : validate.errors.map((e) => `${e.instancePath || '/'} ${e.message} ${JSON.stringify(e.params)}`);
  };
}
