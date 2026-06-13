import { ModuleMetadata, Type } from '@nestjs/common';
import type { types } from 'mediasoup';
import { MediasoupException } from './mediasoup.exception';

//#region Entity Types

// Worker & Router
export type Worker = types.Worker<WorkerAppData>;
export type Router = types.Router<RouterAppData>;

// Transport
export type Transport = types.Transport<TransportAppData>;
export type WebRtcTransport = types.WebRtcTransport<TransportAppData>;
export type PlainTransport = types.PlainTransport<TransportAppData>;
export type PipeTransport = types.PipeTransport<TransportAppData>;
export type DirectTransport = types.DirectTransport<TransportAppData>;

// Webrtc server
export type WebRtcServer = types.WebRtcServer<WebRtcServerAppData>;

// RTP Observer
export type RtpObserver = types.RtpObserver<RouterResourceAppData>;
export type AudioLevelObserver = types.AudioLevelObserver<RouterResourceAppData>;
export type ActiveSpeakerObserver = types.ActiveSpeakerObserver<RouterResourceAppData>;

// Consumer & Producer
export type Consumer = types.Consumer<ConsumerProducerAppData>;
export type Producer = types.Producer<ConsumerProducerAppData>;

// Data consumer & Data producer
export type DataConsumer = types.DataConsumer<RouterResourceAppData>;
export type DataProducer = types.DataProducer<RouterResourceAppData>;

//#endregion

//#region Resource Options & Store

export type WorkerSettings = types.WorkerSettings<WorkerAppData> & {
  workerCount?: number;
};
export type RouterOptions = types.RouterOptions<RouterAppData> & {
  worker?: Worker;
  exceptWorkerPid?: number | number[];
};
export type DirectTransportOptions = types.DirectTransportOptions<TransportAppData>;
export type PipeTransportOptions = types.PipeTransportOptions<TransportAppData>;
export type PlainTransportOptions = types.PlainTransportOptions<TransportAppData>;
export type WebRtcTransportOptions = types.WebRtcTransportOptions<TransportAppData>;
export type WebRtcServerOptions = types.WebRtcServerOptions<WebRtcServerAppData>;
export type DataConsumerOptions = types.DataConsumerOptions<TransportAppData>;
export type DataProducerOptions = types.DataProducerOptions<TransportAppData>;

export type RouterId = string;
export type TransportId = string;
export type ConsumerId = string;
export type ProducerId = string;
export type RtpObserverId = string;
export type WebRtcServerId = string;
export type DataConsumerId = string;
export type DataProducerId = string;

export interface Mediasoup {
  workers: { key: number; value: Worker };
  routers: { key: RouterId; value: Router };
  transports: { key: TransportId; value: Transport };
  consumers: { key: ConsumerId; value: Consumer };
  producers: { key: ProducerId; value: Producer };
  rtpObservers: { key: RtpObserverId; value: RtpObserver };
  webRtcServers: { key: WebRtcServerId; value: WebRtcServer };
  dataConsumers: { key: DataConsumerId; value: DataConsumer };
  dataProducers: { key: DataProducerId; value: DataProducer };
}

export type MediasoupKey<K extends keyof Mediasoup> = Mediasoup[K]['key'];
export type MediasoupValue<K extends keyof Mediasoup> = Mediasoup[K]['value'];

export type MutableMediasoupResourceStore = {
  readonly [K in keyof Mediasoup]: Map<Mediasoup[K]['key'], Mediasoup[K]['value']>;
};

export type ReadonlyMediasoupResourceStore = {
  readonly [K in keyof Mediasoup]: ReadonlyMap<Mediasoup[K]['key'], Mediasoup[K]['value']>;
};

export enum MediasoupToken {
  MODULE_OPTIONS = 'MODULE_OPTIONS',
  CURRENT_WORKER = 'CURRENT_WORKER',
  RESOURCE_STORE = 'RESOURCE_STORE',
}

//#endregion

//#region AppData Schemas

export type ResourceCount = { [K in Exclude<keyof Mediasoup, 'workers'>]: number };

export type TransportDirection = 'recv' | 'send';

export type RouterResourceAppData = {
  routerId: RouterId;
  timestamp: number;
};

export type WorkerAppData = {
  count: Omit<ResourceCount, 'webRtcServers'>;
  timestamp: number;
  webRtcServer?: types.WebRtcServer;
};

