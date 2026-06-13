import { Inject, Injectable } from '@nestjs/common';
import { createWorker, types } from 'mediasoup';
import { MediasoupException } from '@/mediasoup/mediasoup.exception';
import { MediasoupToken } from '@/mediasoup/mediasoup.interface';
import type {
  AllRtpObservers,
  Consumer,
  ConsumerProducerAppData,
  DataConsumer,
  DataConsumerId,
  DataConsumerOptions,
  DataProducer,
  DataProducerId,
  DataProducerOptions,
  DirectTransport,
  DirectTransportOptions,
  MediasoupModuleOptions,
  PipeTransport,
  PipeTransportOptions,
  PlainTransportOptions,
  Producer,
  ProducerId,
  ReadonlyMediasoupResourceStore,
  Router,
  RouterId,
  RouterOptions,
  RouterResourceAppData,
  RtpObserver,
  RtpObserverMap,
  Transport,
  TransportAppData,
  TransportDirection,
  TransportId,
  TransportMap,
  WebRtcServer,
  WebRtcServerAppData,
  WebRtcServerId,
  WebRtcTransport,
  WebRtcTransportOptions,
  Worker,
  WorkerAppData,
  WorkerSettings,
} from '@/mediasoup/mediasoup.interface';

/**
 * Service responsible for managing core entities such as Workers, Routers, Transports,
 * Producers, Consumers, and RTP/Data sub-resources.
 * Acts as the primary API interface for creating and retrieving components within the module framework.
 */
@Injectable()
export class MediasoupService {
  private currentWorker: number = 0;
  /**
   * Creates an instance of MediasoupService.
   * @param store - Read-only reference store containing active resource maps.
   * @param options - Core module configurations including transport configurations and server states.
   */
  constructor(
    @Inject(MediasoupToken.RESOURCE_STORE) private store: ReadonlyMediasoupResourceStore,
    @Inject(MediasoupToken.MODULE_OPTIONS) private options: MediasoupModuleOptions,
  ) {}

  //#region Worker

  /**
   * Asynchronously spins up a new Worker process instance.
   * Optionally attaches a WebRtcServer to the worker if configured in module options.
   * @param settings - Configuration overrides for the underlying worker process.
   * @returns A promise that resolves to the newly initialized Worker instance.
   */
  async createWorker(settings?: Omit<WorkerSettings, 'appData'>): Promise<Worker> {
    const { webRtcServer, workerSettings } = this.options;
    const worker = await createWorker<WorkerAppData>({
      appData: {
        count: {
          routers: 0,
          consumers: 0,
          producers: 0,
          transports: 0,
          rtpObservers: 0,
          dataConsumers: 0,
          dataProducers: 0,
        },
        timestamp: Date.now(),
      },
      ...workerSettings,
      ...settings,
    });

    if (webRtcServer.enable) {
      const portOffset = this.store.workers.size - 1;
      const listenInfos = webRtcServer.options.listenInfos.map((info) => ({
        ...info,
        port: info.port ? info.port + portOffset : undefined,
      }));

      await worker.createWebRtcServer<WebRtcServerAppData>({
        listenInfos,
        appData: {
          timestamp: Date.now(),
          workerPid: worker.pid,
        },
      });
    }

    return worker;
  }

  /**
   * Retrieves all currently active and tracked Workers from the central store.
   * @returns An array containing Worker instances.
   */
  getWorkers(): Worker[] {
    return Array.from(this.store.workers.values());
  }

  /**
   * Locates a specific Worker by its OS Process ID (PID).
   * @param pid - The OS Process ID of the targeted worker.
   * @returns The matched Worker instance.
   * @throws {MediasoupException} If no worker matches the provided PID.
   */
  getWorkerByPid(pid: number): Worker {
    const worker = this.store.workers.get(pid);

    if (!worker) {
      throw new MediasoupException(`Worker with PID ${pid} not found`);
    }

    return worker;
  }

  /**
   * Identifies the parent Worker that hosts a specific Router.
   * @param id - The unique identifier of the target Router.
   * @returns The Worker instance managing the specified Router.
   */
  getWorkerByRouterId(id: RouterId): Worker {
    const { appData } = this.getRouterById(id);
    return this.getWorkerByPid(appData.workerPid);
  }

