// Import Node.js Dependencies
import { randomUUID } from "node:crypto";

// Import Third-party Dependencies
import {
  Interpersonal,
  InterpersonalOptions,
  Stream,
  initRedis
} from "@myunisoft/redis";
import { Logger, pino } from "pino";

// Import Internal Dependencies
import { EventCast, EventSubscribe, Prefix } from "../../../../types";
import { InitHandler } from "./init.class";
import { DispatcherStore } from "../store/dispatcher.class";
import { PubSubHandler } from "./pubsub.class";

// CONSTANTS
const kLoggerLevel = process.env.MYUNISOFT_EVENTS_SILENT_LOGGER;
const kEnvIdleTime = Number.isNaN(Number(process.env.MYUNISOFT_IDLE_TIME)) ? undefined :
  Number(process.env.MYUNISOFT_IDLE_TIME);
const kDefaultIdleTime = 2_000;

export interface SharedConf {
  instanceName: string;
  consumerUUID: string;
  logger: Partial<Logger> & Pick<Logger, "info" | "warn">;
  idleTime: number;
  prefix?: Prefix;
}

export interface DefaultEventDispatchSubscriber {
  name: string;
  horizontalScale: boolean;
  replicas: number;
}

export interface DefaultEventDispatchConfig {
  [key: string]: {
    subscribers: DefaultEventDispatchSubscriber[];
  }
}

type DispatcherPartialSharedConf = Partial<SharedConf> & Pick<SharedConf, "instanceName">;

export type DispatcherOptions = Partial<InterpersonalOptions> & DispatcherPartialSharedConf & {
  eventsSubscribe: (EventSubscribe & {
    horizontalScale?: boolean;
  })[];
  eventsCast: EventCast[];
  defaultEventConfig?: DefaultEventDispatchConfig;
}

export class Dispatcher {
  public dispatcherStreamName = "dispatcher-stream";

  public instanceName: string;
  public consumerUUID = randomUUID();
  public prefix: Prefix;
  public logger: Partial<Logger> & Pick<Logger, "info" | "warn">;
  public eventsCast: EventCast[];
  public eventsSubscribe: EventSubscribe[];

  public interpersonal: Interpersonal;
  public streams = new Map<string, Stream>();

  private dispatcherStore: DispatcherStore;

  private stateManager: StateManager;
  private pubsubHandler: PubSubHandler;
  private initHandler: InitHandler;

  constructor(options: DispatcherOptions) {
    Object.assign(this, options);

    this.logger = options.logger ?? pino({
      name: "Dispatcher",
      level: kLoggerLevel ?? "info",
      transport: {
        target: "pino-pretty"
      }
    });

    this.logger.setBindings({
      prefix: this.prefix,
      consumer: this.consumerUUID
    });

    const genericOptions = {
      instanceName: options.instanceName,
      idleTime: kEnvIdleTime ?? options.idleTime ?? kDefaultIdleTime,
      eventsSubscribe: this.eventsSubscribe,
      eventsCast: this.eventsCast,
      consumerUUID: this.consumerUUID,
      logger: this.logger
    };

    this.dispatcherStore = new DispatcherStore({
      prefix: this.prefix
    });

    this.stateManager = new StateManager();

    this.pubsubHandler = new PubSubHandler({
      ...options,
      ...genericOptions,
      stateManager: this.stateManager,
      dispatcherStore: this.dispatcherStore
    });

    this.initHandler = new InitHandler({
      ...options,
      ...genericOptions,
      stateManager: this.stateManager,
      pubsubHandler: this.pubsubHandler,
      dispatcherStore: this.dispatcherStore
    });
  }

  public async init(): Promise<void> {
    try {
      await this.initHandler.init();
    }
    catch (error) {
      this.logger.error({ error }, "Unable to init");
    }
  }

  public async publish() {
    //
  }
}

import timers from "node:timers/promises";
import { StateManager } from "./state-manager.class";

async function main() {
  await initRedis();
  await initRedis({}, "subscriber");

  // const foo = new Dispatcher({
  //   eventsSubscribe: []
  // });

  // await foo.init();

  const dispatchers = new Array(1);
  const toInit: any[] = [];
  for (const _ of dispatchers) {
    toInit.push(new Dispatcher({
      instanceName: "Pulsar",
      prefix: "test",
      eventsSubscribe: [
        {
          name: "accountingFolder",
          horizontalScale: false
        }
      ],
      eventsCast: [],
      defaultEventConfig: {
        accountingFolder: {
          subscribers: [
            {
              name: "GED",
              horizontalScale: true,
              replicas: 2
            }
          ]
        }
      }
    }));
  }

  await Promise.all([
    ...toInit.map((dispatcher) => dispatcher.init())
  ]);

  // await timers.setTimeout(2000);

  // const bar = new Dispatcher({
  //   eventsSubscribe: []
  // });

  // await bar.init();
}

main().then(() => console.log("init")).catch((error) => console.error(error));
