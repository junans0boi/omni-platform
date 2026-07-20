import { EventEmitter } from "events";

class MessageBroker extends EventEmitter {}

export const messageBroker = new MessageBroker();
messageBroker.setMaxListeners(100);
