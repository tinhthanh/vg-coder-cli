/**
 * VG Coder Event Protocol
 * 
 * Standardized event communication system for cross-context messaging.
 * Supports: window, shadow-root, iframe contexts.
 */

// Event Types Registry
export const EVENT_TYPES = {
    PASTE_RUN: 'vg:paste-run',
    TERMINAL_NEW: 'vg:terminal-new',
    TERMINAL_EXECUTE: 'vg:terminal-execute',
    FEATURE_TOGGLE: 'vg:feature-toggle',
};

/**
 * EventProtocol - Standardized event format
 */
export class EventProtocol {
    constructor({ type, source, target, payload = {}, context = 'window' }) {
        this.type = type;
        this.source = source;
        this.target = target;
        this.payload = payload;
        this.timestamp = Date.now();
        this.context = context;
        this.id = `${type}-${this.timestamp}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Validate event structure
     */
    isValid() {
        return !!(this.type && this.source && this.target);
    }

    /**
     * Convert to plain object
     */
    toObject() {
        return {
            id: this.id,
            type: this.type,
            source: this.source,
            target: this.target,
            payload: this.payload,
            timestamp: this.timestamp,
            context: this.context,
        };
    }
}

/**
 * EventDispatcher - Multi-context event dispatcher
 * 
 * Supports communication across:
 * - Window context
 * - Shadow DOM context  
 * - Iframe context
 */
export class EventDispatcher {
    constructor(options = {}) {
        this.listeners = new Map();
        this.contexts = options.contexts || ['window'];
        this.debug = options.debug || false;
        this.eventHistory = [];
        this.maxHistorySize = options.maxHistorySize || 100;

        // Make available globally for debugging
        if (typeof window !== 'undefined') {
            window.__VG_EVENT_DISPATCHER__ = this;
        }
    }

    /**
     * Register event listener
     * @param {string} eventType - Event type to listen for
     * @param {Function} handler - Handler function
     * @param {Object} options - Listener options
     */
    on(eventType, handler, options = {}) {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, []);
        }

        const listener = {
            handler,
            context: options.context || 'all',
            priority: options.priority || 0,
            once: options.once || false,
        };

        this.listeners.get(eventType).push(listener);

        // Sort by priority (higher first)
        this.listeners.get(eventType).sort((a, b) => b.priority - a.priority);

        if (this.debug) {
            console.log(`[EventDispatcher] Registered listener for: ${eventType}`, listener);
        }

        // Return unsubscribe function
        return () => this.off(eventType, handler);
    }

    /**
     * Register one-time event listener
     */
    once(eventType, handler, options = {}) {
        return this.on(eventType, handler, { ...options, once: true });
    }

    /**
     * Unregister event listener
     */
    off(eventType, handler) {
        if (!this.listeners.has(eventType)) return;

        const listeners = this.listeners.get(eventType);
        const index = listeners.findIndex(l => l.handler === handler);
        
        if (index !== -1) {
            listeners.splice(index, 1);
            if (this.debug) {
                console.log(`[EventDispatcher] Unregistered listener for: ${eventType}`);
            }
        }

        // Clean up empty listener arrays
        if (listeners.length === 0) {
            this.listeners.delete(eventType);
        }
    }

    /**
     * Dispatch event
     * @param {Object|EventProtocol} event - Event to dispatch
     */
    async dispatch(event) {
        // Convert to EventProtocol if needed
        const eventObj = event instanceof EventProtocol 
            ? event 
            : new EventProtocol(event);

        if (!eventObj.isValid()) {
            console.error('[EventDispatcher] Invalid event:', eventObj);
            return false;
        }

        // Add to history
        this.eventHistory.push(eventObj.toObject());
        if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory.shift();
        }

        if (this.debug) {
            console.log('[EventDispatcher] Dispatching:', eventObj.toObject());
        }

        // Get listeners for this event type
        const listeners = this.listeners.get(eventObj.type) || [];
        
        // Filter by context
        const contextListeners = listeners.filter(l => 
            l.context === 'all' || l.context === eventObj.context
        );

        if (contextListeners.length === 0) {
            if (this.debug) {
                console.warn(`[EventDispatcher] No listeners for: ${eventObj.type}`);
            }
            return false;
        }

        // Execute handlers
        const results = [];
        for (const listener of contextListeners) {
            try {
                const result = await listener.handler(eventObj.toObject());
                results.push({ success: true, result });

                // Remove if once
                if (listener.once) {
                    this.off(eventObj.type, listener.handler);
                }
            } catch (error) {
                console.error(`[EventDispatcher] Handler error for ${eventObj.type}:`, error);
                results.push({ success: false, error });
            }
        }

        return results;
    }

    /**
     * Dispatch event across contexts (window + shadow root + iframes)
     */
    async dispatchCrossContext(event) {
        const eventObj = event instanceof EventProtocol 
            ? event 
            : new EventProtocol(event);

        const results = [];

        // Dispatch in current context
        results.push(await this.dispatch(eventObj));

        // Dispatch to shadow roots if available
        if (typeof window !== 'undefined' && window.__VG_CODER_ROOT__) {
            const shadowDispatcher = window.__VG_CODER_ROOT__.__VG_EVENT_DISPATCHER__;
            if (shadowDispatcher && shadowDispatcher !== this) {
                results.push(await shadowDispatcher.dispatch(eventObj));
            }
        }

        // Dispatch to iframes (if needed in future)
        // TODO: Add iframe support

        return results.flat();
    }

    /**
     * Get event history
     */
    getHistory(limit = 10) {
        return this.eventHistory.slice(-limit);
    }

    /**
     * Clear event history
     */
    clearHistory() {
        this.eventHistory = [];
    }

    /**
     * Get all registered event types
     */
    getRegisteredEvents() {
        return Array.from(this.listeners.keys());
    }

    /**
     * Get listener count for event type
     */
    getListenerCount(eventType) {
        return this.listeners.get(eventType)?.length || 0;
    }

    /**
     * Enable/disable debug mode
     */
    setDebug(enabled) {
        this.debug = enabled;
        console.log(`[EventDispatcher] Debug mode: ${enabled ? 'ON' : 'OFF'}`);
    }
}

// Create and export singleton instance
export const globalDispatcher = new EventDispatcher({
    contexts: ['window', 'shadow-root', 'iframe'],
    debug: false,
});
