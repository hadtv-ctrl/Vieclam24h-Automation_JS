/**
 * dashboard/services/aiEndpointPolicy.js
 * Re-exports AI endpoint policy primitives from core/ai/gateway/endpointPolicy.js.
 * Preserves backward compatibility across dashboard modules and existing tests.
 */
module.exports = require('../../core/ai/gateway/endpointPolicy');
