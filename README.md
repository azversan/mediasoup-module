# @azversan/mediasoup

> An open-source NestJS module for [mediasoup](https://mediasoup.org/) — a powerful WebRTC SFU (Selective Forwarding Unit) server framework.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![NestJS](https://img.shields.io/badge/NestJS-%5E10%20%7C%7C%20%5E11-red)](https://nestjs.com)
[![mediasoup](https://img.shields.io/badge/mediasoup-%5E3.0.0-blue)](https://mediasoup.org)

---

- [@azversan/mediasoup](#azversanmediasoup)
  - [Overview](#overview)
  - [Features](#features)
  - [Requirements](#requirements)
  - [Installation](#installation)
  - [Quick Start](#quick-start)
  - [Module Registration](#module-registration)
    - [Synchronous Registration](#synchronous-registration)
    - [Asynchronous Registration](#asynchronous-registration)
  - [Configuration Reference](#configuration-reference)
    - [`MediasoupModuleOptions`](#mediasoupmoduleoptions)
    - [`WorkerSettings` (extended)](#workersettings-extended)
  - [MediasoupService API](#mediasoupservice-api)
    - [Workers](#workers)
      - [`createWorker(settings?)`](#createworkersettings)
      - [`getWorkers(): Worker[]`](#getworkers-worker)
      - [`getWorkerByPid(pid: number): Worker`](#getworkerbypidpid-number-worker)
      - [`getWorkerByRouterId(id: RouterId): Worker`](#getworkerbyrouteridid-routerid-worker)
      - [`getRoundRobinWorker(exceptPid?: number | number[]): Worker`](#getroundrobinworkerexceptpid-number--number-worker)
    - [WebRTC Servers](#webrtc-servers)
      - [`getWebRtcServers(): WebRtcServer[]`](#getwebrtcservers-webrtcserver)
      - [`getWebRtcServerById(id: WebRtcServerId): WebRtcServer`](#getwebrtcserverbyidid-webrtcserverid-webrtcserver)
      - [`getWebRtcServersByWorkerPid(workerPid: number | number[]): WebRtcServer[]`](#getwebrtcserversbyworkerpidworkerpid-number--number-webrtcserver)
    - [Routers](#routers)
      - [`createRouter(options?): Promise<Router>`](#createrouteroptions-promiserouter)
      - [`getRouters(): Router[]`](#getrouters-router)
      - [`getRouterById(id: RouterId): Router`](#getrouterbyidid-routerid-router)
      - [`getRoutersByWorkerPid(workerPid: number): Router[]`](#getroutersbyworkerpidworkerpid-number-router)
    - [Transports](#transports)
      - [`createWebRtcTransport(routerId, options?): Promise<WebRtcTransport>`](#createwebrtctransportrouterid-options-promisewebrtctransport)
      - [`createPlainTransport(routerId, options?): Promise<PlainTransport>`](#createplaintransportrouterid-options-promiseplaintransport)
      - [`createPipeTransport(routerId, options?): Promise<PipeTransport>`](#createpipetransportrouterid-options-promisepipetransport)
      - [`createDirectTransport(routerId, options?): Promise<DirectTransport>`](#createdirecttransportrouterid-options-promisedirecttransport)
      - [`getTransports(): Transport[]`](#gettransports-transport)
      - [`getTransportById(id, type?)`](#gettransportbyidid-type)
      - [`getTransportsByRouterId(id, type?)`](#gettransportsbyrouteridid-type)
    - [Producers \& Consumers](#producers--consumers)
      - [`createProducer(transportId, kind, rtpParameters): Promise<Producer>`](#createproducertransportid-kind-rtpparameters-promiseproducer)
      - [`createConsumer(transportId, producerId, rtpCapabilities): Promise<Consumer>`](#createconsumertransportid-producerid-rtpcapabilities-promiseconsumer)
      - [Getters](#getters)
    - [Data Producers \& Data Consumers](#data-producers--data-consumers)
      - [`createDataProducer(transportId, options?): Promise<DataProducer>`](#createdataproducertransportid-options-promisedataproducer)
      - [`createDataConsumer(transportId, options): Promise<DataConsumer>`](#createdataconsumertransportid-options-promisedataconsumer)
      - [Getters](#getters-1)
    - [RTP Observers](#rtp-observers)
      - [`createActiveSpeakerObserver(routerId, interval?): Promise<ActiveSpeakerObserver>`](#createactivespeakerobserverrouterid-interval-promiseactivespeakerobserver)
      - [`createAudioLevelObserver(routerId, options?): Promise<AudioLevelObserver>`](#createaudiolevelobserverrouterid-options-promiseaudiolevelobserver)
      - [`getRtpObservers(type?)` / `getRtpObserverById(id)` / `getRtpObserversByRouter(routerId, type?)`](#getrtpobserverstype--getrtpobserverbyidid--getrtpobserversbyrouterrouterid-type)
  - [Event System](#event-system)
    - [Listening to Events](#listening-to-events)
    - [Event Reference](#event-reference)
      - [Worker Events](#worker-events)
      - [Router Events](#router-events)
      - [Transport Events](#transport-events)
      - [Consumer Events](#consumer-events)
      - [Producer Events](#producer-events)
      - [Data Consumer Events](#data-consumer-events)
      - [Data Producer Events](#data-producer-events)
      - [RTP Observer Events](#rtp-observer-events)
      - [WebRTC Server Events](#webrtc-server-events)
  - [AppData Schemas](#appdata-schemas)
    - [`WorkerAppData`](#workerappdata)
    - [`RouterAppData`](#routerappdata)
    - [`TransportAppData`](#transportappdata)
    - [`ConsumerProducerAppData`](#consumerproducerappdata)
  - [Architecture](#architecture)
  - [Examples](#examples)
    - [Full WebRTC SFU Flow](#full-webrtc-sfu-flow)
    - [Active Speaker and Audio Level Detection](#active-speaker-and-audio-level-detection)
  - [Contributing](#contributing)
  - [License](#license)

---

## Overview

`@azversan/mediasoup` wraps the native mediasoup library into a fully idiomatic NestJS dynamic module. It handles the lifecycle of Workers, Routers, Transports, Producers, Consumers, RTP Observers, and Data channels — while automatically publishing all mediasoup events onto the NestJS `EventEmitter2` bus, keeping your application code clean and decoupled.

## Features

- **Full mediasoup v3 support** — Workers, Routers, WebRtcTransport, PlainTransport, PipeTransport, DirectTransport, Producers, Consumers, DataProducers, DataConsumers, ActiveSpeakerObserver, AudioLevelObserver, and WebRtcServer.
- **Round-robin worker load balancing** — automatic distribution of Routers across Workers.
- **Resource telemetry** — per-worker and per-router usage counters updated in real time.
- **Global EventEmitter2 bridge** — every mediasoup lifecycle event is translated into a strongly-typed NestJS event.
- **`@OnMediasoup()` decorator** — concise event-listener decorator with full TypeScript inference.
- **Sync & async module registration** — supports `useFactory`, `useClass`, and `useExisting` patterns.
- **Global or scoped module** — register once and expose `MediasoupService` application-wide with `isGlobal: true`.

## Requirements

| Dependency              | Version                |
| ----------------------- | ---------------------- |
| Node.js                 | >= 16                  |
| `@nestjs/common`        | `^10.0.0` or `^11.0.0` |
| `@nestjs/core`          | `^10.0.0` or `^11.0.0` |
| `@nestjs/event-emitter` | `^3.1.0`               |
| `mediasoup`             | `^3.0.0`               |
| `reflect-metadata`      | `^0.1.14` or `^0.2.0`  |

## Installation

```bash
npm install @azversan/mediasoup
```

Ensure peer dependencies are installed:

```bash
npm install @nestjs/event-emitter mediasoup
```

## Quick Start

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { MediasoupModule } from '@azversan/mediasoup';

@Module({
  imports: [
    MediasoupModule.register(
      {
        workerSettings: {
          logLevel: 'warn',
          logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp'],
        },
        mediaCodecs: [
          {
            kind: 'audio',
            mimeType: 'audio/opus',
            clockRate: 48000,
            channels: 2,
          },
          {
            kind: 'video',
            mimeType: 'video/VP8',
            clockRate: 90000,
          },
        ],
        webRtcServer: { enable: false },
      },
      { isGlobal: true },
    ),
  ],
})
export class AppModule {}
```

```typescript
// room.service.ts
import { Injectable } from '@nestjs/common';
import { MediasoupService } from '@azversan/mediasoup';

@Injectable()
export class RoomService {
  constructor(private readonly mediasoup: MediasoupService) {}

  async createRoom() {
    const router = await this.mediasoup.createRouter();
    return router.id;
  }

  async createSendTransport(routerId: string) {
    return this.mediasoup.createWebRtcTransport(routerId, {
      listenIps: [{ ip: '0.0.0.0', announcedIp: '192.168.1.100' }],
      enableUdp: true,
      enableTcp: true,
    });
  }
}
```

## Module Registration

### Synchronous Registration

```typescript
MediasoupModule.register(options: MediasoupModuleOptions, globalOptions?: MediasoupModuleGlobalOptions)
```

```typescript
MediasoupModule.register(
  {
    workerSettings: { logLevel: 'warn', workerCount: 4 },
    webRtcServer: { enable: false },
  },
  { isGlobal: true },
);
```

### Asynchronous Registration

```typescript
MediasoupModule.registerAsync(asyncOptions: MediasoupModuleAsyncOptions)
```

**Using `useFactory`:**

```typescript
MediasoupModule.registerAsync({
  isGlobal: true,
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    workerSettings: {
      logLevel: config.get('MEDIASOUP_LOG_LEVEL'),
      workerCount: config.get<number>('MEDIASOUP_WORKER_COUNT'),
    },
    webRtcTransportOptions: {
      listenIps: [{ ip: '0.0.0.0', announcedIp: config.get('ANNOUNCED_IP') }],
      enableUdp: true,
      enableTcp: true,
    },
    webRtcServer: { enable: false },
  }),
});
```

**Using `useClass`:**

```typescript
@Injectable()
export class MediasoupConfigService implements MediasoupOptionsFactory {
  createMediasoupOptions(): MediasoupModuleOptions {
    return {
      workerSettings: { logLevel: 'warn' },
      webRtcServer: { enable: false },
    };
  }
}

MediasoupModule.registerAsync({
  useClass: MediasoupConfigService,
});
```

## Configuration Reference

### `MediasoupModuleOptions`

| Field                    | Type                                                                    | Required | Description                                                                                                           |
| ------------------------ | ----------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------- |
| `workerSettings`         | `WorkerSettings`                                                        | ✅       | Settings passed to `mediasoup.createWorker()`. Includes optional `workerCount` (defaults to `Math.max(1, cpus - 1)`). |
| `mediaCodecs`            | `RouterRtpCodecCapability[]`                                            | ❌       | Default media codecs for all routers created via `createRouter()`.                                                    |
| `webRtcServer`           | `{ enable: true; options: WebRtcServerOptions }` or `{ enable: false }` | ✅       | If enabled, a `WebRtcServer` is created per worker on bootstrap using port-offset strategy.                           |
| `webRtcTransportOptions` | `Omit<WebRtcTransportOptions, 'appData'>`                               | ❌       | Default options merged into every `createWebRtcTransport()` call.                                                     |
| `plainTransportOptions`  | `Omit<PlainTransportOptions, 'appData'>`                                | ❌       | Default options for `createPlainTransport()`.                                                                         |
| `pipeTransportOptions`   | `Omit<PipeTransportOptions, 'appData'>`                                 | ❌       | Default options for `createPipeTransport()`.                                                                          |
| `directTransportOptions` | `Omit<DirectTransportOptions, 'appData'>`                               | ❌       | Default options for `createDirectTransport()`.                                                                        |
| `transportTrace`         | `{ enable: boolean; events: TransportTraceEventType[] }`                | ❌       | Enable trace events on all new transports.                                                                            |
| `consumerTrace`          | `{ enable: boolean; events: ConsumerTraceEventType[] }`                 | ❌       | Enable trace events on all new consumers.                                                                             |
| `producerTrace`          | `{ enable: boolean; events: ProducerTraceEventType[] }`                 | ❌       | Enable trace events on all new producers.                                                                             |

### `WorkerSettings` (extended)

All native mediasoup `WorkerSettings` fields plus:

| Field         | Type     | Default                 | Description                                       |
| ------------- | -------- | ----------------------- | ------------------------------------------------- |
| `workerCount` | `number` | `Math.max(1, cpus - 1)` | Number of Worker processes to spawn on bootstrap. |

## MediasoupService API

Inject `MediasoupService` into any provider to access the full mediasoup resource API.

```typescript
constructor(private readonly mediasoup: MediasoupService) {}
```

### Workers

#### `createWorker(settings?)`

Spawns a new mediasoup Worker process. If `webRtcServer.enable` is `true`, a `WebRtcServer` is automatically created on the worker.

```typescript
const worker = await this.mediasoup.createWorker({ logLevel: 'debug' });
```

#### `getWorkers(): Worker[]`

Returns all active Workers.

#### `getWorkerByPid(pid: number): Worker`

Finds a Worker by its OS Process ID. Throws `MediasoupException` if not found.

#### `getWorkerByRouterId(id: RouterId): Worker`

Finds the Worker hosting a specific Router.

#### `getRoundRobinWorker(exceptPid?: number | number[]): Worker`

Returns a Worker using round-robin load balancing. Optionally exclude specific PIDs.

```typescript
// Get any available worker
const worker = this.mediasoup.getRoundRobinWorker();

// Exclude specific workers
const worker = this.mediasoup.getRoundRobinWorker([1234, 5678]);
```

### WebRTC Servers

#### `getWebRtcServers(): WebRtcServer[]`

Returns all active `WebRtcServer` instances.

#### `getWebRtcServerById(id: WebRtcServerId): WebRtcServer`

Finds a `WebRtcServer` by ID. Throws if not found.

#### `getWebRtcServersByWorkerPid(workerPid: number | number[]): WebRtcServer[]`

Returns all `WebRtcServer` instances belonging to specified Worker PID(s).

### Routers

#### `createRouter(options?): Promise<Router>`

Creates a Router. Uses round-robin Worker selection by default.

```typescript
// Auto-select worker
const router = await this.mediasoup.createRouter();

// Specific worker
const router = await this.mediasoup.createRouter({ worker: myWorker });

// Exclude worker PIDs
const router = await this.mediasoup.createRouter({ exceptWorkerPid: [1234] });

// Custom codecs
const router = await this.mediasoup.createRouter({
  mediaCodecs: [{ kind: 'audio', mimeType: 'audio/opus', clockRate: 48000, channels: 2 }],
});
```

#### `getRouters(): Router[]`

Returns all active Routers.

#### `getRouterById(id: RouterId): Router`

Finds a Router by ID. Throws if not found.

#### `getRoutersByWorkerPid(workerPid: number): Router[]`

Returns all Routers on a specific Worker.

### Transports

All transport creation methods merge module-level defaults with per-call overrides. The `appData` field is managed internally and should not be supplied.

#### `createWebRtcTransport(routerId, options?): Promise<WebRtcTransport>`

```typescript
const transport = await this.mediasoup.createWebRtcTransport(router.id, {
  listenIps: [{ ip: '0.0.0.0', announcedIp: '1.2.3.4' }],
  enableUdp: true,
  enableTcp: true,
  preferUdp: true,
});
```

#### `createPlainTransport(routerId, options?): Promise<PlainTransport>`

For RTP/RTCP-based integrations (e.g. FFmpeg, GStreamer, SIP gateways).

#### `createPipeTransport(routerId, options?): Promise<PipeTransport>`

For piping media between Routers (e.g. across different Workers or servers).

#### `createDirectTransport(routerId, options?): Promise<DirectTransport>`

For intra-process media relaying without network overhead.

#### `getTransports(): Transport[]`

Returns all active Transports.

#### `getTransportById(id, type?)`

```typescript
// Generic base type
const transport = this.mediasoup.getTransportById(id);

// Typed variant
const webrtc = this.mediasoup.getTransportById(id, 'webrtc'); // WebRtcTransport
const plain = this.mediasoup.getTransportById(id, 'plain'); // PlainTransport
const pipe = this.mediasoup.getTransportById(id, 'pipe'); // PipeTransport
const direct = this.mediasoup.getTransportById(id, 'direct'); // DirectTransport
```

Throws `MediasoupException` if not found or type mismatch.

#### `getTransportsByRouterId(id, type?)`

Returns all transports on a Router, optionally filtered by type.

### Producers & Consumers

#### `createProducer(transportId, kind, rtpParameters): Promise<Producer>`

Sets the transport's `appData.direction` to `'send'`.

```typescript
const producer = await this.mediasoup.createProducer(transportId, 'video', rtpParameters);
```

#### `createConsumer(transportId, producerId, rtpCapabilities): Promise<Consumer>`

Sets the transport's `appData.direction` to `'recv'`. Validates codec compatibility first.

```typescript
const consumer = await this.mediasoup.createConsumer(transportId, producerId, peerRtpCapabilities);
```

#### Getters

```typescript
this.mediasoup.getProducers(): Producer[]
this.mediasoup.getProducerById(id: string): Producer
this.mediasoup.getConsumers(): Consumer[]
this.mediasoup.getConsumerById(id: string): Consumer
```

### Data Producers & Data Consumers

#### `createDataProducer(transportId, options?): Promise<DataProducer>`

#### `createDataConsumer(transportId, options): Promise<DataConsumer>`

#### Getters

```typescript
this.mediasoup.getDataProducers(): DataProducer[]
this.mediasoup.getDataProducerById(id: DataProducerId): DataProducer
this.mediasoup.getDataConsumers(): DataConsumer[]
this.mediasoup.getDataConsumerById(id: DataConsumerId): DataConsumer
```

### RTP Observers

#### `createActiveSpeakerObserver(routerId, interval?): Promise<ActiveSpeakerObserver>`

Monitors audio streams to detect the dominant speaker.

```typescript
const observer = await this.mediasoup.createActiveSpeakerObserver(router.id, 300);
```

#### `createAudioLevelObserver(routerId, options?): Promise<AudioLevelObserver>`

Reports per-producer audio volume levels.

```typescript
const observer = await this.mediasoup.createAudioLevelObserver(router.id, {
  maxEntries: 1,
  threshold: -80,
  interval: 800,
});
```

#### `getRtpObservers(type?)` / `getRtpObserverById(id)` / `getRtpObserversByRouter(routerId, type?)`

```typescript
// All observers
const all = this.mediasoup.getRtpObservers();

// Filtered by type
const audioLevel = this.mediasoup.getRtpObservers('audiolevel'); // AudioLevelObserver[]
const speaker = this.mediasoup.getRtpObservers('activespeaker'); // ActiveSpeakerObserver[]

// By router
const routerObservers = this.mediasoup.getRtpObserversByRouter(routerId);
```

## Event System

### Listening to Events

Use the `@OnMediasoup()` decorator to subscribe to any mediasoup lifecycle event with full TypeScript type inference.

```typescript
import { Injectable } from '@nestjs/common';
import { OnMediasoup, MediasoupEventData } from '@azversan/mediasoup';

@Injectable()
export class MediaEventsService {
  @OnMediasoup('WorkerCreated')
  onWorkerCreated(data: MediasoupEventData<'WorkerCreated'>) {
    console.log(`Worker spawned: PID ${data.pid}`);
  }

  @OnMediasoup('ProducerCreated')
  onProducerCreated(data: MediasoupEventData<'ProducerCreated'>) {
    console.log(`New producer: ${data.id}`);
  }

  @OnMediasoup('ConsumerLayersChange')
  onLayersChange(data: MediasoupEventData<'ConsumerLayersChange'>) {
    console.log(`Consumer ${data.id} layers:`, data.data);
  }

  @OnMediasoup('RtpObserverDominantSpeaker')
  onDominantSpeaker(data: MediasoupEventData<'RtpObserverDominantSpeaker'>) {
    console.log(`Dominant speaker changed:`, data.data.producer.id);
  }
}
```

`@OnMediasoup` is a thin wrapper over `@OnEvent` from `@nestjs/event-emitter`.

### Event Reference

#### Worker Events

| Event                         | Payload                                  |
| ----------------------------- | ---------------------------------------- |
| `WorkerCreated`               | `{ pid }`                                |
| `WorkerClose`                 | `{ pid }`                                |
| `WorkerDied`                  | `{ pid, data: { error } }`               |
| `WorkerSubProcessClose`       | `{ pid }`                                |
| `WorkerListenerError`         | `{ pid, data: { event, error } }`        |
| `WorkerResourceUsageAdjusted` | `{ pid, data: { action, type, count } }` |

#### Router Events

| Event                         | Payload                                 |
| ----------------------------- | --------------------------------------- |
| `RouterCreated`               | `{ id }`                                |
| `RouterClose`                 | `{ id }`                                |
| `RouterWorkerClose`           | `{ id }`                                |
| `RouterListenerError`         | `{ id, data: { event, error } }`        |
| `RouterResourceUsageAdjusted` | `{ id, data: { action, type, count } }` |

#### Transport Events

| Event                           | Payload                                 |
| ------------------------------- | --------------------------------------- |
| `TransportCreated`              | `{ id }`                                |
| `TransportClose`                | `{ id }`                                |
| `TransportRouterClose`          | `{ id }`                                |
| `TransportListenServerClose`    | `{ id }`                                |
| `TransportTrace`                | `{ id, data: TransportTraceEventData }` |
| `WebRtcIceStateChange`          | `{ id, data: IceState }`                |
| `WebRtcIceSelectedTupleChange`  | `{ id, data: TransportTuple }`          |
| `WebRtcDtlsChange`              | `{ id, data: DtlsState }`               |
| `WebRtcSctpStateChange`         | `{ id, data: SctpState }`               |
| `PlainTransportTuple`           | `{ id, data: TransportTuple }`          |
| `PlainTransportRtcpTuple`       | `{ id, data: TransportTuple }`          |
| `PlainTransportSctpStateChange` | `{ id, data: SctpState }`               |
| `PipeTransportSctpStateChange`  | `{ id, data: SctpState }`               |
| `DirectTransportRtcp`           | `{ id, data: Buffer }`                  |

#### Consumer Events

| Event                                              | Payload                                     |
| -------------------------------------------------- | ------------------------------------------- |
| `ConsumerCreated`                                  | `{ id }`                                    |
| `ConsumerClose`                                    | `{ id }`                                    |
| `ConsumerPause` / `ConsumerResume`                 | `{ id }`                                    |
| `ConsumerTransportClose`                           | `{ id }`                                    |
| `ConsumerProducerClose`                            | `{ id }`                                    |
| `ConsumerProducerPause` / `ConsumerProducerResume` | `{ id }`                                    |
| `ConsumerScore`                                    | `{ id, data: ConsumerScore }`               |
| `ConsumerLayersChange`                             | `{ id, data: ConsumerLayers \| undefined }` |
| `ConsumerTrace`                                    | `{ id, data: ConsumerTraceEventData }`      |
| `ConsumerRtp`                                      | `{ id, data: Buffer }`                      |

#### Producer Events

| Event                              | Payload                                  |
| ---------------------------------- | ---------------------------------------- |
| `ProducerCreated`                  | `{ id }`                                 |
| `ProducerClose`                    | `{ id }`                                 |
| `ProducerPause` / `ProducerResume` | `{ id }`                                 |
| `ProducerTransportClose`           | `{ id }`                                 |
| `ProducerScore`                    | `{ id, data: ProducerScore[] }`          |
| `ProducerTrace`                    | `{ id, data: ProducerTraceEventData }`   |
| `ProducerVideoOrientationChange`   | `{ id, data: ProducerVideoOrientation }` |

#### Data Consumer Events

| Event                                      | Payload                                           |
| ------------------------------------------ | ------------------------------------------------- |
| `DataConsumerCreated`                      | `{ id }`                                          |
| `DataConsumerClose`                        | `{ id }`                                          |
| `DataConsumerPause` / `DataConsumerResume` | `{ id }`                                          |
| `DataConsumerMessage`                      | `{ id, data: { message: Buffer, ppid: number } }` |
| `DataConsumerSctpSendBufferFull`           | `{ id }`                                          |
| `DataConsumerBufferedAmountLow`            | `{ id, data: number }`                            |

#### Data Producer Events

| Event                                      | Payload  |
| ------------------------------------------ | -------- |
| `DataProducerCreated`                      | `{ id }` |
| `DataProducerClose`                        | `{ id }` |
| `DataProducerPause` / `DataProducerResume` | `{ id }` |
| `DataProducerTransportClose`               | `{ id }` |

#### RTP Observer Events

| Event                                    | Payload                                              |
| ---------------------------------------- | ---------------------------------------------------- |
| `RtpObserverCreated`                     | `{ id }`                                             |
| `RtpObserverClose`                       | `{ id }`                                             |
| `RtpObserverPause` / `RtpObserverResume` | `{ id }`                                             |
| `RtpObserverSilence`                     | `{ id }`                                             |
| `RtpObserverVolumes`                     | `{ id, data: AudioLevelObserverVolume[] }`           |
| `RtpObserverDominantSpeaker`             | `{ id, data: ActiveSpeakerObserverDominantSpeaker }` |

#### WebRTC Server Events

| Event                            | Payload                         |
| -------------------------------- | ------------------------------- |
| `WebRtcServerCreated`            | `{ id }`                        |
| `WebRtcServerClose`              | `{ id }`                        |
| `WebRtcServerTransportHandled`   | `{ id, data: WebRtcTransport }` |
| `WebRtcServerTransportUnhandled` | `{ id, data: WebRtcTransport }` |

## AppData Schemas

The module attaches structured `appData` to every mediasoup entity for telemetry and routing.

### `WorkerAppData`

```typescript
{
  count: {
    routers: number;
    transports: number;
    producers: number;
    consumers: number;
    rtpObservers: number;
    dataProducers: number;
    dataConsumers: number;
  }
  timestamp: number; // Unix ms — when the worker was created
}
```

### `RouterAppData`

```typescript
{
  workerPid: number;
  timestamp: number;
  count: {
    transports: number;
    producers: number;
    consumers: number;
    rtpObservers: number;
    dataProducers: number;
    dataConsumers: number;
  }
}
```

### `TransportAppData`

```typescript
{
  routerId: string;
  timestamp: number;
  direction?: 'send' | 'recv'; // set automatically on produce/consume
  connected: boolean;
  reconnectCount: number;
  lastConnectedAt?: number;
  lastDisconnectedAt?: number;
}
```

### `ConsumerProducerAppData`

```typescript
{
  routerId: string;
  transportId: string;
  timestamp: number;
}
```

## Architecture

```
MediasoupModule
├── MediasoupService       — Public API: create & query all resources
├── ObserverService        — Internal: hooks into mediasoup native observers,
│                            updates resource store, emits typed NestJS events
├── ResourceStoreProvider  — Shared Map-based registry for all entities

EventEmitter2 (global)
└── All mediasoup events → strongly-typed NestJS events
    └── @OnMediasoup() decorator for easy subscription
```

**Lifecycle:**

1. On `onApplicationBootstrap`, the module spawns `workerCount` Workers.
2. The global `mediasoup.observer` fires `newworker` for each Worker.
3. `ObserverService.observer()` is called, which registers the Worker in the store, sets up all nested event hooks (Router → Transport → Producer/Consumer → RtpObserver), and starts emitting NestJS events.
4. On `onApplicationShutdown`, all Workers are closed gracefully.

## Examples

### Full WebRTC SFU Flow

```typescript
// 1. Create a router
const router = await mediasoup.createRouter();

// 2. Create send transport for publisher
const sendTransport = await mediasoup.createWebRtcTransport(router.id, {
  listenIps: [{ ip: '0.0.0.0', announcedIp: process.env.ANNOUNCED_IP }],
  enableUdp: true,
  enableTcp: true,
});

// 3. Create producer (after client calls transport.produce())
const producer = await mediasoup.createProducer(sendTransport.id, 'video', clientRtpParameters);

// 4. Create recv transport for subscriber
const recvTransport = await mediasoup.createWebRtcTransport(router.id, {
  listenIps: [{ ip: '0.0.0.0', announcedIp: process.env.ANNOUNCED_IP }],
  enableUdp: true,
});

// 5. Create consumer
const consumer = await mediasoup.createConsumer(recvTransport.id, producer.id, subscriberRtpCapabilities);
```

### Active Speaker and Audio Level Detection

```typescript
@OnMediasoup('RouterCreated')
async handleRouterCrated(payload: MediasoupEventData<'RouterCreated'>) {
 await this.mediasoup.createAudioLevelObserver(payload.id);
 await this.mediasoup.createActiveSpeakerObserver(payload.id);
}

@OnMediasoup('ProducerCreated')
async handleProducerCreated(payload: MediasoupEventData<'ProducerCreated'>) {
 const { id, appData } = this.mediasoup.getProducerById(payload.id);
 const router = this.mediasoup.getRouterById(appData.routerId);
 const routerRtp = this.mediasoup.getRtpObserversByRouter(router.id);
 const observers = routerRtp.map((r) => r.addProducer({ producerId: id }));

 await Promise.allSettled(observers);
}
```

```typescript
@OnMediasoup('RtpObserverVolumes')
handleObserverVolumes(payload: MediasoupEventData<'RtpObserverVolumes'>) {
 // implementation
}
```

```typescript
@OnMediasoup('RtpObserverSilence')
handleObserverSilence(payload: MediasoupEventData<'RtpObserverSilence'>) {
 // implementation
}
```

```typescript
@OnMediasoup('RtpObserverDominantSpeaker')
handleDominantSpeaker(payload: MediasoupEventData<'RtpObserverDominantSpeaker'>) {
 // implementation
}
```

## Contributing

Contributions are welcome! Please open an issue or pull request on [GitHub](https://github.com/azversan/mediasoup-module).

## License

[MIT](https://github.com/azversan/mediasoup-module/blob/main/LICENSE)
