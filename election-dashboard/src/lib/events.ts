type Listener = (data: string) => void;

class EventBus {
  private listeners: Set<Listener> = new Set();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: object): void {
    const data = JSON.stringify(event);
    this.listeners.forEach((listener) => {
      try {
        listener(data);
      } catch {}
    });
  }

  get connectionCount(): number {
    return this.listeners.size;
  }
}

const globalForEvents = globalThis as unknown as { eventBus: EventBus };
export const eventBus = globalForEvents.eventBus || (globalForEvents.eventBus = new EventBus());
