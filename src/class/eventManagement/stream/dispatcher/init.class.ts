/* eslint-disable max-depth */
// Import Node.js Dependencies
import { Readable } from "node:stream";
import { once, EventEmitter } from "node:events";
import timers from "node:timers/promises";
import { randomUUID } from "node:crypto";

// Import Third-party Dependencies
import {
  Interpersonal,
  InterpersonalOptions,
  Stream,
  getRedis
} from "@myunisoft/redis";
import { Logger } from "pino";

// Import Internal Dependencies
import { EventSubscribe, Prefix } from "../../../../types";
import { PubSubHandler } from "./pubsub.class";
import { DefaultEventDispatchConfig, SharedConf } from "./dispatcher.class";
import { IncomerStore } from "../store/incomer.class";
import { DispatcherStore } from "../store/dispatcher.class";

export type InitHandlerOptions = Partial<InterpersonalOptions> & SharedConf & {
  eventsSubscribe: (EventSubscribe & {
    horizontalScale?: boolean;
  })[];
  pubsubHandler: PubSubHandler;
  dispatcherStore: DispatcherStore;
  defaultEventConfig?: DefaultEventDispatchConfig;
}

// CONSTANTS
const kNullTimeStamp = 0;

export class InitHandler extends EventEmitter {
  public dispatcherStreamName = "dispatcher-stream";

  public instanceName: string;
  public prefix: Prefix;
  public formattedPrefix: string;
  public prefixedDispatcherStreamName: string;
  public consumerUUID: string;

  public interpersonal: Interpersonal;
  public eventStreams = new Map<string, Stream>();

  private dispatcherInitStream: Interpersonal;
  private DispatcherStreamReader: Readable;

  private logger: Partial<Logger> & Pick<Logger, "info" | "warn">;
  private dispatcherStore: IncomerStore;
  private pubsubHandler: PubSubHandler;
  private defaultEventConfig: DefaultEventDispatchConfig | undefined;

  private initCustomId = 2;

  constructor(options: InitHandlerOptions) {
    super();

    Object.assign(this, options);

    this.formattedPrefix = `${this.prefix ? `${this.prefix}-` : ""}`;
    this.prefixedDispatcherStreamName = this.formattedPrefix + this.dispatcherStreamName;

    this.logger = options.logger.child({ module: "init-handler" });

    this.dispatcherInitStream = new Interpersonal({
      ...options,
      count: 1,
      lastId: ">",
      frequency: 1,
      claimOptions: {
        idleTime: 500
      },
      streamName: this.prefixedDispatcherStreamName,
      groupName: this.instanceName,
      consumerName: this.consumerUUID
    });
  }

  get redis() {
    return getRedis();
  }

  get subscriber() {
    return getRedis("subscriber");
  }

  public async init(): Promise<void> {
    const streamExist = await this.dispatcherInitStream.streamExist();

    if (streamExist) {
      // eslint-disable-next-line dot-notation
      const groupExist = await this.dispatcherInitStream["groupExist"]();
      if (groupExist) {
        await this.pubsubHandler.init();

        await this.pubsubHandler.dispatcherRegistration();

        // eslint-disable-next-line dot-notation
        await this.dispatcherInitStream["createConsumer"]();

        return;
      }
    }

    try {
      await this.dispatcherInitStream.init();
    }
    catch {
      // wait for stream & group to be init
      await timers.setTimeout(10);

      await this.dispatcherInitStream.init();
    }

    this.DispatcherStreamReader = Readable.from(this.dispatcherInitStream[Symbol.asyncIterator]());

    this.DispatcherStreamReader.on("readable", async() => {
      const entries = this.DispatcherStreamReader.read();

      for (const entry of entries) {
        if (String(entry.id) === `${kNullTimeStamp}-${this.initCustomId}`) {
          await this.takeLead();
        }

        await this.dispatcherInitStream.claimEntry(entry.id);
      }
    });

    this.DispatcherStreamReader.on("error", (error) => {
      this.logger.warn({ error }, "Handle Redis Stream Error Here");

      return;
    });

    await this.pubsubHandler.init();

    await this.pushInitStreamEntry();
  }

  private async pushInitStreamEntry() {
    try {
      await this.dispatcherInitStream.push(
        { event: "init" },
        { id: `${kNullTimeStamp}-${this.initCustomId}` }
      );
    }
    catch (error) {
      await this.pubsubHandler.dispatcherRegistration();
    }
  }

  public async takeLeadBack() {
    //
  }

  public async close(): Promise<void> {
    this.DispatcherStreamReader.destroy();
    once(this.DispatcherStreamReader, "close");

    this.dispatcherInitStream.deleteConsumer();
  }

  private async handleDefaultEventConfig() {
    for (const [event, config] of Object.entries(this.defaultEventConfig)) {
      const streamName = this.formattedPrefix + event;

      const eventStream = new Interpersonal({
        count: 100,
        lastId: ">",
        frequency: 1,
        claimOptions: {
          idleTime: 5_000
        },
        streamName,
        groupName: this.instanceName,
        consumerName: this.consumerUUID
      });

      const eventStreamExist = await eventStream.streamExist();
      if (!eventStreamExist) {
        await eventStream.init();
      }

      for (const subscriber of config.subscribers) {
        const { name, horizontalScale, replicas } = subscriber;

        const subscriberGroupExist = (await eventStream.getGroupsData())
          .some((group) => group.name === name);

        if (!subscriberGroupExist) {
          await this.redis.xgroup("CREATE", streamName, name, "$", "MKSTREAM");
        }

        if (!horizontalScale) {
          for (let index = 0; index < replicas; index++) {
            await this.redis.xgroup("CREATECONSUMER", streamName, name, randomUUID());
          }
        }

        if (horizontalScale) {
          const filteredGroups = (await eventStream.getGroupsData())
            .filter((group) => group.name.startsWith(`${name}-`));

          const totalGroupsInit = filteredGroups.length + 1;

          for (let index = totalGroupsInit; index < replicas; index++) {
            const groupName = `${name}-${randomUUID()}`;
            await this.redis.xgroup("CREATE", streamName, groupName, "$", "MKSTREAM");
          }
        }
      }
    }
  }

  private async takeLead() {
    this.pubsubHandler.isLeader = true;

    const takeLeadEvent = {
      name: "dispatcher-take_lead",
      redisMetadata: {
        origin: this.consumerUUID
      }
    };

    await this.pubsubHandler.dispatcherChannel.publish(takeLeadEvent);

    if (this.defaultEventConfig) {
      await this.handleDefaultEventConfig();
    }

    const now = Date.now();

    const dispatcher = Object.assign({}, {
      name: this.instanceName,
      isDispatcherActiveInstance: true,
      eventsSubscribe: [],
      eventsCast: [],
      baseUUID: this.consumerUUID,
      lastActivity: now,
      aliveSince: now,
      prefix: this.prefix
    });

    this.pubsubHandler.providedUUID = await this.dispatcherStore.set(dispatcher);

    this.logger.info("Resolved initialization and taking Lead");
  }
}
