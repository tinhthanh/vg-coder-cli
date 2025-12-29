/**
 * Bubble Features Registry
 * 
 * Central registry for all bubble menu features.
 * Makes it easy to add/remove features without modifying core code.
 */

import { PasteRunFeature } from './paste-run-feature.js';
import { TerminalFeature } from './terminal-feature.js';

/**
 * FeatureRegistry - Manages bubble menu features
 */
export class FeatureRegistry {
    constructor() {
        this.features = new Map();

        // Make available globally for debugging
        if (typeof window !== 'undefined') {
            window.__VG_FEATURE_REGISTRY__ = this;
        }
    }

    /**
     * Register a feature
     * @param {Object} feature - Feature definition
     */
    register(feature) {
        if (!feature.id) {
            console.error('[FeatureRegistry] Feature must have an id', feature);
            return false;
        }

        if (this.features.has(feature.id)) {
            console.warn(`[FeatureRegistry] Feature ${feature.id} already registered. Overwriting.`);
        }

        this.features.set(feature.id, feature);
        return true;
    }

    /**
     * Unregister a feature
     * @param {string} id - Feature id
     */
    unregister(id) {
        return this.features.delete(id);
    }

    /**
     * Get all features
     * @returns {Array} Array of feature objects
     */
    getFeatures() {
        return Array.from(this.features.values());
    }

    /**
     * Get enabled features only
     * @returns {Array} Array of enabled feature objects
     */
    getEnabledFeatures() {
        return this.getFeatures()
            .filter(f => f.enabled)
            .sort((a, b) => a.order - b.order);
    }

    /**
     * Get feature by id
     * @param {string} id - Feature id
     * @returns {Object|null} Feature object or null
     */
    getFeature(id) {
        return this.features.get(id) || null;
    }

    /**
     * Check if feature is enabled
     * @param {string} id - Feature id
     * @returns {boolean}
     */
    isFeatureEnabled(id) {
        const feature = this.features.get(id);
        return feature ? feature.enabled : false;
    }

    /**
     * Enable/disable a feature
     * @param {string} id - Feature id
     * @param {boolean} enabled - Enable state
     */
    setFeatureEnabled(id, enabled) {
        const feature = this.features.get(id);
        if (feature) {
            feature.enabled = enabled;
            return true;
        }
        return false;
    }

    /**
     * Get feature count
     * @returns {number}
     */
    getFeatureCount() {
        return this.features.size;
    }

    /**
     * Clear all features
     */
    clear() {
        this.features.clear();
    }
}

// Create singleton registry
export const featureRegistry = new FeatureRegistry();

// Register built-in features
featureRegistry.register(PasteRunFeature);
featureRegistry.register(TerminalFeature);

// Export for external registration
export { PasteRunFeature, TerminalFeature };
