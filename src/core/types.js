/**
 * @typedef {Object} Project
 * @property {string|number} id
 * @property {string} name
 * @property {[number, number]} coordinates // [lat, lng]
 * @property {number} zoom
 * @property {string} [status]
 * @property {string} [description]
 */

/**
 * @typedef {Object} Phase
 * @property {number} id
 * @property {string} name
 * @property {number} [phase_order]
 */

/**
 * @typedef {Object} Space
 * @property {number} id
 * @property {string} space_name
 * @property {string} category
 * @property {string} trade
 * @property {string} [description]
 * @property {Object} geometry // GeoJSON or FeatureCollection
 * @property {Array<{ project_phases?: Phase }>} [phase_space_assignments]
 */