export type WebRtcServerAppData = {
  workerPid: number;
  timestamp: number;
};

export type RouterAppData = {
  count: Omit<ResourceCount, 'routers' | 'webRtcServers'>;
  workerPid: number;
  timestamp: number;
};

export type TransportAppData = RouterResourceAppData & {
  direction?: TransportDirection;
  connected: boolean;
  lastConnectedAt?: number;
  lastDisconnectedAt?: number;
  reconnectCount: number;
};

export type ConsumerProducerAppData = RouterResourceAppData & { transportId: string };

//#endregion

//#region Event System

export interface TransportMap {
  webrtc: WebRtcTransport;
  plain: PlainTransport;
  pipe: PipeTransport;
  direct: DirectTransport;
}

export interface RtpObserverMap {
  audiolevel: AudioLevelObserver;
  activespeaker: ActiveSpeakerObserver;
}

export type AllTransports = TransportMap[keyof TransportMap];

export type AllRtpObservers = RtpObserverMap[keyof RtpObserverMap];

type WithPid = { pid: number };
type WithId = { id: string };
type WithData<T> = { data: T };
type ListenerError = { event: string; error: Error };

type ResourceAdjustment<TCount> = WithData<{
  action: 'decrement' | 'increment';
  type: keyof TCount;
  count: number;
}>;

interface WorkerEventMap {
  WorkerCreated: WithPid;
  WorkerClose: WithPid;
  WorkerDied: WithPid & WithData<{ error: Error }>;
  WorkerSubProcessClose: WithPid;
  WorkerListenerError: WithPid & WithData<ListenerError>;
  WorkerResourceUsageAdjusted: WithPid & ResourceAdjustment<WorkerAppData['count']>;
}

interface RouterEventMap {
  RouterCreated: WithId;
  RouterClose: WithId;
  RouterWorkerClose: WithId;
  RouterListenerError: WithId & WithData<ListenerError>;
  RouterResourceUsageAdjusted: WithId & ResourceAdjustment<RouterAppData['count']>;
}

interface TransportEventMap {
  TransportCreated: WithId;
  TransportClose: WithId;
  TransportRouterClose: WithId;
  TransportListenServerClose: WithId;
  TransportListenerError: WithId & WithData<ListenerError>;
  TransportTrace: WithId & WithData<types.TransportTraceEventData>;
}

interface WebRtcTransportEventMap {
  WebRtcIceStateChange: WithId & WithData<types.IceState>;
  WebRtcIceSelectedTupleChange: WithId & WithData<types.TransportTuple>;
  WebRtcDtlsChange: WithId & WithData<types.DtlsState>;
  WebRtcSctpStateChange: WithId & WithData<types.SctpState>;
}

interface PlainTransportEventMap {
  PlainTransportTuple: WithId & WithData<types.TransportTuple>;
  PlainTransportRtcpTuple: WithId & WithData<types.TransportTuple>;
  PlainTransportSctpStateChange: WithId & WithData<types.SctpState>;
}

interface PipeTransportEventMap {
  PipeTransportSctpStateChange: WithId & WithData<types.SctpState>;
}

interface DirectTransportEventMap {
  DirectTransportRtcp: WithId & WithData<Buffer<ArrayBufferLike>>;
}

interface ConsumerEventMap {
  ConsumerCreated: WithId;
  ConsumerClose: WithId;
  ConsumerTransportClose: WithId;
  ConsumerProducerClose: WithId;
  ConsumerProducerPause: WithId;
  ConsumerProducerResume: WithId;
  ConsumerListenerError: WithId & WithData<ListenerError>;
  ConsumerPause: WithId;
  ConsumerResume: WithId;
  ConsumerScore: WithId & WithData<types.ConsumerScore>;
  ConsumerTrace: WithId & WithData<types.ConsumerTraceEventData>;
  ConsumerRtp: WithId & WithData<Buffer<ArrayBufferLike>>;
  ConsumerLayersChange: WithId & WithData<types.ConsumerLayers | undefined>;
}

interface ProducerEventMap {
  ProducerCreated: WithId;
  ProducerClose: WithId;
  ProducerTransportClose: WithId;
  ProducerListenerError: WithId & WithData<ListenerError>;
  ProducerPause: WithId;
  ProducerResume: WithId;
  ProducerScore: WithId & WithData<types.ProducerScore[]>;
  ProducerTrace: WithId & WithData<types.ProducerTraceEventData>;
  ProducerVideoOrientationChange: WithId & WithData<types.ProducerVideoOrientation>;
}

