'use strict';

/**
 * core/generator/objectRepository.js
 * Facade kết nối và re-export các submodule của Object Repository & Fixtures Studio engine.
 * Tuân thủ chuẩn Modular Decomposition (PLAN-07).
 */

const {
  PAGE_ROOTS,
  FIXTURE_ALLOWLIST,
  PAGE_METADATA,
  FIXTURE_METADATA_VI,
  getCoreCapabilities,
} = require('./objectRepository/metadataCatalog');

const {
  LOCATOR_EXPRESSION,
  normalizePagePath,
  validateLocatorExpression,
  getReadiness,
  inferElementCategory,
  inferHumanDescription,
} = require('./objectRepository/locatorValidator');

const {
  isValidFixtureName,
  findCustomFixturePath,
  extractExtendObjectBody,
  parseExtendFixtures,
  parseFixture,
  scanAllFixtures,
  getFixtureByName,
} = require('./objectRepository/fixtureParser');

const {
  validateCustomFixtureSource,
  createCustomFixture,
  updateCustomFixture,
  deleteCustomFixture,
} = require('./objectRepository/fixtureGenerator');

const {
  parsePageObject,
  scanAllPageObjects,
  updateLocatorSelector,
  createPageObject,
  deletePageObject,
} = require('./objectRepository/pageRepository');

module.exports = {
  PAGE_ROOTS,
  PAGE_METADATA,
  FIXTURE_METADATA_VI,
  FIXTURE_ALLOWLIST,
  getCoreCapabilities,
  LOCATOR_EXPRESSION,
  normalizePagePath,
  validateLocatorExpression,
  getReadiness,
  inferElementCategory,
  inferHumanDescription,
  isValidFixtureName,
  findCustomFixturePath,
  extractExtendObjectBody,
  parseExtendFixtures,
  parseFixture,
  scanAllFixtures,
  getFixtureByName,
  validateCustomFixtureSource,
  createCustomFixture,
  updateCustomFixture,
  deleteCustomFixture,
  parsePageObject,
  scanAllPageObjects,
  updateLocatorSelector,
  createPageObject,
  deletePageObject,
};
