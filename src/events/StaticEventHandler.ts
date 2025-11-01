export class StaticEventHandler {
  private static events: Map<string, EventHandler[]> = new Map();

  static registerEvent(commandName: string, handler: EventHandler): void {
    if (!this.events.has(commandName)) {
      this.events.set(commandName, []);
    }
    this.events.get(commandName)!.push(handler);
  }

  static async handleEvent(
    generalObj: any,
    destGeneralObj: any,
    commandClass: any,
    env: any,
    arg: any
  ): Promise<void> {
    const commandName = commandClass.getName?.() || commandClass.name;
    const handlers = this.events.get(commandName) || [];

    for (const handler of handlers) {
      try {
        await handler.execute({
          generalObj,
          destGeneralObj,
          commandClass,
          env,
          arg
        });
      } catch (error) {
        console.error(`Event handler failed for ${commandName}:`, error);
      }
    }
  }

  static clearEvents(commandName?: string): void {
    if (commandName) {
      this.events.delete(commandName);
    } else {
      this.events.clear();
    }
  }

  static getEventHandlers(commandName: string): EventHandler[] {
    return this.events.get(commandName) || [];
  }

  static hasEventHandlers(commandName: string): boolean {
    return this.events.has(commandName) && this.events.get(commandName)!.length > 0;
  }
}

export interface EventHandler {
  execute(context: EventContext): Promise<void>;
}

export interface EventContext {
  generalObj: any;
  destGeneralObj: any;
  commandClass: any;
  env: any;
  arg: any;
}

export class SimpleEventHandler implements EventHandler {
  constructor(private handler: (context: EventContext) => Promise<void>) {}

  async execute(context: EventContext): Promise<void> {
    await this.handler(context);
  }
}

export class ConditionalEventHandler implements EventHandler {
  constructor(
    private condition: (context: EventContext) => boolean,
    private handler: (context: EventContext) => Promise<void>
  ) {}

  async execute(context: EventContext): Promise<void> {
    if (this.condition(context)) {
      await this.handler(context);
    }
  }
}

export class ChainEventHandler implements EventHandler {
  constructor(private handlers: EventHandler[]) {}

  async execute(context: EventContext): Promise<void> {
    for (const handler of this.handlers) {
      await handler.execute(context);
    }
  }
}

export class PriorityEventHandler implements EventHandler {
  constructor(
    private priority: number,
    private handler: EventHandler
  ) {}

  getPriority(): number {
    return this.priority;
  }

  async execute(context: EventContext): Promise<void> {
    await this.handler.execute(context);
  }
}
