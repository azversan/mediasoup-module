# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-06-21

### Changed

- **Worker initialization** is now opt-in. MediasoupModule only creates workers automatically when workerSettings.workerCount is explicitly configured. This allows applications to manage worker creation manually when desired.

### Documentation

- Updated `README.md` by removing redundant peer dependency installation instructions.
- Updated `SECURITY.md` to indicate that the latest 1.x.x release series receives security updates.

## [1.0.0] - 2026-06-13

### Added

- **Core Mediasoup integration module** for NestJS with synchronous (`register`) and asynchronous (`registerAsync`) configuration, including support for `useFactory`, `useClass`, and `useExisting` patterns.
- **Worker management**: create workers, retrieve by PID, round-robin worker selection with optional PID exclusion, and automatic `WebRtcServer` attachment per worker.
- **Router management**: create routers with automatic load-balanced worker assignment, retrieve by ID, and query routers by worker PID.
- **Transport management**: create `WebRtcTransport`, `PlainTransport`, `PipeTransport`, and `DirectTransport`, with type-safe retrieval via `getTransportById` / `getTransportsByRouterId` overloads.
- **Consumer & Producer management**: create and retrieve `Consumer` and `Producer` instances, with automatic codec capability checks via `router.canConsume`.
- **Data Consumer & Data Producer management**: create and retrieve SCTP-based `DataConsumer` and `DataProducer` instances.
- **RTP Observer management**: create `ActiveSpeakerObserver` and `AudioLevelObserver`, with type-safe retrieval by ID and by router.
- **`ObserverService`**: bridges all native Mediasoup worker/router/transport/producer/consumer/data-channel/RTP-observer events and observer events into a strongly typed NestJS `EventEmitter2` event system.
- **`OnMediasoup` decorator**: type-safe wrapper around `@OnEvent` for subscribing to Mediasoup-specific events.
- **Resource usage telemetry**: automatic increment/decrement tracking of router and worker resource counts (transports, producers, consumers, data producers/consumers, RTP observers).
- **`MediasoupException`**: custom error class with cause-chaining and proper prototype restoration for `instanceof` checks.
- **Centralized resource store** (`ReadonlyMediasoupResourceStore` / `MutableMediasoupResourceStore`) backed by typed `Map` collections for all entity types.
- **Trace event support** for transports, producers, and consumers via module configuration (`transportTrace`, `producerTrace`, `consumerTrace`).
- Constants for worker log tags/levels, transport types, media kinds, DTLS roles, and fingerprint algorithms.
- Initial unit tests for `MediasoupService` (`getWorkerByPid`, `getRouterById`).
- Dual CJS/ESM build output via `tsup`, with full TypeScript declaration files.

### Notes

- Peer dependencies: `@nestjs/common`, `@nestjs/core`, `@nestjs/event-emitter`, `mediasoup` ^3.0.0, and `reflect-metadata`.
