import { EventEmitter } from "events";

// Persist the EventEmitter across Next.js HMR reloads in dev mode
// by attaching it to the global object
const globalForBroker = global as unknown as { messageBroker: EventEmitter };

if (!globalForBroker.messageBroker) {
  globalForBroker.messageBroker = new EventEmitter();
  globalForBroker.messageBroker.setMaxListeners(100);
}

export const messageBroker = globalForBroker.messageBroker;