  /**
   * Selects a Worker using a basic round-robin algorithm for resource load-balancing.
   * Can conditionally filter out specific PIDs if exclusion parameters are passed.
   * @param exceptPid - Optional single PID or array of PIDs to exclude from selection.
   * @returns A balanced or randomly targeted Worker instance.
   * @throws {MediasoupException} If no workers are available or exclusion criteria leaves empty sets.
   */
  getRoundRobinWorker(exceptPid?: number | number[]): Worker {
    const workers = [...this.store.workers.values()];

    if (exceptPid) {
      const availableWorkers = workers.filter((worker) => {
        return Array.isArray(exceptPid) ? !exceptPid.includes(worker.pid) : worker.pid !== exceptPid;
      });

      if (availableWorkers.length === 0) {
        throw new MediasoupException('Worker limit exceed');
      }

      const index = Math.floor(Math.random() * availableWorkers.length);
      return availableWorkers[index];
    }

    this.currentWorker = this.currentWorker % workers.length;
    const worker = workers[this.currentWorker];

    if (!worker) {
      throw new MediasoupException('No workers available');
    }

    this.currentWorker = (this.currentWorker + 1) % workers.length;

    return worker;
  }

  //#endregion

  //#region WebRTC Server

  /**
   * Retrieves all currently active and tracked WebRtcServer instances from the central store.
   * @returns An array containing WebRtcServer instances.
   */
  getWebRtcServers(): WebRtcServer[] {
    return Array.from(this.store.webRtcServers.values());
  }

  /**
   * Locates a specific WebRtcServer by its unique identifier.
   * @param id - The unique identifier of the targeted WebRtcServer.
   * @returns The matched WebRtcServer instance.
   * @throws {MediasoupException} If no WebRtcServer matches the provided ID.
   */
  getWebRtcServerById(id: WebRtcServerId): WebRtcServer {
    const webRtcServer = this.store.webRtcServers.get(id);

    if (!webRtcServer) {
      throw new MediasoupException(`Webrtc server with ID ${id} not found`);
    }

    return webRtcServer;
  }

  /**
   * Retrieves all WebRtcServer instances associated with one or more specific Worker PIDs.
   * @param workerPid - A single Worker PID or an array of Worker PIDs to filter by.
   * @returns An array of WebRtcServer instances whose parent Worker PID matches the provided value(s).
   */
  getWebRtcServersByWorkerPid(workerPid: number | number[]): WebRtcServer[] {
    const webRtcServers = this.getWebRtcServers();

    return webRtcServers.filter(({ appData }) => {
      if (Array.isArray(workerPid)) {
        return workerPid.includes(appData.workerPid);
      }

      return appData.workerPid === workerPid;
    });
  }

  //#endregion

  //#region Router

  /**
   * Spawns an internal media Router on a worker.
   * Balances automatically across available workers unless a target worker or exception rule is explicit.
   * @param options - Configuration arguments, explicit parent Worker assignments, or exclusion criteria.
   * @returns A promise that resolves to the newly generated Router instance.
   */
  async createRouter(options?: Omit<RouterOptions, 'appData'>): Promise<Router> {
    const { mediaCodecs } = this.options;
    const worker = options?.worker || this.getRoundRobinWorker(options?.exceptWorkerPid);
    const router = await worker.createRouter({
      appData: {
        count: {
          consumers: 0,
          producers: 0,
          transports: 0,
          rtpObservers: 0,
          dataConsumers: 0,
          dataProducers: 0,
        },
        timestamp: Date.now(),
        workerPid: worker.pid,
      },
      mediaCodecs: options?.mediaCodecs ?? mediaCodecs,
    });

    return router;
  }

  /**
   * Fetches all Routers currently registered and active within the application.
   * @returns An array containing Router instances.
   */
  getRouters(): Router[] {
    return Array.from(this.store.routers.values());
  }

  /**
   * Retrieves an explicit Router from the registry using its unique ID.
   * @param id - The unique Router string ID.
   * @returns The corresponding Router instance.
   * @throws {MediasoupException} If no Router is found matching the provided ID.
   */
  getRouterById(id: RouterId): Router {
    const router = this.store.routers.get(id);

    if (!router) {
      throw new MediasoupException(`Router with ID ${id} not found`);
    }

    return router;
  }

  /**
   * Retrieves all Routers currently allocated to a specific Worker PID.
   * @param workerPid - The process ID of the parent worker.
   * @returns An array of filtered Router instances.
   */
  getRoutersByWorkerPid(workerPid: number): Router[] {
    const routers = Array.from(this.store.routers.values());
    return routers.filter(({ appData }) => appData.workerPid === workerPid);
  }

