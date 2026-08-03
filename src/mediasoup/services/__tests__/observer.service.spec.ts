/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ObserverService } from '@/mediasoup/services/observer/observer.service';
import { MediasoupToken } from '@/mediasoup/mediasoup.interface';
import type {
  MutableMediasoupResourceStore,
  MediasoupModuleOptions,
  Worker,
  Router,
  Transport,
  Consumer,
  Producer,
  DataConsumer,
  DataProducer,
  RtpObserver,
  WebRtcServer,
} from '@/mediasoup/mediasoup.interface';

type Handlers = Record<string, (...args: any[]) => void>;

/**
 * Minimal fake EventEmitter that records `on(event, handler)` registrations
 * and exposes an `emit` helper to trigger the captured handler directly,
 * mimicking how mediasoup native objects and their `.observer` fire events.
 */
const createEmitter = () => {
  const handlers: Handlers = {};
  const on = jest.fn((event: string, handler: (...args: any[]) => void) => {
    handlers[event] = handler;
  });
  const emit = (event: string, ...args: any[]) => handlers[event]?.(...args);
  return { on, emit, handlers };
};

describe('ObserverService', () => {
  let service: ObserverService;
  let mockStore: MutableMediasoupResourceStore;
  let mockOptions: MediasoupModuleOptions;
  let eventEmitter: { emit: jest.Mock };
  let logger: { error: jest.Mock; log: jest.Mock; warn: jest.Mock; debug: jest.Mock };

  const buildWorker = (pid = 1000) => {
    const onEmitter = createEmitter();
    const observerEmitter = createEmitter();
    const worker = {
      pid,
      appData: {
        count: { routers: 0, consumers: 0, producers: 0, transports: 0, rtpObservers: 0, dataConsumers: 0, dataProducers: 0 },
        timestamp: Date.now(),
      },
      on: onEmitter.on,
      observer: { on: observerEmitter.on },
    } as unknown as Worker;
    return { worker, onEmitter, observerEmitter };
  };

  const buildRouter = (id = 'router-1', workerPid = 1000) => {
    const onEmitter = createEmitter();
    const observerEmitter = createEmitter();
    const router = {
      id,
      appData: {
        workerPid,
        timestamp: Date.now(),
        count: { consumers: 0, producers: 0, transports: 0, rtpObservers: 0, dataConsumers: 0, dataProducers: 0 },
      },
      on: onEmitter.on,
      observer: { on: observerEmitter.on },
    } as unknown as Router;
    return { router, onEmitter, observerEmitter };
  };

  const buildTransport = (id: string, routerId: string, type: 'webrtc' | 'plain' | 'pipe' | 'direct') => {
    const onEmitter = createEmitter();
    const observerEmitter = createEmitter();
    const transport = {
      id,
      type,
      appData: { routerId, timestamp: Date.now(), connected: false, reconnectCount: 0 },
      enableTraceEvent: jest.fn().mockResolvedValue(undefined),
      on: onEmitter.on,
      observer: { on: observerEmitter.on },
    } as unknown as Transport;
    return { transport, onEmitter, observerEmitter };
  };

  const buildConsumer = (id: string, routerId: string) => {
    const onEmitter = createEmitter();
    const observerEmitter = createEmitter();
    const consumer = {
      id,
      appData: { routerId, timestamp: Date.now(), transportId: 't1' },
      enableTraceEvent: jest.fn().mockResolvedValue(undefined),
      on: onEmitter.on,
      observer: { on: observerEmitter.on },
    } as unknown as Consumer;
    return { consumer, onEmitter, observerEmitter };
  };

  const buildProducer = (id: string, routerId: string) => {
    const onEmitter = createEmitter();
    const observerEmitter = createEmitter();
    const producer = {
      id,
      appData: { routerId, timestamp: Date.now(), transportId: 't1' },
      enableTraceEvent: jest.fn().mockResolvedValue(undefined),
      on: onEmitter.on,
      observer: { on: observerEmitter.on },
    } as unknown as Producer;
    return { producer, onEmitter, observerEmitter };
  };

  const buildDataConsumer = (id: string, routerId: string) => {
    const onEmitter = createEmitter();
    const observerEmitter = createEmitter();
    const dataConsumer = {
      id,
      appData: { routerId, timestamp: Date.now() },
      on: onEmitter.on,
      observer: { on: observerEmitter.on },
    } as unknown as DataConsumer;
    return { dataConsumer, onEmitter, observerEmitter };
  };

  const buildDataProducer = (id: string, routerId: string) => {
    const onEmitter = createEmitter();
    const observerEmitter = createEmitter();
    const dataProducer = {
      id,
      appData: { routerId, timestamp: Date.now() },
      on: onEmitter.on,
      observer: { on: observerEmitter.on },
    } as unknown as DataProducer;
    return { dataProducer, onEmitter, observerEmitter };
  };

  const buildRtpObserver = (id: string, routerId: string, type: 'audiolevel' | 'activespeaker') => {
    const onEmitter = createEmitter();
    const observerEmitter = createEmitter();
    const rtpObserver = {
      id,
      type,
      appData: { routerId, timestamp: Date.now() },
      on: onEmitter.on,
      observer: { on: observerEmitter.on },
    } as unknown as RtpObserver;
    return { rtpObserver, onEmitter, observerEmitter };
  };

  const buildWebRtcServer = (id: string) => {
    const observerEmitter = createEmitter();
    const webRtcServer = {
      id,
      observer: { on: observerEmitter.on },
    } as unknown as WebRtcServer;
    return { webRtcServer, observerEmitter };
  };

  beforeEach(async () => {
    mockStore = {
      workers: new Map(),
      routers: new Map(),
      transports: new Map(),
      rtpObservers: new Map(),
      consumers: new Map(),
      producers: new Map(),
      dataConsumers: new Map(),
      dataProducers: new Map(),
      webRtcServers: new Map(),
    };

    mockOptions = {
      webRtcServer: { enable: false },
      workerSettings: {},
      mediaCodecs: [],
    };

    logger = { error: jest.fn(), log: jest.fn(), warn: jest.fn(), debug: jest.fn() };
    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ObserverService,
        { provide: Logger, useValue: logger },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: MediasoupToken.RESOURCE_STORE, useValue: mockStore },
        { provide: MediasoupToken.MODULE_OPTIONS, useValue: mockOptions },
      ],
    }).compile();

    service = module.get<ObserverService>(ObserverService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Worker lifecycle', () => {
    it('adds the worker to the store and broadcasts WorkerCreated', () => {
      const { worker } = buildWorker(1234);
      service.observer(worker);

      expect(mockStore.workers.get(1234)).toBe(worker);
      expect(eventEmitter.emit).toHaveBeenCalledWith('WorkerCreated', { pid: 1234 });
    });

    it('does not duplicate the worker in the store when observed twice', () => {
      const { worker } = buildWorker(1234);
      service.observer(worker);
      service.observer(worker);

      expect(mockStore.workers.size).toBe(1);
    });

    it('broadcasts WorkerDied, WorkerSubProcessClose and WorkerListenerError', () => {
      const { worker, onEmitter } = buildWorker(1234);
      service.observer(worker);

      const error = new Error('boom');
      onEmitter.emit('died', error);
      expect(eventEmitter.emit).toHaveBeenCalledWith('WorkerDied', { pid: 1234, data: { error } });

      onEmitter.emit('subprocessclose');
      expect(eventEmitter.emit).toHaveBeenCalledWith('WorkerSubProcessClose', { pid: 1234 });

      onEmitter.emit('listenererror', 'died', error);
      expect(eventEmitter.emit).toHaveBeenCalledWith('WorkerListenerError', { pid: 1234, data: { event: 'died', error } });
    });

    it('removes the worker and broadcasts WorkerClose on observer close', () => {
      const { worker, observerEmitter } = buildWorker(1234);
      service.observer(worker);

      observerEmitter.emit('close');

      expect(mockStore.workers.has(1234)).toBe(false);
      expect(eventEmitter.emit).toHaveBeenCalledWith('WorkerClose', { pid: 1234 });
    });
  });

  describe('Router lifecycle', () => {
    it('registers a new router, broadcasts RouterCreated and increments worker usage', () => {
      const { worker, observerEmitter: workerObs } = buildWorker(1000);
      service.observer(worker);

      const { router } = buildRouter('router-1', 1000);
      workerObs.emit('newrouter', router);

      expect(mockStore.routers.get('router-1')).toBe(router);
      expect(eventEmitter.emit).toHaveBeenCalledWith('RouterCreated', { id: 'router-1' });
      expect(worker.appData.count.routers).toBe(1);
      expect(eventEmitter.emit).toHaveBeenCalledWith('WorkerResourceUsageAdjusted', {
        pid: 1000,
        data: { action: 'increment', count: 1, type: 'routers' },
      });
    });

    it('broadcasts RouterWorkerClose and removes the router on workerclose', () => {
      const { worker, observerEmitter: workerObs } = buildWorker(1000);
      service.observer(worker);
      const { router, onEmitter } = buildRouter('router-1', 1000);
      workerObs.emit('newrouter', router);

      onEmitter.emit('workerclose');

      expect(mockStore.routers.has('router-1')).toBe(false);
      expect(eventEmitter.emit).toHaveBeenCalledWith('RouterWorkerClose', { id: 'router-1' });
    });

    it('broadcasts RouterListenerError', () => {
      const { worker, observerEmitter: workerObs } = buildWorker(1000);
      service.observer(worker);
      const { router, onEmitter } = buildRouter('router-1', 1000);
      workerObs.emit('newrouter', router);

      const error = new Error('router error');
      onEmitter.emit('listenererror', 'workerclose', error);

      expect(eventEmitter.emit).toHaveBeenCalledWith('RouterListenerError', { id: 'router-1', data: { event: 'workerclose', error } });
    });

    it('removes the router, broadcasts RouterClose and decrements worker usage on observer close', () => {
      const { worker, observerEmitter: workerObs } = buildWorker(1000);
      service.observer(worker);
      const { router, observerEmitter } = buildRouter('router-1', 1000);
      workerObs.emit('newrouter', router);

      observerEmitter.emit('close');

      expect(mockStore.routers.has('router-1')).toBe(false);
      expect(eventEmitter.emit).toHaveBeenCalledWith('RouterClose', { id: 'router-1' });
      expect(worker.appData.count.routers).toBe(0);
    });
  });

  describe('Transport lifecycle', () => {
    const registerRouter = () => {
      const { worker, observerEmitter: workerObs } = buildWorker(1000);
      service.observer(worker);
      const { router, observerEmitter: routerObs } = buildRouter('router-1', 1000);
      workerObs.emit('newrouter', router);
      return { worker, router, routerObs };
    };

    it('registers a webrtc transport, broadcasts events and cascades usage', () => {
      const { router, routerObs } = registerRouter();
      const { transport, onEmitter } = buildTransport('t1', 'router-1', 'webrtc');

      routerObs.emit('newtransport', transport);

      expect(mockStore.transports.get('t1')).toBe(transport);
      expect(eventEmitter.emit).toHaveBeenCalledWith('TransportCreated', { id: 't1' });
      expect(router.appData.count.transports).toBe(1);

      onEmitter.emit('icestatechange', 'connected');
      expect(eventEmitter.emit).toHaveBeenCalledWith('WebRtcIceStateChange', { id: 't1', data: 'connected' });

      onEmitter.emit('iceselectedtuplechange', { local: {} });
      expect(eventEmitter.emit).toHaveBeenCalledWith('WebRtcIceSelectedTupleChange', { id: 't1', data: { local: {} } });

      onEmitter.emit('dtlsstatechange', 'connecting');
      expect(eventEmitter.emit).toHaveBeenCalledWith('WebRtcDtlsChange', { id: 't1', data: 'connecting' });

      onEmitter.emit('sctpstatechange', 'connecting');
      expect(eventEmitter.emit).toHaveBeenCalledWith('WebRtcSctpStateChange', { id: 't1', data: 'connecting' });
    });

    it('registers a plain transport and proxies its specific events', () => {
      const { routerObs } = registerRouter();
      const { transport, onEmitter } = buildTransport('t2', 'router-1', 'plain');

      routerObs.emit('newtransport', transport);

      onEmitter.emit('tuple', { proto: 'udp' });
      expect(eventEmitter.emit).toHaveBeenCalledWith('PlainTransportTuple', { id: 't2', data: { proto: 'udp' } });

      onEmitter.emit('rtcptuple', { proto: 'udp' });
      expect(eventEmitter.emit).toHaveBeenCalledWith('PlainTransportRtcpTuple', { id: 't2', data: { proto: 'udp' } });

      onEmitter.emit('sctpstatechange', 'connected');
      expect(eventEmitter.emit).toHaveBeenCalledWith('PlainTransportSctpStateChange', { id: 't2', data: 'connected' });
    });

    it('registers a pipe transport and proxies its specific event', () => {
      const { routerObs } = registerRouter();
      const { transport, onEmitter } = buildTransport('t3', 'router-1', 'pipe');

      routerObs.emit('newtransport', transport);

      onEmitter.emit('sctpstatechange', 'connected');
      expect(eventEmitter.emit).toHaveBeenCalledWith('PipeTransportSctpStateChange', { id: 't3', data: 'connected' });
    });

    it('registers a direct transport and proxies its specific event', () => {
      const { routerObs } = registerRouter();
      const { transport, onEmitter } = buildTransport('t4', 'router-1', 'direct');
      const buffer = Buffer.from('rtcp');

      routerObs.emit('newtransport', transport);

      onEmitter.emit('rtcp', buffer);
      expect(eventEmitter.emit).toHaveBeenCalledWith('DirectTransportRtcp', { id: 't4', data: buffer });
    });

    it('enables trace events when transportTrace is enabled', () => {
      mockOptions.transportTrace = { enable: true, events: ['probation'] as any };
      const { routerObs } = registerRouter();
      const { transport } = buildTransport('t5', 'router-1', 'webrtc');

      routerObs.emit('newtransport', transport);

      expect(transport.enableTraceEvent).toHaveBeenCalledWith(['probation']);
    });

    it('logs an error when enabling transport trace events fails', async () => {
      mockOptions.transportTrace = { enable: true, events: ['probation'] as any };
      const { routerObs } = registerRouter();
      const { transport } = buildTransport('t6', 'router-1', 'webrtc');
      (transport.enableTraceEvent as jest.Mock).mockRejectedValue(new Error('trace failed'));

      routerObs.emit('newtransport', transport);
      await Promise.resolve();
      await Promise.resolve();

      expect(logger.error).toHaveBeenCalled();
    });

    it('broadcasts general transport events', () => {
      const { routerObs } = registerRouter();
      const { transport, onEmitter } = buildTransport('t7', 'router-1', 'webrtc');
      routerObs.emit('newtransport', transport);

      onEmitter.emit('routerclose');
      expect(eventEmitter.emit).toHaveBeenCalledWith('TransportRouterClose', { id: 't7' });

      onEmitter.emit('listenserverclose');
      expect(eventEmitter.emit).toHaveBeenCalledWith('TransportListenServerClose', { id: 't7' });

      const trace = { type: 'probation' };
      onEmitter.emit('trace', trace);
      expect(eventEmitter.emit).toHaveBeenCalledWith('TransportTrace', { id: 't7', data: trace });

      const error = new Error('boom');
      onEmitter.emit('listenererror', 'trace', error);
      expect(eventEmitter.emit).toHaveBeenCalledWith('TransportListenerError', { id: 't7', data: { event: 'trace', error } });
    });

    it('removes the transport, broadcasts TransportClose and decrements router usage on observer close', () => {
      const { router, routerObs } = registerRouter();
      const { transport, observerEmitter } = buildTransport('t8', 'router-1', 'webrtc');
      routerObs.emit('newtransport', transport);

      observerEmitter.emit('close');

      expect(mockStore.transports.has('t8')).toBe(false);
      expect(eventEmitter.emit).toHaveBeenCalledWith('TransportClose', { id: 't8' });
      expect(router.appData.count.transports).toBe(0);
    });
  });

  describe('Consumer lifecycle (via transport)', () => {
    const registerTransport = () => {
      const { worker, observerEmitter: workerObs } = buildWorker(1000);
      service.observer(worker);
      const { router, observerEmitter: routerObs } = buildRouter('router-1', 1000);
      workerObs.emit('newrouter', router);
      const { transport, observerEmitter: transportObs } = buildTransport('t1', 'router-1', 'webrtc');
      routerObs.emit('newtransport', transport);
      return { router, transportObs };
    };

    it('registers a consumer, broadcasts ConsumerCreated and increments router usage', () => {
      const { router, transportObs } = registerTransport();
      const { consumer } = buildConsumer('c1', 'router-1');

      transportObs.emit('newconsumer', consumer);

      expect(mockStore.consumers.get('c1')).toBe(consumer);
      expect(eventEmitter.emit).toHaveBeenCalledWith('ConsumerCreated', { id: 'c1' });
      expect(router.appData.count.consumers).toBe(1);
    });

    it('proxies consumer instance events', () => {
      const { transportObs } = registerTransport();
      const { consumer, onEmitter } = buildConsumer('c2', 'router-1');
      transportObs.emit('newconsumer', consumer);

      onEmitter.emit('transportclose');
      expect(eventEmitter.emit).toHaveBeenCalledWith('ConsumerTransportClose', { id: 'c2' });

      onEmitter.emit('producerclose');
      expect(eventEmitter.emit).toHaveBeenCalledWith('ConsumerProducerClose', { id: 'c2' });

      onEmitter.emit('producerpause');
      expect(eventEmitter.emit).toHaveBeenCalledWith('ConsumerProducerPause', { id: 'c2' });

      onEmitter.emit('producerresume');
      expect(eventEmitter.emit).toHaveBeenCalledWith('ConsumerProducerResume', { id: 'c2' });

      const score = { score: 8, producerScore: 9 };
      onEmitter.emit('score', score);
      expect(eventEmitter.emit).toHaveBeenCalledWith('ConsumerScore', { id: 'c2', data: score });

      onEmitter.emit('layerschange', { spatialLayer: 1 });
      expect(eventEmitter.emit).toHaveBeenCalledWith('ConsumerLayersChange', { id: 'c2', data: { spatialLayer: 1 } });

      const trace = { type: 'rtp' };
      onEmitter.emit('trace', trace);
      expect(eventEmitter.emit).toHaveBeenCalledWith('ConsumerTrace', { id: 'c2', data: trace });

      const rtp = Buffer.from('rtp');
      onEmitter.emit('rtp', rtp);
      expect(eventEmitter.emit).toHaveBeenCalledWith('ConsumerRtp', { id: 'c2', data: rtp });

      const error = new Error('boom');
      onEmitter.emit('listenererror', 'score', error);
      expect(eventEmitter.emit).toHaveBeenCalledWith('ConsumerListenerError', { id: 'c2', data: { event: 'score', error } });
    });

    it('enables consumer trace events when consumerTrace is enabled', () => {
      mockOptions.consumerTrace = { enable: true, events: ['rtp'] as any };
      const { transportObs } = registerTransport();
      const { consumer } = buildConsumer('c3', 'router-1');

      transportObs.emit('newconsumer', consumer);

      expect(consumer.enableTraceEvent).toHaveBeenCalledWith(['rtp']);
    });

    it('broadcasts pause/resume and close on observer events, decrementing router usage', () => {
      const { router, transportObs } = registerTransport();
      const { consumer, observerEmitter } = buildConsumer('c4', 'router-1');
      transportObs.emit('newconsumer', consumer);

      observerEmitter.emit('pause');
      expect(eventEmitter.emit).toHaveBeenCalledWith('ConsumerPause', { id: 'c4' });

      observerEmitter.emit('resume');
      expect(eventEmitter.emit).toHaveBeenCalledWith('ConsumerResume', { id: 'c4' });

      observerEmitter.emit('close');
      expect(mockStore.consumers.has('c4')).toBe(false);
      expect(eventEmitter.emit).toHaveBeenCalledWith('ConsumerClose', { id: 'c4' });
      expect(router.appData.count.consumers).toBe(0);
    });
  });

  describe('Producer lifecycle (via transport)', () => {
    const registerTransport = () => {
      const { worker, observerEmitter: workerObs } = buildWorker(1000);
      service.observer(worker);
      const { router, observerEmitter: routerObs } = buildRouter('router-1', 1000);
      workerObs.emit('newrouter', router);
      const { transport, observerEmitter: transportObs } = buildTransport('t1', 'router-1', 'webrtc');
      routerObs.emit('newtransport', transport);
      return { router, transportObs };
    };

    it('registers a producer, broadcasts ProducerCreated and increments router usage', () => {
      const { router, transportObs } = registerTransport();
      const { producer } = buildProducer('p1', 'router-1');

      transportObs.emit('newproducer', producer);

      expect(mockStore.producers.get('p1')).toBe(producer);
      expect(eventEmitter.emit).toHaveBeenCalledWith('ProducerCreated', { id: 'p1' });
      expect(router.appData.count.producers).toBe(1);
    });

    it('proxies producer instance events', () => {
      const { transportObs } = registerTransport();
      const { producer, onEmitter } = buildProducer('p2', 'router-1');
      transportObs.emit('newproducer', producer);

      onEmitter.emit('transportclose');
      expect(eventEmitter.emit).toHaveBeenCalledWith('ProducerTransportClose', { id: 'p2' });

      const score = [{ ssrc: 1, score: 9 }];
      onEmitter.emit('score', score);
      expect(eventEmitter.emit).toHaveBeenCalledWith('ProducerScore', { id: 'p2', data: score });

      const orientation = { camera: true, flip: false, rotation: 0 };
      onEmitter.emit('videoorientationchange', orientation);
      expect(eventEmitter.emit).toHaveBeenCalledWith('ProducerVideoOrientationChange', { id: 'p2', data: orientation });

      const trace = { type: 'keyframe' };
      onEmitter.emit('trace', trace);
      expect(eventEmitter.emit).toHaveBeenCalledWith('ProducerTrace', { id: 'p2', data: trace });

      const error = new Error('boom');
      onEmitter.emit('listenererror', 'score', error);
      expect(eventEmitter.emit).toHaveBeenCalledWith('ProducerListenerError', { id: 'p2', data: { event: 'score', error } });
    });

    it('enables producer trace events when producerTrace is enabled', () => {
      mockOptions.producerTrace = { enable: true, events: ['keyframe'] as any };
      const { transportObs } = registerTransport();
      const { producer } = buildProducer('p3', 'router-1');

      transportObs.emit('newproducer', producer);

      expect(producer.enableTraceEvent).toHaveBeenCalledWith(['keyframe']);
    });

    it('broadcasts pause/resume and close on observer events, decrementing router usage', () => {
      const { router, transportObs } = registerTransport();
      const { producer, observerEmitter } = buildProducer('p4', 'router-1');
      transportObs.emit('newproducer', producer);

      observerEmitter.emit('pause');
      expect(eventEmitter.emit).toHaveBeenCalledWith('ProducerPause', { id: 'p4' });

      observerEmitter.emit('resume');
      expect(eventEmitter.emit).toHaveBeenCalledWith('ProducerResume', { id: 'p4' });

      observerEmitter.emit('close');
      expect(mockStore.producers.has('p4')).toBe(false);
      expect(eventEmitter.emit).toHaveBeenCalledWith('ProducerClose', { id: 'p4' });
      expect(router.appData.count.producers).toBe(0);
    });
  });

  describe('DataConsumer lifecycle (via transport)', () => {
    const registerTransport = () => {
      const { worker, observerEmitter: workerObs } = buildWorker(1000);
      service.observer(worker);
      const { router, observerEmitter: routerObs } = buildRouter('router-1', 1000);
      workerObs.emit('newrouter', router);
      const { transport, observerEmitter: transportObs } = buildTransport('t1', 'router-1', 'webrtc');
      routerObs.emit('newtransport', transport);
      return { router, transportObs };
    };

    it('registers a data consumer, broadcasts DataConsumerCreated and increments router usage', () => {
      const { router, transportObs } = registerTransport();
      const { dataConsumer } = buildDataConsumer('dc1', 'router-1');

      transportObs.emit('newdataconsumer', dataConsumer);

      expect(mockStore.dataConsumers.get('dc1')).toBe(dataConsumer);
      expect(eventEmitter.emit).toHaveBeenCalledWith('DataConsumerCreated', { id: 'dc1' });
      expect(router.appData.count.dataConsumers).toBe(1);
    });

    it('proxies data consumer instance events', () => {
      const { transportObs } = registerTransport();
      const { dataConsumer, onEmitter } = buildDataConsumer('dc2', 'router-1');
      transportObs.emit('newdataconsumer', dataConsumer);

      onEmitter.emit('transportclose');
      expect(eventEmitter.emit).toHaveBeenCalledWith('DataConsumerTransportClose', { id: 'dc2' });

      const error = new Error('boom');
      onEmitter.emit('listenererror', 'message', error);
      expect(eventEmitter.emit).toHaveBeenCalledWith('DataConsumerListenerError', { id: 'dc2', data: { event: 'message', error } });

      onEmitter.emit('dataproducerclose');
      expect(eventEmitter.emit).toHaveBeenCalledWith('DataConsumerDataProducerClose', { id: 'dc2' });

      onEmitter.emit('dataproducerpause');
      expect(eventEmitter.emit).toHaveBeenCalledWith('DataConsumerDataProducerPause', { id: 'dc2' });

      onEmitter.emit('dataproducerresume');
      expect(eventEmitter.emit).toHaveBeenCalledWith('DataConsumerDataProducerResume', { id: 'dc2' });

      const message = Buffer.from('hello');
      onEmitter.emit('message', message, 51);
      expect(eventEmitter.emit).toHaveBeenCalledWith('DataConsumerMessage', { id: 'dc2', data: { message, ppid: 51 } });

      onEmitter.emit('sctpsendbufferfull');
      expect(eventEmitter.emit).toHaveBeenCalledWith('DataConsumerSctpSendBufferFull', { id: 'dc2' });

      onEmitter.emit('bufferedamountlow', 12);
      expect(eventEmitter.emit).toHaveBeenCalledWith('DataConsumerBufferedAmountLow', { id: 'dc2', data: 12 });
    });

    it('broadcasts pause/resume and close on observer events, decrementing router usage', () => {
      const { router, transportObs } = registerTransport();
      const { dataConsumer, observerEmitter } = buildDataConsumer('dc3', 'router-1');
      transportObs.emit('newdataconsumer', dataConsumer);

      observerEmitter.emit('pause');
      expect(eventEmitter.emit).toHaveBeenCalledWith('DataConsumerPause', { id: 'dc3' });

      observerEmitter.emit('resume');
      expect(eventEmitter.emit).toHaveBeenCalledWith('DataConsumerResume', { id: 'dc3' });

      observerEmitter.emit('close');
      expect(mockStore.dataConsumers.has('dc3')).toBe(false);
      expect(eventEmitter.emit).toHaveBeenCalledWith('DataConsumerClose', { id: 'dc3' });
      expect(router.appData.count.dataConsumers).toBe(0);
    });
  });

  describe('DataProducer lifecycle (via transport)', () => {
    const registerTransport = () => {
      const { worker, observerEmitter: workerObs } = buildWorker(1000);
      service.observer(worker);
      const { router, observerEmitter: routerObs } = buildRouter('router-1', 1000);
      workerObs.emit('newrouter', router);
      const { transport, observerEmitter: transportObs } = buildTransport('t1', 'router-1', 'webrtc');
      routerObs.emit('newtransport', transport);
      return { router, transportObs };
    };

    it('registers a data producer, broadcasts DataProducerCreated and increments router usage', () => {
      const { router, transportObs } = registerTransport();
      const { dataProducer } = buildDataProducer('dp1', 'router-1');

      transportObs.emit('newdataproducer', dataProducer);

      expect(mockStore.dataProducers.get('dp1')).toBe(dataProducer);
      expect(eventEmitter.emit).toHaveBeenCalledWith('DataProducerCreated', { id: 'dp1' });
      expect(router.appData.count.dataProducers).toBe(1);
    });

    it('proxies data producer instance events', () => {
      const { transportObs } = registerTransport();
      const { dataProducer, onEmitter } = buildDataProducer('dp2', 'router-1');
      transportObs.emit('newdataproducer', dataProducer);

      onEmitter.emit('transportclose');
      expect(eventEmitter.emit).toHaveBeenCalledWith('DataProducerTransportClose', { id: 'dp2' });

      const error = new Error('boom');
      onEmitter.emit('listenererror', 'transportclose', error);
      expect(eventEmitter.emit).toHaveBeenCalledWith('DataProducerListenerError', { id: 'dp2', data: { event: 'transportclose', error } });
    });

    it('broadcasts pause/resume and close on observer events, decrementing router usage', () => {
      const { router, transportObs } = registerTransport();
      const { dataProducer, observerEmitter } = buildDataProducer('dp3', 'router-1');
      transportObs.emit('newdataproducer', dataProducer);

      observerEmitter.emit('pause');
      expect(eventEmitter.emit).toHaveBeenCalledWith('DataProducerPause', { id: 'dp3' });

      observerEmitter.emit('resume');
      expect(eventEmitter.emit).toHaveBeenCalledWith('DataProducerResume', { id: 'dp3' });

      observerEmitter.emit('close');
      expect(mockStore.dataProducers.has('dp3')).toBe(false);
      expect(eventEmitter.emit).toHaveBeenCalledWith('DataProducerClose', { id: 'dp3' });
      expect(router.appData.count.dataProducers).toBe(0);
    });
  });

  describe('RtpObserver lifecycle (via router)', () => {
    const registerRouter = () => {
      const { worker, observerEmitter: workerObs } = buildWorker(1000);
      service.observer(worker);
      const { router, observerEmitter: routerObs } = buildRouter('router-1', 1000);
      workerObs.emit('newrouter', router);
      return { router, routerObs };
    };

    it('registers an audio level observer and proxies its specific events', () => {
      const { router, routerObs } = registerRouter();
      const { rtpObserver, onEmitter } = buildRtpObserver('o1', 'router-1', 'audiolevel');

      routerObs.emit('newrtpobserver', rtpObserver);

      expect(mockStore.rtpObservers.get('o1')).toBe(rtpObserver);
      expect(eventEmitter.emit).toHaveBeenCalledWith('RtpObserverCreated', { id: 'o1' });
      expect(router.appData.count.rtpObservers).toBe(1);

      onEmitter.emit('silence');
      expect(eventEmitter.emit).toHaveBeenCalledWith('RtpObserverSilence', { id: 'o1' });

      const volumes = [{ producer: {}, volume: -10 }];
      onEmitter.emit('volumes', volumes);
      expect(eventEmitter.emit).toHaveBeenCalledWith('RtpObserverVolumes', { id: 'o1', data: volumes });
    });

    it('registers an active speaker observer and proxies its specific event', () => {
      const { routerObs } = registerRouter();
      const { rtpObserver, onEmitter } = buildRtpObserver('o2', 'router-1', 'activespeaker');

      routerObs.emit('newrtpobserver', rtpObserver);

      const dominantSpeaker = { producer: {} };
      onEmitter.emit('dominantspeaker', dominantSpeaker);
      expect(eventEmitter.emit).toHaveBeenCalledWith('RtpObserverDominantSpeaker', { id: 'o2', data: dominantSpeaker });
    });

    it('broadcasts RtpObserverListenerError', () => {
      const { routerObs } = registerRouter();
      const { rtpObserver, onEmitter } = buildRtpObserver('o3', 'router-1', 'audiolevel');
      routerObs.emit('newrtpobserver', rtpObserver);

      const error = new Error('boom');
      onEmitter.emit('listenererror', 'silence', error);
      expect(eventEmitter.emit).toHaveBeenCalledWith('RtpObserverListenerError', { id: 'o3', data: { event: 'silence', error } });
    });

    it('broadcasts pause/resume and close on observer events, decrementing router usage', () => {
      const { router, routerObs } = registerRouter();
      const { rtpObserver, observerEmitter } = buildRtpObserver('o4', 'router-1', 'audiolevel');
      routerObs.emit('newrtpobserver', rtpObserver);

      observerEmitter.emit('pause');
      expect(eventEmitter.emit).toHaveBeenCalledWith('RtpObserverPause', { id: 'o4' });

      observerEmitter.emit('resume');
      expect(eventEmitter.emit).toHaveBeenCalledWith('RtpObserverResume', { id: 'o4' });

      observerEmitter.emit('close');
      expect(mockStore.rtpObservers.has('o4')).toBe(false);
      expect(eventEmitter.emit).toHaveBeenCalledWith('RtpObserverClose', { id: 'o4' });
      expect(router.appData.count.rtpObservers).toBe(0);
    });
  });

  describe('WebRtcServer lifecycle (via worker)', () => {
    it('registers a webrtc server and broadcasts WebRtcServerCreated', () => {
      const { worker, observerEmitter: workerObs } = buildWorker(1000);
      service.observer(worker);
      const { webRtcServer } = buildWebRtcServer('srv1');

      workerObs.emit('newwebrtcserver', webRtcServer);

      expect(mockStore.webRtcServers.get('srv1')).toBe(webRtcServer);
      expect(eventEmitter.emit).toHaveBeenCalledWith('WebRtcServerCreated', { id: 'srv1' });
    });

    it('broadcasts WebRtcServerTransportHandled and WebRtcServerTransportUnhandled', () => {
      const { worker, observerEmitter: workerObs } = buildWorker(1000);
      service.observer(worker);
      const { webRtcServer, observerEmitter } = buildWebRtcServer('srv2');
      workerObs.emit('newwebrtcserver', webRtcServer);

      const handledTransport = { id: 't1' };
      observerEmitter.emit('webrtctransporthandled', handledTransport);
      expect(eventEmitter.emit).toHaveBeenCalledWith('WebRtcServerTransportHandled', { id: 'srv2', data: handledTransport });

      const unhandledTransport = { id: 't2' };
      observerEmitter.emit('webrtctransportunhandled', unhandledTransport);
      expect(eventEmitter.emit).toHaveBeenCalledWith('WebRtcServerTransportUnhandled', { id: 'srv2', data: unhandledTransport });
    });

    it('broadcasts WebRtcServerListenerError', () => {
      const { worker, observerEmitter: workerObs } = buildWorker(1000);
      service.observer(worker);
      const { webRtcServer, observerEmitter } = buildWebRtcServer('srv3');
      workerObs.emit('newwebrtcserver', webRtcServer);

      const error = new Error('boom');
      observerEmitter.emit('listenererror', 'webrtctransporthandled', error);
      expect(eventEmitter.emit).toHaveBeenCalledWith('WebRtcServerListenerError', {
        id: 'srv3',
        data: { event: 'webrtctransporthandled', error },
      });
    });

    it('removes the webrtc server and broadcasts WebRtcServerClose', () => {
      const { worker, observerEmitter: workerObs } = buildWorker(1000);
      service.observer(worker);
      const { webRtcServer, observerEmitter } = buildWebRtcServer('srv4');
      workerObs.emit('newwebrtcserver', webRtcServer);

      observerEmitter.emit('close');

      expect(mockStore.webRtcServers.has('srv4')).toBe(false);
      expect(eventEmitter.emit).toHaveBeenCalledWith('WebRtcServerClose', { id: 'srv4' });
    });
  });
});
