import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MediasoupToken } from '@/mediasoup/mediasoup.interface';
import type {
  ActiveSpeakerObserver,
  AudioLevelObserver,
  Consumer,
  DataConsumer,
  DataProducer,
  DirectTransport,
  Mediasoup,
  MediasoupEventData,
  MediasoupEventName,
  MediasoupKey,
  MediasoupModuleOptions,
  MediasoupValue,
  MutableMediasoupResourceStore,
  PipeTransport,
  PlainTransport,
  Producer,
  Router,
  RouterAppData,
  RtpObserver,
  Transport,
  WebRtcServer,
  WebRtcTransport,
  Worker,
  WorkerAppData,
} from '@/mediasoup/mediasoup.interface';

/**
 * Service responsible for intercepting, tracking, and observing core component operations.
 * It maps native C++ sub-process observer events into the application-wide NestJS EventEmitter layer,
 * updates internal telemetry trackers, and handles structural resource metrics.
 */
@Injectable()
export class ObserverService {
  /**
   * Creates an instance of ObserverService.
   * @param logger - NestJS runtime logging capability framework.
   * @param eventEmitter - Global NestJS async system bridge for distributing customized media states.
   * @param store - Reference map store containing modifiable collections of components.
   * @param options - Base module configuration guidelines.
   */
  constructor(
    private logger: Logger,
    private eventEmitter: EventEmitter2,
    @Inject(MediasoupToken.RESOURCE_STORE) private store: MutableMediasoupResourceStore,
    @Inject(MediasoupToken.MODULE_OPTIONS) private options: MediasoupModuleOptions,
  ) {}

  /**
   * Entry trigger for hooking into individual newly spawned Worker processes.
   * @param worker - The newly initialized Worker process instance.
   */
  observer(worker: Worker) {
    this.newWorker(worker);
  }

  /**
   * Adjusts the resource allocation telemetry tracking metrics for an explicit Worker process.
   * Dispatches unified messaging alerts to the outer application framework.
   * @param pid - The target worker's unique Process ID.
   * @param action - The manipulation strategy to execute ('increment' or 'decrement').
   * @param type - The exact metric node field within WorkerAppData count schema.
   */
  private adjustWorkerUsage(pid: number, action: 'decrement' | 'increment', type: keyof WorkerAppData['count']) {
    const worker = this.store.workers.get(pid);

    if (worker) {
      const lastCount = worker.appData.count[type];

      if (action === 'decrement') {
        worker.appData.count[type] = lastCount - 1;
      } else if (action === 'increment') {
        worker.appData.count[type] = lastCount + 1;
      }

      const newCount = worker.appData.count[type];
      this.broadcastEvent('WorkerResourceUsageAdjusted', { pid, data: { action, count: newCount, type } });
    }
  }

  /**
   * Adjusts the structural sub-resource telemetry tracking metrics for an explicit internal Router.
   * Automatically cascades usage updates upwards to the worker layer.
   * @param id - The unique identifier of the targeted Router.
   * @param action - The manipulation strategy to execute ('increment' or 'decrement').
   * @param type - The exact metric node field within RouterAppData count schema.
   */
  private adjustRouterUsage(id: string, action: 'decrement' | 'increment', type: keyof RouterAppData['count']) {
    const router = this.store.routers.get(id);

    if (router) {
      const count = router.appData.count[type];

      if (action === 'decrement') {
        router.appData.count[type] = count - 1;
      } else if (action === 'increment') {
        router.appData.count[type] = count + 1;
      }

      const newCount = router.appData.count[type];
      this.broadcastEvent('RouterResourceUsageAdjusted', { id, data: { action, count: newCount, type } });
      this.adjustWorkerUsage(router.appData.workerPid, action, type);
    }
  }

  /**
   * Extracts the explicit tracking key identifier depending on the core item class type.
   * Uses `pid` for Workers and `id` for other standard structural components.
   * @template K - Generic extension mapping valid catalog structural configurations.
   * @param type - The target category section string matching keys in the central data registry.
   * @param item - The component instance whose indexing key value needs resolving.
   * @returns The extracted dictionary lookup index key.
   */
  private getResourceKey<K extends keyof Mediasoup>(type: K, item: MediasoupValue<K>): MediasoupKey<K> {
    if (type === 'workers') {
      return (item as Worker).pid;
    }
    return (item as { id: string }).id;
  }

