/**
 * Bubble Features - Terminal Feature
 */

import { EVENT_TYPES } from '../../event-protocol.js';

export const TerminalFeature = {
    id: 'terminal-new',
    icon: '🖥️',
    label: 'New Terminal',
    tooltip: 'Open New Terminal',
    eventType: EVENT_TYPES.TERMINAL_NEW,
    permissions: [],
    enabled: true,
    order: 2,
};
