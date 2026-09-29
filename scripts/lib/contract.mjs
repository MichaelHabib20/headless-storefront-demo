import Ajv from 'ajv';
import addFormats from 'ajv-formats';

/** OpenAPI 3.0 schema → JSON Schema that Ajv understands. */
export function toJsonSchema(node) {
  if (Array.isArray(node)) return node.map(toJsonSchema);
  if (!node || typeof node !== 'object') return node;
  const { nullable, discriminator, example, ...rest } = node;
  const out = Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, toJsonSchema(v)]));
  if (typeof out.$ref === 'string') out.$ref = out.$ref.replace('#/components/schemas/', 'openapi#/definitions/');
  return nullable ? { anyOf: [out, { type: 'null' }] } : out;
}

/** Returns (schemaName, data) => string[] of violations (empty = valid). */
export function createValidator(contract) {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  ajv.addSchema({ $id: 'openapi', definitions: toJsonSchema(contract.components.schemas) });
  const cache = new Map();
  return (schemaName, data) => {
    if (!cache.has(schemaName)) cache.set(schemaName, ajv.compile({ $ref: `openapi#/definitions/${schemaName}` }));
    const validate = cache.get(schemaName);
    return validate(data) ? [] : validate.errors.map((e) => `${e.instancePath || '/'} ${e.message} ${JSON.stringify(e.params)}`);
  };
}
