'use strict';

/**
 * dashboard/services/qa/scaffoldScriptParser.js
 * Facade gộp các bộ bóc tách kịch bản (test script & spec text).
 */

const {
  detectIsTestScript,
  parseTestBlocksFromScript,
  extractHeuristicFromTestScript,
} = require('./scriptTestParser');

const {
  extractHeuristicFromSpecText,
} = require('./specTextParser');

module.exports = {
  detectIsTestScript,
  parseTestBlocksFromScript,
  extractHeuristicFromTestScript,
  extractHeuristicFromSpecText,
};