interface DataConsumerEventMap {
  DataConsumerCreated: WithId;
  DataConsumerPause: WithId;
  DataConsumerResume: WithId;
  DataConsumerClose: WithId;
  DataConsumerTransportClose: WithId;
  DataConsumerListenerError: WithId & WithData<ListenerError>;
  DataConsumerDataProducerClose: WithId;
  DataConsumerDataProducerPause: WithId;
  DataConsumerDataProducerResume: WithId;
  DataConsumerMessage: WithId & WithData<{ message: Buffer<ArrayBufferLike>; ppid: number }>;
  DataConsumerSctpSendBufferFull: WithId;
  DataConsumerBufferedAmountLow: WithId & WithData<number>;
}

interface DataProducerEventMap {
  DataProducerCreated: WithId;
  DataProducerPause: WithId;
  DataProducerResume: WithId;
  DataProducerClose: WithId;
  DataProducerTransportClose: WithId;
  DataProducerListenerError: WithId & WithData<ListenerError>;
}

interface RtpObserverEventMap {
  RtpObserverCreated: WithId;
  RtpObserverClose: WithId;
  RtpObserverListenerError: WithId & WithData<ListenerError>;
  RtpObserverDominantSpeaker: WithId & WithData<types.ActiveSpeakerObserverDominantSpeaker>;
  RtpObserverSilence: WithId;
  RtpObserverVolumes: WithId & WithData<types.AudioLevelObserverVolume[]>;
  RtpObserverPause: WithId;
  RtpObserverResume: WithId;
}

interface WebRtcServerEventMap {
  WebRtcServerCreated: WithId;
  WebRtcServerClose: WithId;
  WebRtcServerTransportHandled: WithId & WithData<WebRtcTransport>;
  WebRtcServerTransportUnhandled: WithId & WithData<WebRtcTransport>;
  WebRtcServerListenerError: WithId & WithData<ListenerError>;
}

export type MediasoupEventMap = WorkerEventMap &
  RouterEventMap &
  TransportEventMap &
  WebRtcTransportEventMap &
  PlainTransportEventMap &
  PipeTransportEventMap &
  DirectTransportEventMap &
  ConsumerEventMap &
  ProducerEventMap &
  DataConsumerEventMap &
  DataProducerEventMap &
  RtpObserverEventMap &
  WebRtcServerEventMap;

export type MediasoupEventName = keyof MediasoupEventMap;
export type MediasoupEventData<T extends MediasoupEventName> = MediasoupEventMap[T];

//#endregion

//#region Module Configuration

export interface MediasoupModuleGlobalOptions {
  isGlobal?: boolean;
}

export interface MediasoupModuleOptions {
  mediaCodecs?: types.RouterRtpCodecCapability[];
  workerSettings: Omit<WorkerSettings, 'appData'>;
  webRtcTransportOptions?: Omit<WebRtcTransportOptions, 'appData'>;
  plainTransportOptions?: Omit<PlainTransportOptions, 'appData'>;
  pipeTransportOptions?: Omit<PipeTransportOptions, 'appData'>;
  directTransportOptions?: Omit<DirectTransportOptions, 'appData'>;
  webRtcServer: { enable: true; options: WebRtcServerOptions } | { enable: false; options?: never };
  transportTrace?: {
    enable: boolean;
    events: types.TransportTraceEventType[];
  };
  consumerTrace?: {
    enable: boolean;
    events: types.ConsumerTraceEventType[];
  };
  producerTrace?: {
    enable: boolean;
    events: types.ProducerTraceEventType[];
  };
}

export interface MediasoupOptionsFactory {
  createMediasoupOptions(): Promise<MediasoupModuleOptions> | MediasoupModuleOptions;
}

export interface MediasoupModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'>, MediasoupModuleGlobalOptions {
  useFactory?: (...args: any[]) => Promise<MediasoupModuleOptions> | MediasoupModuleOptions;
  inject?: any[];
  useClass?: Type<MediasoupOptionsFactory>;
  useExisting?: Type<MediasoupOptionsFactory>;
}

export type MediasoupExceptionFactory = (exception: MediasoupException) => Error;

//#endregion
