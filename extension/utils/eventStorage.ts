/**
 * Storage utility for persisting event page state
 * Uses browser.storage.local for persistence
 */

const STORAGE_PREFIX = 'event_state_';

export interface EventState {
  [key: string]: any;
}

/**
 * Extract event ID from a polymarket event URL
 */
function getEventIdFromUrl(url: string): string | null {
  const match = url.match(/\/event\/([^/?]+)/);
  return match ? match[1] : null;
}

/**
 * Save state for a specific event
 */
export async function saveEventState(eventId: string, state: EventState): Promise<void> {
  const key = `${STORAGE_PREFIX}${eventId}`;
  await browser.storage.local.set({ [key]: state });
}

/**
 * Get state for a specific event
 */
export async function getEventState(eventId: string): Promise<EventState | null> {
  const key = `${STORAGE_PREFIX}${eventId}`;
  const result = await browser.storage.local.get(key);
  return result[key] || null;
}

/**
 * Save state for the current page (convenience function)
 */
export async function saveCurrentPageState(url: string, state: EventState): Promise<void> {
  const eventId = getEventIdFromUrl(url);
  if (!eventId) {
    throw new Error('Not a valid event page URL');
  }
  await saveEventState(eventId, state);
}

/**
 * Get state for the current page (convenience function)
 */
export async function getCurrentPageState(url: string): Promise<EventState | null> {
  const eventId = getEventIdFromUrl(url);
  if (!eventId) {
    return null;
  }
  return getEventState(eventId);
}

/**
 * Get all event states
 */
export async function getAllEventStates(): Promise<Record<string, EventState>> {
  const allData = await browser.storage.local.get(null);
  const eventStates: Record<string, EventState> = {};
  
  for (const [key, value] of Object.entries(allData)) {
    if (key.startsWith(STORAGE_PREFIX)) {
      const eventId = key.replace(STORAGE_PREFIX, '');
      eventStates[eventId] = value as EventState;
    }
  }
  
  return eventStates;
}

/**
 * Delete state for a specific event
 */
export async function deleteEventState(eventId: string): Promise<void> {
  const key = `${STORAGE_PREFIX}${eventId}`;
  await browser.storage.local.remove(key);
}

/**
 * Clear all event states
 */
export async function clearAllEventStates(): Promise<void> {
  const allData = await browser.storage.local.get(null);
  const keysToRemove = Object.keys(allData).filter(key => key.startsWith(STORAGE_PREFIX));
  await browser.storage.local.remove(keysToRemove);
}