  //#endregion

  //#region Transport

  /**
   * Internal utility to establish standard metadata (AppData structures) for structural pipeline tracking.
   * @param routerId - The unique ID of the target Router.
   * @param direction - Optional context direction ('send' or 'recv').
   * @returns The baseline metadata object for a Transport.
   */
  private initTransportAppData(routerId: RouterId, direction?: TransportDirection): TransportAppData {
    return {
      routerId,
      direction,
      timestamp: Date.now(),
      connected: false,
      reconnectCount: 0,
    };
  }

  /**
   * Creates a DirectTransport on the specified Router for intra-process/local application-level media relaying.
   * @param routerId - The unique ID of the hosting Router.
   * @param transportOptions - Contextual transport setup parameters.
   * @returns A promise that resolves to the DirectTransport instance.
   */
  async createDirectTransport(routerId: RouterId, transportOptions?: DirectTransportOptions): Promise<DirectTransport> {
    const router = this.getRouterById(routerId);
    const appData = this.initTransportAppData(routerId);
    const options: DirectTransportOptions = {
      maxMessageSize: 262144,
      ...this.options.directTransportOptions,
      ...transportOptions,
      appData: {
        ...appData,
        ...transportOptions?.appData,
      },
    };
    const transport = await router.createDirectTransport<TransportAppData>(options);

    return transport;
  }

  /**
   * Creates a PipeTransport on the specified Router, used for bridging media streams between separate Routers.
   * @param routerId - The unique ID of the hosting Router.
   * @param transportOptions - Inter-router connection parameters.
   * @returns A promise that resolves to the PipeTransport instance.
   */
  async createPipeTransport(routerId: RouterId, transportOptions?: PipeTransportOptions): Promise<PipeTransport> {
    const router = this.getRouterById(routerId);
    const appData = this.initTransportAppData(routerId);
    const options = {
      ...this.options.pipeTransportOptions,
      ...transportOptions,
      appData: {
        ...appData,
        ...transportOptions?.appData,
      },
    } as PipeTransportOptions;
    const transport = await router.createPipeTransport<TransportAppData>(options);

    return transport;
  }

  /**
   * Creates a PlainTransport on the specified Router for raw RTP/RTCP-based network integrations (e.g., FFmpeg, SIP gateways).
   * @param routerId - The unique ID of the hosting Router.
   * @param transportOptions - Low-level networking configurations (IP, Ports, etc.).
   * @returns A promise that resolves to the raw PlainTransport instance.
   */
  async createPlainTransport(routerId: RouterId, transportOptions?: PlainTransportOptions) {
    const router = this.getRouterById(routerId);
    const appData = this.initTransportAppData(routerId);
    const options = {
      ...this.options.plainTransportOptions,
      ...transportOptions,
      appData: {
        ...appData,
        ...transportOptions?.appData,
      },
    } as PlainTransportOptions;
    const transport = await router.createPlainTransport<TransportAppData>(options);

    return transport;
  }

  /**
   * Creates a WebRtcTransport on the specified Router, establishing connection anchors for client browser peers.
   * @param routerId - The unique ID of the hosting Router.
   * @param transportOptions - WebRTC specific options like ICE, DTLS setup.
   * @returns A promise that resolves to the WebRtcTransport endpoint instance.
   */
  async createWebRtcTransport(routerId: RouterId, transportOptions?: WebRtcTransportOptions): Promise<WebRtcTransport> {
    const router = this.getRouterById(routerId);
    const appData = this.initTransportAppData(routerId);
    const options = {
      ...this.options.webRtcTransportOptions,
      ...transportOptions,
      appData: {
        ...appData,
        ...transportOptions?.appData,
      },
    } as WebRtcTransportOptions;
    const transport = await router.createWebRtcTransport(options);

    return transport;
  }

  /**
   * Fetches every abstract Transport layer currently hosted inside the tracking store.
   * @returns An array containing various active Transport instances.
   */
  getTransports(): Transport[] {
    return Array.from(this.store.transports.values());
  }

  /**
   * Fetches a specific Transport instance using its unique ID.
   * @param id - The target transport's unique ID.
   * @returns The requested Transport instance.
   * @throws {MediasoupException} If no transport is found matching the provided ID.
   */
  getTransportById(id: TransportId): Transport;