  /**
   * Mutates the central multi-map component store by dynamically tracking or evicting elements.
   * @template K - Generic parameter defining sub-map targets.
   * @param action - State mutation command logic ('add' or 'remove').
   * @param type - The structural bucket key inside the data registry.
   * @param item - The actual component instance reference to insert or drop.
   * @returns The processed element instance.
   */
  private resource<K extends keyof Mediasoup>(action: 'add' | 'remove', type: K, item: MediasoupValue<K>): MediasoupValue<K> {
    const map = this.store[type] as Map<MediasoupKey<K>, MediasoupValue<K>>;
    const key = this.getResourceKey(type, item);

    if (action === 'add' && !map.has(key)) {
      map.set(key, item);
    } else if (action === 'remove' && map.has(key)) {
      map.delete(key);
    }

    return item;
  }

  /**
   * Encapsulates NestJS event publishing mechanisms to broadcast strongly typed messages.
   * @template Name - Strongly-typed union key of recognized notification triggers.
   * @param name - The identifier key describing the specific triggered state.
   * @param data - The contextual event payload object structured for the targeted state name.
   */
  private broadcastEvent<Name extends MediasoupEventName>(name: Name, data: MediasoupEventData<Name>) {
    this.eventEmitter.emit(name, data);
  }

  //#region Worker

  /**
   * Sets up resource mapping tracking and attaches error hooks to intercept
   * underlying native C++ process lifecycle boundaries for a Worker.
   * @param worker - Newly initialized Worker instance.
   * @see https://mediasoup.org/documentation/v3/mediasoup/api/#Worker
   */
  private newWorker(worker: Worker) {
    const pid = worker.pid;
    this.resource('add', 'workers', worker);
    this.broadcastEvent('WorkerCreated', { pid });

    /**
     * Worker events
     * @see https://mediasoup.org/documentation/v3/mediasoup/api/#Worker-events
     */
    worker.on('died', (error) => {
      this.broadcastEvent('WorkerDied', { pid, data: { error } });
    });

    worker.on('subprocessclose', () => {
      this.broadcastEvent('WorkerSubProcessClose', { pid });
    });

    worker.on('listenererror', (event, error) => {
      this.broadcastEvent('WorkerListenerError', { pid, data: { event, error } });
    });

    /**
     * Worker observer events
     * @see https://mediasoup.org/documentation/v3/mediasoup/api/#Worker-observer-events
     */
    worker.observer.on('close', () => {
      this.resource('remove', 'workers', worker);
      this.broadcastEvent('WorkerClose', { pid });
    });

    worker.observer.on('newrouter', (router) => {
      this.newRouter(router as Router);
    });

    worker.observer.on('newwebrtcserver', (webRtcServer) => {
      this.newWebRtcServer(webRtcServer as WebRtcServer);
    });
  }

  //#endregion

  //#region Router

  /**
   * Integrates a newly created Router instance by mapping its internal lifecycle
   * event notifications into the shared application message layer.
   * @param router - Newly initialized Router instance.
   * @see https://mediasoup.org/documentation/v3/mediasoup/api/#Router
   */
  private newRouter(router: Router) {
    const { id, appData } = router;
    this.resource('add', 'routers', router);
    this.broadcastEvent('RouterCreated', { id });
    this.adjustWorkerUsage(appData.workerPid, 'increment', 'routers');

    /**
     * Router events
     * @see https://mediasoup.org/documentation/v3/mediasoup/api/#Router-events
     */
    router.on('workerclose', () => {
      this.resource('remove', 'routers', router);
      this.broadcastEvent('RouterWorkerClose', { id });
    });

    router.on('listenererror', (event, error) => {
      this.broadcastEvent('RouterListenerError', { id, data: { event, error } });
    });

    /**
     * Router observer events
     * @see https://mediasoup.org/documentation/v3/mediasoup/api/#Router-observer-events
     */
    router.observer.on('close', () => {
      this.resource('remove', 'routers', router);
      this.broadcastEvent('RouterClose', { id });
      this.adjustWorkerUsage(appData.workerPid, 'decrement', 'routers');
    });

    router.observer.on('newtransport', (transport) => {
      this.newTransport(transport as Transport);
    });

    router.observer.on('newrtpobserver', (rtpObserver) => {
      this.newRtpObserver(rtpObserver as RtpObserver);
    });
  }

