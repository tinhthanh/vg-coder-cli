/**
 * Bubble Features - Paste & Run Feature
 */

import { EVENT_TYPES } from '../../event-protocol.js';

export const PasteRunFeature = {
    id: 'paste-run',
    icon: '📋',
    label: 'Paste & Run from Clipboard',
    tooltip: 'Paste & Run from Clipboard',
    eventType: EVENT_TYPES.PASTE_RUN,
    permissions: ['clipboard-read'],
    enabled: true,
    order: 1,
};