  /**
   * Fetches a specific Transport instance using its unique ID, cast to the intended specialized subtype.
   * @template T - Explicit subclass extension of standard Transport.
   * @param id - The target transport's unique ID.
   * @param type - The specific transport type to validate against and cast.
   * @returns The requested Transport instance cast to the specific type.
   * @throws {MediasoupException} If no transport is found, or if the actual type does not match the requested type.
   */
  getTransportById<T extends types.TransportType>(id: TransportId, type: T): TransportMap[T];
  getTransportById<T extends types.TransportType>(id: TransportId, type?: T) {
    const transport = this.store.transports.get(id);

    if (!transport) {
      throw new MediasoupException(`Transport with ID ${id} not found`);
    }

    if (type && transport.type !== type) {
      throw new MediasoupException(`Transport with ID ${id} is not of type ${type}`);
    }

    return transport as T extends types.TransportType ? TransportMap[T] : Transport;
  }

  /**
   * Fetches all Transports linked to a target Router.
   * @param id - The unique identifier of the target Router.
   * @returns An array containing various active Transport instances.
   */
  getTransportsByRouterId(id: RouterId): Transport[];

  /**
   * Fetches Transports linked to a target Router, filtered by a specific transport type.
   * @template T - Explicit subclass extension of standard Transport type.
   * @param id - The unique identifier of the target Router.
   * @param type - The specific structural Transport type to filter by.
   * @returns An array of the requested Transport instances cast to the specific type.
   */
  getTransportsByRouterId<T extends types.TransportType>(id: RouterId, type: T): TransportMap[T][];
  getTransportsByRouterId<T extends types.TransportType>(id: RouterId, type?: T) {
    const list = Array.from(this.store.transports.values());
    const transports = list.filter((transport) => {
      const { appData } = transport;
      return appData.routerId === id && (!type || transport.type === type);
    });

    return transports as T extends types.TransportType ? TransportMap[T][] : Transport[];
  }

  //#endregion

  //#region Consumer

  /**
   * Instructs a designated transport to consume a known producer stream, delivering media traffic downward.
   * Switches the internal transport app data pipeline tracker direction to 'recv'.
   * @param transportId - The receiver transport's unique ID.
   * @param producerId - The upstream source Producer ID.
   * @param rtpCapabilities - WebRTC client capabilities parameter required to select correct codecs.
   * @returns A promise that resolves to the initialized downlink Consumer instance.
   */
  async createConsumer(transportId: TransportId, producerId: ProducerId, rtpCapabilities: types.RtpCapabilities): Promise<Consumer> {
    const transport = this.getTransportById(transportId);
    const { appData } = transport;
    const router = this.getRouterById(appData.routerId);
    const canConsume = router.canConsume({ producerId, rtpCapabilities });

    if (!canConsume) {
      throw new MediasoupException(`Router cannot consume producer ${producerId} with given rtpCapabilities`);
    }

    const consumer = await transport.consume<ConsumerProducerAppData>({
      appData: {
        routerId: appData.routerId,
        timestamp: Date.now(),
        transportId,
      },
      producerId,
      rtpCapabilities,
    });
    transport.appData.direction = 'recv';

    return consumer;
  }

  /**
   * Fetches all Consumers currently managed across all endpoints.
   * @returns An array containing active Consumer instances.
   */
  getConsumers(): Consumer[] {
    return Array.from(this.store.consumers.values());
  }

  /**
   * Fetches an explicit Consumer instance matching the provided ID.
   * @param id - The unique Consumer string ID.
   * @returns The corresponding Consumer instance.
   * @throws {MediasoupException} If no Consumer is found matching the provided ID.
   */
  getConsumerById(id: string): Consumer {
    const consumer = this.store.consumers.get(id);

    if (!consumer) {
      throw new MediasoupException(`Consumer with ID ${id} not found`);
    }

    return consumer;
  }

  //#endregion

  //#region Producer

