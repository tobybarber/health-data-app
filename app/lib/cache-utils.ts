/**
 * Utility functions for managing record caching
 */

/**
 * Invalidate the cache for a specific user's records
 * @param userId The user ID whose cache should be invalidated
 */
export const invalidateRecordsCache = (userId: string): void => {
  try {
    localStorage.removeItem(`records_${userId}`);
    localStorage.removeItem(`records_${userId}_timestamp`);
  } catch (error) {
    console.error('Error invalidating records cache:', error);
  }
};

/**
 * Gets the current cache timestamp for a user's records
 * @param userId The user ID whose cache timestamp to check
 * @returns The timestamp of the cache or null if not found
 */
export const getRecordsCacheTimestamp = (userId: string): number | null => {
  try {
    const timestamp = localStorage.getItem(`records_${userId}_timestamp`);
    return timestamp ? parseInt(timestamp, 10) : null;
  } catch (error) {
    console.error('Error getting records cache timestamp:', error);
    return null;
  }
};

/**
 * Check if the user's records cache is valid
 * @param userId The user ID whose cache to check
 * @param cacheDuration Maximum age of the cache in milliseconds
 * @returns Boolean indicating if the cache is valid
 */
export const isRecordsCacheValid = (userId: string, cacheDuration: number): boolean => {
  try {
    const timestamp = getRecordsCacheTimestamp(userId);
    if (!timestamp) return false;
    
    const now = Date.now();
    return now - timestamp < cacheDuration;
  } catch (error) {
    console.error('Error checking records cache validity:', error);
    return false;
  }
}; 