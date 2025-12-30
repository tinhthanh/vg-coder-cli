import { EVENT_TYPES } from '../../event-protocol.js';

/**
 * Copy System Prompt Feature
 * Copies the system prompt to clipboard
 */
export const CopyPromptFeature = {
    id: 'copy-prompt',
    label: '📋 Copy System Prompt',
    tooltip: 'Copy System Prompt',
    eventType: EVENT_TYPES.COPY_PROMPT,
    enabled: true,
    order: 30,
};