  /**
   * Provisions an active media ingestion channel (Producer) attached to a specified upstream client transport.
   * Switches the internal transport app data pipeline tracker direction to 'send'.
   * @param transportId - The client ingress transport's unique ID.
   * @param kind - The media track type ('audio' or 'video').
   * @param rtpParameters - Codec options, structural configurations, and stream parameters.
   * @returns A promise that resolves to the initialized uplink Producer instance.
   */
  async createProducer(transportId: TransportId, kind: types.MediaKind, rtpParameters: types.RtpParameters): Promise<Producer> {
    const transport = this.getTransportById(transportId);
    const { appData } = transport;
    const producer = await transport.produce<ConsumerProducerAppData>({
      kind,
      rtpParameters,
      appData: {
        routerId: appData.routerId,
        timestamp: Date.now(),
        transportId,
      },
    });
    transport.appData.direction = 'send';

    return producer;
  }

  /**
   * Fetches all Producers currently active within the platform module.
   * @returns An array containing active Producer instances.
   */
  getProducers(): Producer[] {
    return Array.from(this.store.producers.values());
  }

  /**
   * Fetches an explicit Producer instance matching the provided ID.
   * @param id - The unique Producer string ID.
   * @returns The corresponding Producer instance.
   * @throws {MediasoupException} If no Producer is found matching the provided ID.
   */
  getProducerById(id: string): Producer {
    const producer = this.store.producers.get(id);

    if (!producer) {
      throw new MediasoupException(`Producer with ID ${id} not found`);
    }

    return producer;
  }

  //#endregion

  //#region Data Consumer

  /**
   * Creates a new DataConsumer instance on a specific transport to consume data from a DataProducer.
   * @param transportId - The unique identifier of the transport where the DataConsumer will be created.
   * @param options - The configuration options for the DataConsumer, which must include the target `dataProducerId`.
   * @returns A promise that resolves to the newly created Mediasoup `DataConsumer` instance.
   * @throws {MediasoupException} If the transport is not found or if the DataConsumer initialization fails.
   */
  async createDataConsumer(transportId: TransportId, transportOptions: DataConsumerOptions) {
    const transport = this.getTransportById(transportId);
    const dataConsumer = await transport.consumeData<RouterResourceAppData>({
      ...transportOptions,
      appData: {
        routerId: transport.appData.routerId,
        timestamp: Date.now(),
      },
    });

    return dataConsumer;
  }

  /**
   * Fetches all active non-media Data Consumers (SCTP channels) currently tracked in the system.
   * @returns An array containing active DataConsumer instances.
   */
  getDataConsumers(): DataConsumer[] {
    return Array.from(this.store.dataConsumers.values());
  }

  /**
   * Fetches an explicit Data Consumer instance by its unique registry ID.
   * @param id - The unique Data Consumer string ID.
   * @returns The corresponding DataConsumer instance.
   * @throws {MediasoupException} If no Data Consumer is found matching the provided ID.
   */
  getDataConsumerById(id: DataConsumerId) {
    const dataConsumer = this.store.dataConsumers.get(id);

    if (!dataConsumer) {
      throw new MediasoupException(`Data consumer with ID ${id} not found`);
    }

    return dataConsumer;
  }

  //#endregion

  //#region Data Producer

  /**
   * Creates a new DataProducer instance on a specific transport.
   * @param transportId - The unique identifier of the transport where the DataProducer will be created.
   * @param options - The configuration options for the DataProducer (e.g., sctpStreamParameters, label, protocol).
   * @returns A promise that resolves to the newly created Mediasoup `DataProducer` instance.
   * @throws {MediasoupException} If the transport with the given ID cannot be found or if creation fails.
   */
  async createDataProducer(transportId: TransportId, transportOptions?: DataProducerOptions) {
    const transport = this.getTransportById(transportId);
    const dataProducer = await transport.produceData<RouterResourceAppData>({
      ...transportOptions,
      appData: {
        routerId: transport.appData.routerId,
        timestamp: Date.now(),
      },
    });

    return dataProducer;
  }

  /**
   * Fetches all active non-media Data Producers (SCTP ingest streams) currently tracked in the system.
   * @returns An array containing active DataProducer instances.
   */
  getDataProducers(): DataProducer[] {
    return Array.from(this.store.dataProducers.values());
  }

  /**
   * Fetches an explicit Data Producer instance by its unique registry ID.
   * @param id - The unique Data Producer string ID.
   * @returns The corresponding DataProducer instance.
   * @throws {MediasoupException} If no Data Producer is found matching the provided ID.
   */
  getDataProducerById(id: DataProducerId) {
    const dataProducer = this.store.dataProducers.get(id);

    if (!dataProducer) {
      throw new MediasoupException(`Data producer with ID ${id} not found`);
    }

    return dataProducer;
  }

