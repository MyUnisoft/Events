<p align="center"><h1 align="center">
  Events
</h1></p>

<p align="center">
  MyUnisoft Events validator, schemas and types (useful to work with Webhooks).
</p>

<p align="center">
    <a href="https://github.com/MyUnisoft/events"><img src="https://img.shields.io/github/package-json/v/MyUnisoft/events?style=flat-square" alt="npm version"></a>
    <a href="https://github.com/MyUnisoft/events"><img src="https://img.shields.io/github/license/MyUnisoft/events?style=flat-square" alt="license"></a>
    <a href="https://github.com/MyUnisoft/events"><img src="https://img.shields.io/github/languages/code-size/MyUnisoft/events?style=flat-square" alt="size"></a>
</p>

## 🚧 Requirements

- [Node.js](https://nodejs.org/en/) version 16 or higher
- Docker (for running tests).

## 🚀 Getting Started

This package is available in the Node Package Repository and can be easily installed with [npm](https://doc.npmjs.com/getting-started/what-is-npm) or [yarn](https://yarnpkg.com)

```bash
$ npm i @myunisoft/events
# or
$ yarn add @myunisoft/events
```

---

## Publishing Events

### Events

An Event fully constituted is composed by a `name`, an `operation` and multiple objects such as `data`, `scope` and `metadata`.
- The `name` identify the event.
- The `operation` will define if it is a creation, update or deletion.
- According to the name, we know the `data` and the different `metadata.origin.method` related.
- The `metadata` object is used to determine different information as the ecosystem, the entry point etc.
- The `scope` will define the **who**.

```ts
export interface Scope {
  schemaId: number;
  firmId?: number | null;
  firmSIRET?: number | null;
  accountingFolderId?: number | null;
  accountingFolderSIRET?: number | null;
  accountingFolderRef?: string | null;
  persPhysiqueId?: number | null;
}

export type Method = "POST" | "PATCH" | "PUT" | "DELETE";

export interface Metadata {
  agent: string;
  origin?: {
    endpoint: string;
    method: Method;
    requestId?: string;
  };
  createdAt: number;
}
```

### 📚 Usage

> Define and validate an event.

```ts
import * as MyEvents, { EventOptions } from "@myunisoft/events";

const event: EventOptions<"connector"> = {
  name: "connector",
  operation: "CREATE",
  scope: {
    schemaId: 1
  },
  metadata: {
    agent: "Node",
    origin: {
      endpoint: "http://localhost:12080/api/v1/my-custom-feature",
      method: "POST",
      requestId: crypto.randomUUID();
    },
    createdAt: Date.now()
  },
  data: {
    id: 1,
    code: "JFAC"
  }
};

MyEvents.validate<"connector">(event);
```

> Define which operation the event has.

```ts
const event: EventOptions<"connector"> = {
  name: "connector",
  operation: "CREATE",
  scope: {
    schemaId: 1
  },
  metadata: {
    agent: "Node",
    origin: {
      endpoint: "http://localhost:12080/api/v1/my-custom-feature",
      method: "POST",
      requestId: crypto.randomUUID();
    },
    createdAt: Date.now()
  },
  data: {
    id: 1,
    code: "JFAC"
  }
};

if (isCreateOperation(event.operation)) {
  // Do some code
}

if (isUpdateOperation(event.operation)) {
  // Do some code
}

if (isDeleteOperation(event.operation)) {
  // Do some code
}
```

### Environment Variables

> [!IMPORTANT]
> Some options takes the lead over environment variables. For instance with: `new Incomer({ dispatcherInactivityOptions: { maxPingInterval: 900_000 }})` the max ping interval will be `900_000` even if `MYUNISOFT_INCOMER_MAX_PING_INTERVAL` variable is set.

| variable | description | default |
| --- | --- | --- |
| `MYUNISOFT_INCOMER_INIT_TIMEOUT` | Incomer initialisation timeout | `3_500` |
| `MYUNISOFT_EVENTS_INIT_EXTERNAL` | Weither Incomer should initialise an external Dispatcher | `false` |
| `MYUNISOFT_EVENTS_SILENT_LOGGER` | Disable logs | `false` |
| `MYUNISOFT_INCOMER_MAX_PING_INTERVAL` | Maximum ping interval | `60_000` |
| `MYUNISOFT_INCOMER_PUBLISH_INTERVAL` | Publish interval | `60_000` |
| `MYUNISOFT_INCOMER_IS_DISPATCHER` | Weither Incomer is a Dispatcher | `false` |
| `MYUNISOFT_DISPATCHER_IDLE_TIME` | Interval threshold when Dispatcher become idle | `600_000` |
| `MYUNISOFT_DISPATCHER_CHECK_LAST_ACTIVITY_INTERVAL` | Dispatcher checking last activity interval | `120_000` |
| `MYUNISOFT_DISPATCHER_BACKUP_TRANSACTION_STORE_NAME` | Default name for backup transaction store | `backup` |
| `MYUNISOFT_DISPATCHER_INIT_TIMEOUT` | Dispatcher initialisation timeout | `3_500` |
| `MYUNISOFT_DISPATCHER_PING_INTERVAL` | Dispatcher ping interval | `3_500` |

### API

#### Dispatcher & Incomer class

> There is the documentation of [**Dispatcher**](./docs/class/dispatcher.md), and [**Incomer**](./docs/class/incomer.md) classes.

---

#### validate< T extends keyof Events >(options: EventOptions<T>): void

> Throw an error if a given event is not internaly known.

---

#### isCreateOperation< T extends keyof Events >(operation: EventOptions<T>["operation"]): operation is Operation["create"]

---

#### isUpdateOperation< T extends keyof Events >(operation: EventOptions<T>["operation"]): operation is Operation["update"]

---

#### isDeleteOperation< T extends keyof Events >(operation: EventOptions<T>["operation"]): operation is Operation["delete"]

### Types

#### EventOptions

```ts
export type EventOptions<K extends keyof EventsDefinition.Events> = {
  scope: Scope;
  metadata: Metadata;
} & EventsDefinition.Events[K];

const event: EventOptions<"connector"> = {
  name: "connector",
  operation: "CREATE",
  scope: {
    schemaId: 1
  },
  metadata: {
    agent: "Node",
    createdAt: Date.now(),
    requestId: crypto.randomUUID();
  },
  data: {
    id: 1,
    code: "JFAC"
  }
}
```

#### EventsOptions

```ts
type TupleToObject<T extends readonly any[],
  M extends Record<Exclude<keyof T, keyof any[]>, PropertyKey>> =
  { [K in Exclude<keyof T, keyof any[]> as M[K]]: T[K] };

export type EventsOptions<T extends (keyof EventsDefinition.Events)[] = (keyof EventsDefinition.Events)[]> = TupleToObject<[
  ...(EventOptions<T[number]>)[]
], []>;

const events: EventsOptions<["connector", "accountingFolder"]> = [
  {
    name: "connector",
    operation: "CREATE",
    scope: {
      schemaId: 1
    },
    metadata: {
      agent: "Node",
      createdAt: Date.now(),
      requestId: crypto.randomUUID();
    },
    data: {
      id: 1,
      code: "JFAC"
    }
  },
  {
    name: "accountingFolder",
    operation: "CREATE",
    scope: {
      schemaId: 1
    },
    metadata: {
      agent: "Windev",
      createdAt: Date.now(),
      requestId: crypto.randomUUID();
    },
    data: {
      id: 1
    }
  }
];

const event: EventsOptions<["connector", "accountingFolder"]> = {
  name: "connector",
  operation: "CREATE",
  scope: {
    schemaId: 1
  },
  metadata: {
    agent: "Node",
    createdAt: Date.now(),
    requestId: 0
  },
  data: {
    id: 1,
    code: "JFAC"
  }
}
```


---

## Exploiting Webhooks

### 📚 Usage

> 👀 See [**here**](./example/fastify/feature/webhook.ts) for an example of exploiting webhooks with an http server.

> 👀 See [**here**](./docs/events.md) for an exhaustive list of MyUnisoft Events you can subscribe to.

> ⚠️ A Webhook can send multiple Events on a single HTTP POST request.

### Types

#### WebhooksResponse

[JSON Schema](./docs/json-schema/webhook.md)

```ts
type WebhookResponse<K extends keyof EventTypes.Events> = {
  scope: Scope;
  webhookId: string;
  createdAt: number;
} & EventTypes.Events[K];

export type WebhooksResponse<T extends (keyof EventTypes.Events)[] = (keyof EventTypes.Events)[]> = [
  ...(WebhookResponse<T[number]>)[]
];

const response: WebhooksResponse<["connector", "accountingFolder"]> = [
  {
    name: "connector",
    operation: "CREATE",
    scope: {
      schemaId: 1
    },
    data: {
      id: 1,
      code: "JFAC"
    },
    webhookId: "1",
    createdAt: Date.now()
  },
  {
    name: "accountingFolder",
    operation: "CREATE",
    scope: {
      schemaId: 1
    },
    data: {
      id: 1
    },
    webhookId: "2",
    createdAt: Date.now()
  },
];
```


<br/>

## Contributors ✨

<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
[![All Contributors](https://img.shields.io/badge/all_contributors-4-orange.svg?style=flat-square)](#contributors-)
<!-- ALL-CONTRIBUTORS-BADGE:END -->

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://www.linkedin.com/in/nicolas-hallaert/"><img src="https://avatars.githubusercontent.com/u/39910164?v=4?s=100" width="100px;" alt="Nicolas Hallaert"/><br /><sub><b>Nicolas Hallaert</b></sub></a><br /><a href="https://github.com/MyUnisoft/events/commits?author=Rossb0b" title="Code">💻</a> <a href="https://github.com/MyUnisoft/events/commits?author=Rossb0b" title="Documentation">📖</a> <a href="https://github.com/MyUnisoft/events/commits?author=Rossb0b" title="Tests">⚠️</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://sofiand.github.io/portfolio-client/"><img src="https://avatars.githubusercontent.com/u/39944043?v=4?s=100" width="100px;" alt="Yefis"/><br /><sub><b>Yefis</b></sub></a><br /><a href="https://github.com/MyUnisoft/events/commits?author=SofianD" title="Code">💻</a> <a href="https://github.com/MyUnisoft/events/commits?author=SofianD" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://www.linkedin.com/in/thomas-gentilhomme/"><img src="https://avatars.githubusercontent.com/u/4438263?v=4?s=100" width="100px;" alt="Gentilhomme"/><br /><sub><b>Gentilhomme</b></sub></a><br /><a href="https://github.com/MyUnisoft/events/commits?author=fraxken" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/PierreDemailly"><img src="https://avatars.githubusercontent.com/u/39910767?v=4?s=100" width="100px;" alt="PierreDemailly"/><br /><sub><b>PierreDemailly</b></sub></a><br /><a href="https://github.com/MyUnisoft/events/commits?author=PierreDemailly" title="Code">💻</a> <a href="https://github.com/MyUnisoft/events/commits?author=PierreDemailly" title="Documentation">📖</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

## License
MIT
