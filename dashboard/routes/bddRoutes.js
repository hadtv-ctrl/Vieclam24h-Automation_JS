/**
 * dashboard/routes/bddRoutes.js
 * Master router for Visual Step Builder & BDD Studio.
 * Delegates to bddScriptRoutes and bddCompileRoutes.
 */
const { handleBddScriptRoutes } = require('./bdd/bddScriptRoutes');
const { handleBddCompileRoutes } = require('./bdd/bddCompileRoutes');

async function handleBddRoutes(request, response, url, context = {}) {
  if (await handleBddScriptRoutes(request, response, url, context)) return true;
  if (await handleBddCompileRoutes(request, response, url, context)) return true;
  return false;
}

module.exports = { handleBddRoutes };