  //#endregion

  //#region Transport

  /**
   * Handles initialization, registration mapping, option-based telemetry tracing enablement,
   * and structural type switching for newly established Transports (WebRTC, Plain, Pipe, or Direct).
   * @param transport - Newly initialized Transport instance.
   * @see https://mediasoup.org/documentation/v3/mediasoup/api/#Transport
   */
  private newTransport(transport: Transport) {
    const { id, appData } = transport;
    const { transportTrace } = this.options;
    this.resource('add', 'transports', transport);
    this.broadcastEvent('TransportCreated', { id });
    this.adjustRouterUsage(appData.routerId, 'increment', 'transports');

    if (transportTrace?.enable) {
      transport.enableTraceEvent(transportTrace.events).catch((error) => this.logger.error(`Transport trace error`, error));
    }

    switch (transport.type) {
      case 'webrtc': {
        const webrtcTransport = transport as WebRtcTransport;

        webrtcTransport.on('icestatechange', (iceState) => {
          this.broadcastEvent('WebRtcIceStateChange', { id, data: iceState });
        });

        webrtcTransport.on('iceselectedtuplechange', (iceSelectedTuple) => {
          this.broadcastEvent('WebRtcIceSelectedTupleChange', { id, data: iceSelectedTuple });
        });

        webrtcTransport.on('dtlsstatechange', (dtlsState) => {
          this.broadcastEvent('WebRtcDtlsChange', { id, data: dtlsState });
        });

        webrtcTransport.on('sctpstatechange', (sctpState) => {
          this.broadcastEvent('WebRtcSctpStateChange', { id, data: sctpState });
        });
        break;
      }

      case 'plain': {
        const plainTransport = transport as PlainTransport;

        plainTransport.on('tuple', (tuple) => {
          this.broadcastEvent('PlainTransportTuple', { id, data: tuple });
        });

        plainTransport.on('rtcptuple', (rtcpTuple) => {
          this.broadcastEvent('PlainTransportRtcpTuple', { id, data: rtcpTuple });
        });

        plainTransport.on('sctpstatechange', (sctpState) => {
          this.broadcastEvent('PlainTransportSctpStateChange', { id, data: sctpState });
        });
        break;
      }

      case 'pipe': {
        const pipeTransport = transport as PipeTransport;

        pipeTransport.on('sctpstatechange', (sctpState) => {
          this.broadcastEvent('PipeTransportSctpStateChange', { id, data: sctpState });
        });
        break;
      }

      case 'direct': {
        const directTransport = transport as DirectTransport;

        directTransport.on('rtcp', (rtcp) => {
          this.broadcastEvent('DirectTransportRtcp', { id, data: rtcp });
        });
        break;
      }
    }

    /**
     * Transport events
     * @see https://mediasoup.org/documentation/v3/mediasoup/api/#Transport-events
     */
    transport.on('routerclose', () => {
      this.broadcastEvent('TransportRouterClose', { id });
    });

    transport.on('listenserverclose', () => {
      this.broadcastEvent('TransportListenServerClose', { id });
    });

    transport.on('trace', (trace) => {
      this.broadcastEvent('TransportTrace', { id, data: trace });
    });

    transport.on('listenererror', (event, error) => {
      this.broadcastEvent('TransportListenerError', { id, data: { event, error } });
    });

    /**
     * Transport observer events
     * @see https://mediasoup.org/documentation/v3/mediasoup/api/#Transport-observer-events
     */
    transport.observer.on('close', () => {
      this.resource('remove', 'transports', transport);
      this.broadcastEvent('TransportClose', { id });
      this.adjustRouterUsage(appData.routerId, 'decrement', 'transports');
    });

    transport.observer.on('newproducer', (producer) => {
      this.newProducer(producer as Producer);
    });

    transport.observer.on('newconsumer', (consumer) => {
      this.newConsumer(consumer as Consumer);
    });

    transport.observer.on('newdataproducer', (dataProducer) => {
      this.newDataProducer(dataProducer as DataProducer);
    });

    transport.observer.on('newdataconsumer', (dataConsumer) => {
      this.newDataConsumer(dataConsumer as DataConsumer);
    });
  }

