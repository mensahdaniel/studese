/**
 * Notification Events - A simple event system for triggering notification UI actions
 *
 * This allows components like Tasks.tsx to trigger the NotificationBell to open
 * when urgent notifications (like task alarms) need immediate attention.
 */

type NotificationEventType = 'open-bell' | 'new-notification' | 'task-alarm';

interface NotificationEventData {
  type: NotificationEventType;
  payload?: {
    title?: string;
    message?: string;
    taskId?: string;
    notificationId?: string;
    playSound?: boolean;
    urgent?: boolean;
  };
}

type NotificationEventListener = (data: NotificationEventData) => void;

class NotificationEventEmitter {
  private listeners: Map<NotificationEventType, Set<NotificationEventListener>> = new Map();

  /**
   * Subscribe to a notification event
   */
  on(event: NotificationEventType, listener: NotificationEventListener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(listener);
    };
  }

  /**
   * Emit a notification event
   */
  emit(event: NotificationEventType, payload?: NotificationEventData['payload']): void {
    const eventData: NotificationEventData = { type: event, payload };

    this.listeners.get(event)?.forEach((listener) => {
      try {
        listener(eventData);
      } catch (error) {
        console.error(`Error in notification event listener for "${event}":`, error);
      }
    });
  }

  /**
   * Remove all listeners for an event
   */
  off(event: NotificationEventType): void {
    this.listeners.delete(event);
  }

  /**
   * Remove all listeners
   */
  clear(): void {
    this.listeners.clear();
  }
}

// Singleton instance
export const notificationEvents = new NotificationEventEmitter();

// Helper functions for common actions
export const triggerOpenBell = () => {
  notificationEvents.emit('open-bell');
};

export const triggerTaskAlarm = (taskId: string, title: string, message: string) => {
  notificationEvents.emit('task-alarm', {
    taskId,
    title,
    message,
    playSound: true,
    urgent: true,
  });
};

export const triggerNewNotification = (notificationId: string) => {
  notificationEvents.emit('new-notification', {
    notificationId,
  });
};
