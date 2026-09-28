/**
 * core/ai/gateway/json.js
 * Balanced bracket JSON extraction from markdown/text and zero-dependency schema validation.
 * Strict ceiling <= 150 lines.
 */

function extractJson(text) {
  if (typeof text !== 'string') {
    throw new Error('Input must be a string');
  }

  let cleaned = text.trim();
  // Strip code fences if present
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  // Find first { or [
  let startIdx = -1;
  let openChar = '';
  let closeChar = '';

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (ch === '{') {
      startIdx = i;
      openChar = '{';
      closeChar = '}';
      break;
    }
    if (ch === '[') {
      startIdx = i;
      openChar = '[';
      closeChar = ']';
      break;
    }
  }

  if (startIdx === -1) {
    throw new Error('No JSON object or array found in text');
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  let endIdx = -1;

  for (let i = startIdx; i < cleaned.length; i++) {
    const ch = cleaned[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === openChar) {
      depth++;
    } else if (ch === closeChar) {
      depth--;
      if (depth === 0) {
        endIdx = i;
        break;
      }
    }
  }

  if (endIdx === -1) {
    throw new Error(`Unbalanced ${openChar}${closeChar} in JSON content`);
  }

  const candidate = cleaned.slice(startIdx, endIdx + 1);
  return JSON.parse(candidate);
}

function validateShape(schema, value, path = '$') {
  if (!schema) return { valid: true };

  // Check type
  if (schema.type) {
    if (schema.type === 'array') {
      if (!Array.isArray(value)) {
        return { valid: false, error: `Expected array at ${path}, got ${typeof value}`, path };
      }
      if (schema.items) {
        for (let i = 0; i < value.length; i++) {
          const res = validateShape(schema.items, value[i], `${path}[${i}]`);
          if (!res.valid) return res;
        }
      }
    } else if (schema.type === 'object') {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return { valid: false, error: `Expected object at ${path}`, path };
      }
      // Check required
      if (Array.isArray(schema.required)) {
        for (const reqField of schema.required) {
          if (value[reqField] === undefined || value[reqField] === null) {
            return { valid: false, error: `Missing required field "${reqField}" at ${path}`, path: `${path}.${reqField}` };
          }
        }
      }
      // Check properties
      if (schema.properties) {
        for (const [propKey, propSchema] of Object.entries(schema.properties)) {
          if (value[propKey] !== undefined) {
            const res = validateShape(propSchema, value[propKey], `${path}.${propKey}`);
            if (!res.valid) return res;
          }
        }
      }
    } else if (schema.type === 'string') {
      if (typeof value !== 'string') {
        return { valid: false, error: `Expected string at ${path}, got ${typeof value}`, path };
      }
      if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
        return { valid: false, error: `Value at ${path} must be one of [${schema.enum.join(', ')}]`, path };
      }
    } else if (schema.type === 'number') {
      if (typeof value !== 'number' || isNaN(value)) {
        return { valid: false, error: `Expected number at ${path}`, path };
      }
    } else if (schema.type === 'boolean') {
      if (typeof value !== 'boolean') {
        return { valid: false, error: `Expected boolean at ${path}`, path };
      }
    }
  }

  return { valid: true };
}

module.exports = {
  extractJson,
  validateShape
};
