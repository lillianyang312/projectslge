/**
 * Deal Events Emitter
 * 
 * Lightweight event system for notifying components when deals are created or updated.
 * Used to keep InboxHome and other screens in sync with deal changes across the app.
 */

type DealUpdateCallback = () => void;

class DealEventEmitter {
  private listeners: Set<DealUpdateCallback> = new Set();

  /**
   * Subscribe to deal update events
   * @param callback Function to call when a deal is created/updated
   * @returns Unsubscribe function
   */
  subscribe(callback: DealUpdateCallback): () => void {
    this.listeners.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Unsubscribe from deal update events
   * @param callback The callback function to remove
   */
  unsubscribe(callback: DealUpdateCallback): void {
    this.listeners.delete(callback);
  }

  /**
   * Emit a deal update event to all subscribers
   */
  emit(): void {
    this.listeners.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        console.error('Error in deal update listener:', error);
      }
    });
  }
}

// Export singleton instance
export const dealEvents = new DealEventEmitter();