  //#endregion

  //#region  Consumer

  /**
   * Tracks a downlink Consumer stream instance by wiring up statistical scoring updates,
   * rendering configurations, structural tracing options, and closure hooks.
   * @param consumer - Newly initialized Consumer instance.
   * @see https://mediasoup.org/documentation/v3/mediasoup/api/#Consumer
   */
  private newConsumer(consumer: Consumer) {
    const { id, appData } = consumer;
    const { consumerTrace } = this.options;
    this.resource('add', 'consumers', consumer);
    this.broadcastEvent('ConsumerCreated', { id });
    this.adjustRouterUsage(appData.routerId, 'increment', 'consumers');

    if (consumerTrace?.enable) {
      consumer.enableTraceEvent(consumerTrace.events).catch((error) => this.logger.error('Consumer trace error', error));
    }

    /**
     * @see https://mediasoup.org/documentation/v3/mediasoup/api/#Consumer-events
     */
    consumer.on('transportclose', () => {
      this.broadcastEvent('ConsumerTransportClose', { id });
    });

    consumer.on('producerclose', () => {
      this.broadcastEvent('ConsumerProducerClose', { id });
    });

    consumer.on('producerpause', () => {
      this.broadcastEvent('ConsumerProducerPause', { id });
    });

    consumer.on('producerresume', () => {
      this.broadcastEvent('ConsumerProducerResume', { id });
    });

    consumer.on('score', (score) => {
      this.broadcastEvent('ConsumerScore', { id, data: score });
    });

    consumer.on('layerschange', (layers) => {
      this.broadcastEvent('ConsumerLayersChange', { id, data: layers });
    });

    consumer.on('trace', (trace) => {
      this.broadcastEvent('ConsumerTrace', { id, data: trace });
    });

    consumer.on('rtp', (rtpPacket) => {
      this.broadcastEvent('ConsumerRtp', { id, data: rtpPacket });
    });

    consumer.on('listenererror', (event, error) => {
      this.broadcastEvent('ConsumerListenerError', { id, data: { event, error } });
    });

    /**
     * @see https://mediasoup.org/documentation/v3/mediasoup/api/#Consumer-observer-events
     */
    consumer.observer.on('close', () => {
      this.resource('remove', 'consumers', consumer);
      this.broadcastEvent('ConsumerClose', { id });
      this.adjustRouterUsage(appData.routerId, 'decrement', 'consumers');
    });

    consumer.observer.on('pause', () => {
      this.broadcastEvent('ConsumerPause', { id });
    });

    consumer.observer.on('resume', () => {
      this.broadcastEvent('ConsumerResume', { id });
    });
  }

  //#endregion

  //#region Producer

  /**
   * Binds media stream ingestion channels (Producer) to application listeners.
   * Monitored characteristics include network scores, tracking layers, and stream health status indicators.
   * @param producer - Newly initialized Producer instance.
   * @see https://mediasoup.org/documentation/v3/mediasoup/api/#Producer
   */
  private newProducer(producer: Producer) {
    const { id, appData } = producer;
    const { producerTrace } = this.options;
    this.resource('add', 'producers', producer);
    this.broadcastEvent('ProducerCreated', { id });
    this.adjustRouterUsage(appData.routerId, 'increment', 'producers');

    if (producerTrace?.enable) {
      producer.enableTraceEvent(producerTrace.events).catch((error) => this.logger.error(error));
    }

    /**
     * @see https://mediasoup.org/documentation/v3/mediasoup/api/#Producer-events
     */
    producer.on('transportclose', () => {
      this.broadcastEvent('ProducerTransportClose', { id });
    });

    producer.on('score', (score) => {
      this.broadcastEvent('ProducerScore', { id, data: score });
    });

    producer.on('videoorientationchange', (videoOrientation) => {
      this.broadcastEvent('ProducerVideoOrientationChange', { id, data: videoOrientation });
    });

    producer.on('trace', (trace) => {
      this.broadcastEvent('ProducerTrace', { id, data: trace });
    });

    producer.on('listenererror', (event, error) => {
      this.broadcastEvent('ProducerListenerError', { id, data: { event, error } });
    });

    /**
     * @see https://mediasoup.org/documentation/v3/mediasoup/api/#Producer-observer-events
     */
    producer.observer.on('close', () => {
      this.resource('remove', 'producers', producer);
      this.broadcastEvent('ProducerClose', { id });
      this.adjustRouterUsage(appData.routerId, 'decrement', 'producers');
    });

    producer.observer.on('pause', () => {
      this.broadcastEvent('ProducerPause', { id });
    });

    producer.observer.on('resume', () => {
      this.broadcastEvent('ProducerResume', { id });
    });
  }

