import { redisPub, redisSub } from "./redis";

type Listener = (data: string) => void;

class EventBus {
  private listeners: Set<Listener> = new Set();
  private redisSubscribed: boolean = false;

  constructor() {
    this.initRedis();
  }

  private initRedis() {
    if (redisSub && !this.redisSubscribed) {
      redisSub.subscribe("votes_channel").catch((err) => {
        console.error("Failed to subscribe to Redis events channel:", err);
      });

      redisSub.on("message", (channel, message) => {
        if (channel === "votes_channel") {
          this.listeners.forEach((listener) => {
            try {
              listener(message);
            } catch {}
          });
        }
      });

      this.redisSubscribed = true;
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    this.initRedis();
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: object): void {
    const data = JSON.stringify(event);

    if (redisPub) {
      redisPub.publish("votes_channel", data).catch((err) => {
        console.error("Failed to publish to Redis events channel:", err);
        this.listeners.forEach((listener) => {
          try {
            listener(data);
          } catch {}
        });
      });
    } else {
      this.listeners.forEach((listener) => {
        try {
          listener(data);
        } catch {}
      });
    }
  }

  get connectionCount(): number {
    return this.listeners.size;
  }
}

const globalForEvents = globalThis as unknown as { eventBus: EventBus };
export const eventBus =
  globalForEvents.eventBus || (globalForEvents.eventBus = new EventBus());
