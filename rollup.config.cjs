/* eslint-disable no-undef */
const { globalConfig } = require('../../rollup.config.base.cjs');

module.exports = (config) => {
  globalConfig(config);
  return config;
};