  //#endregion

  //#region Data consumer

  /**
   * Connects low-level message-based text or control stream outputs (Data Consumer)
   * into the event-driven system pipeline architecture.
   * @param dataConsumer - Newly initialized DataConsumer instance.
   */
  private newDataConsumer(dataConsumer: DataConsumer) {
    const { id, appData } = dataConsumer;
    this.resource('add', 'dataConsumers', dataConsumer);
    this.broadcastEvent('DataConsumerCreated', { id });
    this.adjustRouterUsage(appData.routerId, 'increment', 'dataConsumers');

    /**
     * @see https://mediasoup.org/documentation/v3/mediasoup/api/#DataConsumer-events
     */
    dataConsumer.on('transportclose', () => {
      this.broadcastEvent('DataConsumerTransportClose', { id });
    });

    dataConsumer.on('listenererror', (event, error) => {
      this.broadcastEvent('DataConsumerListenerError', { id, data: { event, error } });
    });

    dataConsumer.on('dataproducerclose', () => {
      this.broadcastEvent('DataConsumerDataProducerClose', { id });
    });

    dataConsumer.on('dataproducerpause', () => {
      this.broadcastEvent('DataConsumerDataProducerPause', { id });
    });

    dataConsumer.on('dataproducerresume', () => {
      this.broadcastEvent('DataConsumerDataProducerResume', { id });
    });

    dataConsumer.on('message', (message, ppid) => {
      this.broadcastEvent('DataConsumerMessage', { id, data: { message, ppid } });
    });

    dataConsumer.on('sctpsendbufferfull', () => {
      this.broadcastEvent('DataConsumerSctpSendBufferFull', { id });
    });

    dataConsumer.on('bufferedamountlow', (bufferedAmount) => {
      this.broadcastEvent('DataConsumerBufferedAmountLow', { id, data: bufferedAmount });
    });

    /**
     * @see https://mediasoup.org/documentation/v3/mediasoup/api/#DataConsumer-observer-events
     */
    dataConsumer.observer.on('close', () => {
      this.resource('remove', 'dataConsumers', dataConsumer);
      this.broadcastEvent('DataConsumerClose', { id });
      this.adjustRouterUsage(appData.routerId, 'decrement', 'dataConsumers');
    });

    dataConsumer.observer.on('pause', () => {
      this.broadcastEvent('DataConsumerPause', { id });
    });

    dataConsumer.observer.on('resume', () => {
      this.broadcastEvent('DataConsumerResume', { id });
    });
  }

  //#endregion

  //#region Data producer

  /**
   * Registers low-level message-based text or data inputs (Data Producer)
   * for monitoring connectivity buffers, pausing cycles, and data pipeline terminations.
   * @param dataProducer - Newly initialized DataProducer instance.
   */
  private newDataProducer(dataProducer: DataProducer) {
    const { id, appData } = dataProducer;
    this.resource('add', 'dataProducers', dataProducer);
    this.broadcastEvent('DataProducerCreated', { id });
    this.adjustRouterUsage(appData.routerId, 'increment', 'dataProducers');

    /**
     * @see https://mediasoup.org/documentation/v3/mediasoup/api/#DataProducer-events
     */
    dataProducer.on('transportclose', () => {
      this.broadcastEvent('DataProducerTransportClose', { id });
    });

    dataProducer.on('listenererror', (event, error) => {
      this.broadcastEvent('DataProducerListenerError', { id, data: { event, error } });
    });

    /**
     * @see https://mediasoup.org/documentation/v3/mediasoup/api/#DataProducer-observer-events
     */
    dataProducer.observer.on('pause', () => {
      this.broadcastEvent('DataProducerPause', { id });
    });

    dataProducer.observer.on('resume', () => {
      this.broadcastEvent('DataProducerResume', { id });
    });

    dataProducer.observer.on('close', () => {
      this.resource('remove', 'dataProducers', dataProducer);
      this.broadcastEvent('DataProducerClose', { id });
      this.adjustRouterUsage(appData.routerId, 'decrement', 'dataProducers');
    });
  }