  //#endregion

  //#region RTP Observer

  /**
   * Creates and attaches an ActiveSpeakerObserver to the specified Router.
   * Monitors RTP streams within the router to detect the currently dominant speaker based on audio activity.
   * @param routerId - The unique ID of the target Router to attach the observer to.
   * @param interval - Optional polling interval in milliseconds for evaluating active speaker transitions.
   * @returns A promise that resolves to the initialized ActiveSpeakerObserver instance.
   * @throws {MediasoupException} If no Router is found matching the provided ID.
   */
  async createActiveSpeakerObserver(routerId: RouterId, interval?: number) {
    const router = this.getRouterById(routerId);
    const activeSpeakerObserver = await router.createActiveSpeakerObserver<RouterResourceAppData>({
      appData: {
        routerId,
        timestamp: Date.now(),
      },
      interval,
    });

    return activeSpeakerObserver;
  }

  /**
   * Creates and attaches an AudioLevelObserver to the specified Router.
   * Periodically reports per-producer audio volume levels, enabling applications to react to loudness thresholds.
   * @param routerId - The unique ID of the target Router to attach the observer to.
   * @param options - Optional configuration for audio level detection, including threshold, interval, and max entries.
   * @returns A promise that resolves to the initialized AudioLevelObserver instance.
   * @throws {MediasoupException} If no Router is found matching the provided ID.
   */
  async createAudioLevelObserver(routerId: RouterId, options?: Omit<types.AudioLevelObserverOptions, 'appData'>) {
    const router = this.getRouterById(routerId);
    const audioLevelObserver = await router.createAudioLevelObserver<RouterResourceAppData>({
      ...options,
      appData: {
        routerId,
        timestamp: Date.now(),
      },
    });

    return audioLevelObserver;
  }

  /**
   * Fetches all RTP Observers currently managed across all endpoints.
   * @returns An array containing active RTP Observer instances.
   */
  getRtpObservers(): AllRtpObservers[];

  /**
   * Fetches RTP Observers currently managed across all endpoints, filtered by a specific observer type.
   * @template T - Specialized extension of standard RTP Observer type.
   * @param type - The specific structural RTP Observer type to filter by.
   * @returns An array of the requested RTP Observer instances cast to the specific type.
   */
  getRtpObservers<T extends types.RtpObserverType>(type: T): RtpObserverMap[T][];
  getRtpObservers<T extends types.RtpObserverType>(type?: T) {
    const rtpObservers = Array.from(this.store.rtpObservers.values());

    if (!type) {
      return rtpObservers;
    }

    return rtpObservers.filter((rtpObserver) => rtpObserver.type === type) as RtpObserverMap[T][];
  }

  /**
   * Fetches an explicit RTP Observer instance matching the given ID.
   * @template T - Specialized extension of standard RtpObserver.
   * @param id - The targeted structural tracker ID.
   * @returns The matching RTP Observer instance.
   * @throws {MediasoupException} If no observer matches the provided ID.
   */
  getRtpObserverById<T extends RtpObserver>(id: string): T {
    const rtpObserver = this.store.rtpObservers.get(id);

    if (!rtpObserver) {
      throw new MediasoupException(`RTP observer with ID ${id} not found`);
    }

    return rtpObserver as T;
  }

  /**
   * Fetches RTP Observers constrained to a targeted Router instance, filtered by a specific observer type.
   * @template T - Specialized extension of standard RTP Observer type.
   * @param routerId - The unique identifier of the target Router.
   * @param type - The specific structural RTP Observer type to filter by.
   * @returns An array of the requested RTP Observer instances cast to the specific type.
   */
  getRtpObserversByRouter<T extends types.RtpObserverType>(routerId: RouterId, type: T): RtpObserverMap[T][];

  /**
   * Fetches all RTP Observers constrained to a targeted Router instance.
   * @param routerId - The unique identifier of the target Router.
   * @returns An array containing active RTP Observer instances linked to the Router.
   */
  getRtpObserversByRouter(routerId: RouterId): AllRtpObservers[];
  getRtpObserversByRouter<T extends types.RtpObserverType>(routerId: RouterId, type?: T) {
    const rtpObservers = Array.from(this.store.rtpObservers.values());
    return rtpObservers.filter((rtpObserver) => rtpObserver.appData.routerId === routerId && (!type || rtpObserver.type === type));
  }

  //#endregion
}