  //#endregion

  //#region Rtp observer

  /**
   * Tracks special auxiliary analytical processing hooks (RTP Observers) attached to a stream router.
   * Handles audio track metric parsing like silence detection levels and dominant active speakers.
   * @param rtpObserver - Newly initialized RtpObserver instance.
   * @see https://mediasoup.org/documentation/v3/mediasoup/api/#RtpObserver
   */
  private newRtpObserver(rtpObserver: RtpObserver) {
    const { id, appData } = rtpObserver;
    this.resource('add', 'rtpObservers', rtpObserver);
    this.broadcastEvent('RtpObserverCreated', { id });
    this.adjustRouterUsage(appData.routerId, 'increment', 'rtpObservers');

    rtpObserver.on('listenererror', (event, error) => {
      this.broadcastEvent('RtpObserverListenerError', { id, data: { event, error } });
    });

    if (rtpObserver.type === 'audiolevel') {
      const audiolevelObserver = rtpObserver as AudioLevelObserver;

      audiolevelObserver.on('silence', () => {
        this.broadcastEvent('RtpObserverSilence', { id });
      });

      audiolevelObserver.on('volumes', (volumes) => {
        this.broadcastEvent('RtpObserverVolumes', { id, data: volumes });
      });
    }

    if (rtpObserver.type === 'activespeaker') {
      const activeSpeakerObserver = rtpObserver as ActiveSpeakerObserver;

      activeSpeakerObserver.on('dominantspeaker', (dominantSpeaker) => {
        this.broadcastEvent('RtpObserverDominantSpeaker', { id, data: dominantSpeaker });
      });
    }

    rtpObserver.observer.on('close', () => {
      this.resource('remove', 'rtpObservers', rtpObserver);
      this.broadcastEvent('RtpObserverClose', { id });
      this.adjustRouterUsage(appData.routerId, 'decrement', 'rtpObservers');
    });

    rtpObserver.observer.on('pause', () => {
      this.broadcastEvent('RtpObserverPause', { id });
    });

    rtpObserver.observer.on('resume', () => {
      this.broadcastEvent('RtpObserverResume', { id });
    });
  }

  //#endregion

  //#region WebRtc server

  /**
   * Maps single port infrastructure assignments (WebRtcServer instances) to state listeners.
   * Relays connection assignments when distributing handling processes for client connections.
   * @param webrtcServer - Newly initialized WebRtcServer instance.
   * @see https://mediasoup.org/documentation/v3/mediasoup/api/#WebRtcServer
   */
  private newWebRtcServer(webrtcServer: WebRtcServer) {
    const { id } = webrtcServer;
    this.resource('add', 'webRtcServers', webrtcServer);
    this.broadcastEvent('WebRtcServerCreated', { id });

    webrtcServer.observer.on('webrtctransporthandled', (webrtcTransport) => {
      this.broadcastEvent('WebRtcServerTransportHandled', { id, data: webrtcTransport as WebRtcTransport });
    });

    webrtcServer.observer.on('webrtctransportunhandled', (webrtcTransport) => {
      this.broadcastEvent('WebRtcServerTransportUnhandled', { id, data: webrtcTransport as WebRtcTransport });
    });

    webrtcServer.observer.on('listenererror', (event, error) => {
      this.broadcastEvent('WebRtcServerListenerError', { id, data: { event, error } });
    });

    webrtcServer.observer.on('close', () => {
      this.resource('remove', 'webRtcServers', webrtcServer);
      this.broadcastEvent('WebRtcServerClose', { id });
    });
  }

  //#endregion
}
