/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { createWorker } from 'mediasoup';
import { MediasoupService } from '@/mediasoup/services/mediasoup/mediasoup.service';
import { MediasoupToken } from '@/mediasoup/mediasoup.interface';
import { MediasoupException } from '@/mediasoup/mediasoup.exception';
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

// Only mock the parts of the native `mediasoup` package that would otherwise
// spawn real worker processes; keep everything else (e.g. `types`) real.
jest.mock('mediasoup', () => ({
  ...jest.requireActual('mediasoup'),
  createWorker: jest.fn(),
}));

const mockedCreateWorker = createWorker as jest.MockedFunction<typeof createWorker>;

describe('MediasoupService', () => {
  let service: MediasoupService;
  let mockStore: MutableMediasoupResourceStore;
  let mockOptions: MediasoupModuleOptions;

  const createMockWorker = (pid: number): Worker => {
    return {
      pid,
      appData: {
        count: { routers: 0, consumers: 0, producers: 0, transports: 0, rtpObservers: 0, dataConsumers: 0, dataProducers: 0 },
        timestamp: Date.now(),
      },
      createWebRtcServer: jest.fn(),
      createRouter: jest.fn(),
      close: jest.fn(),
    } as unknown as Worker;
  };

  const createMockRouter = (id: string, workerPid: number): Router => {
    return {
      id,
      appData: {
        workerPid,
        timestamp: Date.now(),
        count: { consumers: 0, producers: 0, transports: 0, rtpObservers: 0, dataConsumers: 0, dataProducers: 0 },
      },
      createDirectTransport: jest.fn(),
      createPipeTransport: jest.fn(),
      createPlainTransport: jest.fn(),
      createWebRtcTransport: jest.fn(),
      createActiveSpeakerObserver: jest.fn(),
      createAudioLevelObserver: jest.fn(),
      canConsume: jest.fn(),
    } as unknown as Router;
  };

  const createMockTransport = (id: string, routerId: string, type: string): Transport => {
    return {
      id,
      type,
      appData: { routerId, timestamp: Date.now(), connected: false, reconnectCount: 0 },
      consume: jest.fn(),
      produce: jest.fn(),
      consumeData: jest.fn(),
      produceData: jest.fn(),
    } as unknown as Transport;
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediasoupService,
        { provide: MediasoupToken.CURRENT_WORKER, useValue: 0 },
        { provide: MediasoupToken.RESOURCE_STORE, useValue: mockStore },
        { provide: MediasoupToken.MODULE_OPTIONS, useValue: mockOptions },
      ],
    }).compile();

    service = module.get<MediasoupService>(MediasoupService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createWorker', () => {
    it('should create a worker with merged settings and default appData, without a webrtc server when disabled', async () => {
      const mockWorker = createMockWorker(5000);
      mockedCreateWorker.mockResolvedValue(mockWorker);
      mockOptions.workerSettings = { logLevel: 'warn' } as any;

      const result = await service.createWorker({ rtcMinPort: 10000 });

      expect(mockedCreateWorker).toHaveBeenCalledWith(
        expect.objectContaining({
          logLevel: 'warn',
          rtcMinPort: 10000,
          appData: expect.objectContaining({
            count: expect.objectContaining({
              routers: 0,
              consumers: 0,
              producers: 0,
              transports: 0,
              rtpObservers: 0,
              dataConsumers: 0,
              dataProducers: 0,
            }),
          }),
        }),
      );
      expect(result).toBe(mockWorker);
      expect(mockWorker.createWebRtcServer).not.toHaveBeenCalled();
    });

    it('should create a WebRtcServer with a port offset based on existing worker count when enabled', async () => {
      mockStore.workers.set(1, createMockWorker(1));
      mockOptions.webRtcServer = {
        enable: true,
        options: { listenInfos: [{ ip: '0.0.0.0', port: 40000 }] } as any,
      };
      const mockWorker = createMockWorker(6000);
      mockedCreateWorker.mockResolvedValue(mockWorker);

      await service.createWorker();

      expect(mockWorker.createWebRtcServer).toHaveBeenCalledWith(
        expect.objectContaining({
          listenInfos: [expect.objectContaining({ port: 40000 })],
          appData: expect.objectContaining({ workerPid: 6000 }),
        }),
      );
    });
  });

  describe('getWorkers', () => {
    it('should return all tracked workers', () => {
      const worker = createMockWorker(1);
      mockStore.workers.set(1, worker);

      expect(service.getWorkers()).toEqual([worker]);
    });
  });

  describe('getWorkerByPid', () => {
    it('should return a worker if it exists in the store', () => {
      const mockWorker = { pid: 1234, appData: {} } as unknown as Worker;
      mockStore.workers.set(1234, mockWorker);

      const result = service.getWorkerByPid(1234);
      expect(result).toBe(mockWorker);
      expect(result.pid).toEqual(1234);
    });

    it('should throw a MediasoupException if the worker is not found', () => {
      expect(() => service.getWorkerByPid(9999)).toThrow(MediasoupException);
      expect(() => service.getWorkerByPid(9999)).toThrow('Worker with PID 9999 not found');
    });
  });

  describe('getWorkerByRouterId', () => {
    it('should return the worker that hosts the given router', () => {
      const worker = createMockWorker(42);
      const router = createMockRouter('router-a', 42);
      mockStore.workers.set(42, worker);
      mockStore.routers.set('router-a', router);

      expect(service.getWorkerByRouterId('router-a')).toBe(worker);
    });
  });

  describe('getRoundRobinWorker', () => {
    it('should throw if no workers are available', () => {
      expect(() => service.getRoundRobinWorker()).toThrow(MediasoupException);
      expect(() => service.getRoundRobinWorker()).toThrow('No workers available');
    });

    it('should cycle through workers in round robin order', () => {
      const w1 = createMockWorker(1);
      const w2 = createMockWorker(2);
      mockStore.workers.set(1, w1);
      mockStore.workers.set(2, w2);

      expect(service.getRoundRobinWorker()).toBe(w1);
      expect(service.getRoundRobinWorker()).toBe(w2);
      expect(service.getRoundRobinWorker()).toBe(w1);
    });

    it('should exclude a single PID when exceptPid is provided', () => {
      const w1 = createMockWorker(1);
      const w2 = createMockWorker(2);
      mockStore.workers.set(1, w1);
      mockStore.workers.set(2, w2);

      expect(service.getRoundRobinWorker(1)).toBe(w2);
    });

    it('should exclude multiple PIDs when exceptPid is an array', () => {
      const w1 = createMockWorker(1);
      const w2 = createMockWorker(2);
      const w3 = createMockWorker(3);
      mockStore.workers.set(1, w1);
      mockStore.workers.set(2, w2);
      mockStore.workers.set(3, w3);

      expect(service.getRoundRobinWorker([1, 2])).toBe(w3);
    });

    it('should throw MediasoupException when exceptPid excludes all workers', () => {
      mockStore.workers.set(1, createMockWorker(1));

      expect(() => service.getRoundRobinWorker(1)).toThrow(MediasoupException);
      expect(() => service.getRoundRobinWorker(1)).toThrow('Worker limit exceed');
    });
  });

  describe('WebRtc server getters', () => {
    it('should return all webrtc servers', () => {
      const server = { id: 'srv-1', appData: { workerPid: 1 } } as unknown as WebRtcServer;
      mockStore.webRtcServers.set('srv-1', server);
      expect(service.getWebRtcServers()).toEqual([server]);
    });

    it('should return a webrtc server by id', () => {
      const server = { id: 'srv-1', appData: { workerPid: 1 } } as unknown as WebRtcServer;
      mockStore.webRtcServers.set('srv-1', server);
      expect(service.getWebRtcServerById('srv-1')).toBe(server);
    });

    it('should throw if the webrtc server is not found', () => {
      expect(() => service.getWebRtcServerById('missing')).toThrow(MediasoupException);
    });

    it('should filter webrtc servers by worker pid(s)', () => {
      const s1 = { id: 's1', appData: { workerPid: 1 } } as unknown as WebRtcServer;
      const s2 = { id: 's2', appData: { workerPid: 2 } } as unknown as WebRtcServer;
      mockStore.webRtcServers.set('s1', s1);
      mockStore.webRtcServers.set('s2', s2);

      expect(service.getWebRtcServersByWorkerPid(1)).toEqual([s1]);
      expect(service.getWebRtcServersByWorkerPid([1, 2])).toEqual([s1, s2]);
    });
  });

  describe('createRouter', () => {
    it('should create a router on the given worker with default mediaCodecs', async () => {
      const worker = createMockWorker(1);
      (worker.createRouter as jest.Mock).mockResolvedValue({ id: 'r1' });
      mockOptions.mediaCodecs = [{ kind: 'audio' } as any];

      const router = await service.createRouter({ worker });

      expect(worker.createRouter).toHaveBeenCalledWith(
        expect.objectContaining({
          mediaCodecs: mockOptions.mediaCodecs,
          appData: expect.objectContaining({ workerPid: 1 }),
        }),
      );
      expect(router).toEqual({ id: 'r1' });
    });

    it('should use round robin worker selection when no worker is provided', async () => {
      const worker = createMockWorker(1);
      (worker.createRouter as jest.Mock).mockResolvedValue({ id: 'r1' });
      mockStore.workers.set(1, worker);

      await service.createRouter();

      expect(worker.createRouter).toHaveBeenCalled();
    });

    it('should override default mediaCodecs when provided in call options', async () => {
      const worker = createMockWorker(1);
      (worker.createRouter as jest.Mock).mockResolvedValue({ id: 'r1' });
      const customCodecs = [{ kind: 'video' } as any];

      await service.createRouter({ worker, mediaCodecs: customCodecs });

      expect(worker.createRouter).toHaveBeenCalledWith(expect.objectContaining({ mediaCodecs: customCodecs }));
    });
  });

  describe('getRouters', () => {
    it('should return all tracked routers', () => {
      const router = createMockRouter('r1', 1);
      mockStore.routers.set('r1', router);
      expect(service.getRouters()).toEqual([router]);
    });
  });

  describe('getRouterById', () => {
    it('should return a router if it exists in the store', () => {
      const mockRouter = { id: 'router-id-1', appData: {} } as unknown as Router;
      mockStore.routers.set('router-id-1', mockRouter);

      const result = service.getRouterById('router-id-1');
      expect(result).toBe(mockRouter);
    });

    it('should throw a MediasoupException if the router is not found', () => {
      expect(() => service.getRouterById('invalid-router')).toThrow(MediasoupException);
    });
  });

  describe('getRoutersByWorkerPid', () => {
    it('should return routers belonging to a specific worker', () => {
      const r1 = createMockRouter('r1', 1);
      const r2 = createMockRouter('r2', 2);
      mockStore.routers.set('r1', r1);
      mockStore.routers.set('r2', r2);

      expect(service.getRoutersByWorkerPid(1)).toEqual([r1]);
    });
  });

  describe('Transport creation', () => {
    it('should create a direct transport merging defaults, module options and call options', async () => {
      const router = createMockRouter('router-1', 1);
      mockStore.routers.set('router-1', router);
      (router.createDirectTransport as jest.Mock).mockResolvedValue({ id: 't1' });

      const transport = await service.createDirectTransport('router-1', { maxSendMessageSize: 1000 });

      expect(router.createDirectTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          maxSendMessageSize: 1000,
          maxReceiveMessageSize: 262144,
          appData: expect.objectContaining({ routerId: 'router-1' }),
        }),
      );
      expect(transport).toEqual({ id: 't1' });
    });

    it('should create a pipe transport merging module and call options', async () => {
      const router = createMockRouter('router-1', 1);
      mockStore.routers.set('router-1', router);
      (router.createPipeTransport as jest.Mock).mockResolvedValue({ id: 't2' });
      mockOptions.pipeTransportOptions = { enableRtx: true };

      await service.createPipeTransport('router-1', { listenInfo: {} } as any);

      expect(router.createPipeTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          enableRtx: true,
          listenInfo: {},
          appData: expect.objectContaining({ routerId: 'router-1' }),
        }),
      );
    });

    it('should create a plain transport merging module and call options', async () => {
      const router = createMockRouter('router-1', 1);
      mockStore.routers.set('router-1', router);
      (router.createPlainTransport as jest.Mock).mockResolvedValue({ id: 't3' });

      await service.createPlainTransport('router-1');

      expect(router.createPlainTransport).toHaveBeenCalledWith(expect.objectContaining({ appData: expect.objectContaining({ routerId: 'router-1' }) }));
    });

    it('should create a webrtc transport merging module and call options', async () => {
      const router = createMockRouter('router-1', 1);
      mockStore.routers.set('router-1', router);
      (router.createWebRtcTransport as jest.Mock).mockResolvedValue({ id: 't4' });
      mockOptions.webRtcTransportOptions = { enableUdp: true };

      await service.createWebRtcTransport('router-1', { enableTcp: true } as any);

      expect(router.createWebRtcTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          enableUdp: true,
          enableTcp: true,
          appData: expect.objectContaining({ routerId: 'router-1' }),
        }),
      );
    });
  });

  describe('getTransportById', () => {
    it('should return a transport by id', () => {
      const transport = createMockTransport('t1', 'router-1', 'webrtc');
      mockStore.transports.set('t1', transport);
      expect(service.getTransportById('t1')).toBe(transport);
    });

    it('should throw if the transport is not found', () => {
      expect(() => service.getTransportById('missing')).toThrow(MediasoupException);
    });

    it('should return the transport when the requested type matches', () => {
      const transport = createMockTransport('t1', 'router-1', 'webrtc');
      mockStore.transports.set('t1', transport);
      expect(service.getTransportById('t1', 'webrtc')).toBe(transport);
    });

    it('should throw if the transport type does not match', () => {
      const transport = createMockTransport('t1', 'router-1', 'webrtc');
      mockStore.transports.set('t1', transport);
      expect(() => service.getTransportById('t1', 'plain')).toThrow(MediasoupException);
    });
  });

  describe('getTransportsByRouterId', () => {
    it('should return all transports for a router', () => {
      const t1 = createMockTransport('t1', 'router-1', 'webrtc');
      const t2 = createMockTransport('t2', 'router-2', 'plain');
      mockStore.transports.set('t1', t1);
      mockStore.transports.set('t2', t2);

      expect(service.getTransportsByRouterId('router-1')).toEqual([t1]);
    });

    it('should filter transports by router and type', () => {
      const t1 = createMockTransport('t1', 'router-1', 'webrtc');
      const t2 = createMockTransport('t2', 'router-1', 'plain');
      mockStore.transports.set('t1', t1);
      mockStore.transports.set('t2', t2);

      expect(service.getTransportsByRouterId('router-1', 'plain')).toEqual([t2]);
    });
  });

  describe('createConsumer', () => {
    it('should create a consumer when the router can consume it, marking direction as recv', async () => {
      const transport = createMockTransport('t1', 'router-1', 'webrtc');
      const router = createMockRouter('router-1', 1);
      mockStore.transports.set('t1', transport);
      mockStore.routers.set('router-1', router);
      (router.canConsume as jest.Mock).mockReturnValue(true);
      (transport.consume as jest.Mock).mockResolvedValue({ id: 'c1' });

      const consumer = await service.createConsumer('t1', 'p1', {});

      expect(transport.consume).toHaveBeenCalledWith(
        expect.objectContaining({
          producerId: 'p1',
          appData: expect.objectContaining({ routerId: 'router-1', transportId: 't1' }),
        }),
      );
      expect(transport.appData.direction).toBe('recv');
      expect(consumer).toEqual({ id: 'c1' });
    });

    it('should throw if the router cannot consume the producer', async () => {
      const transport = createMockTransport('t1', 'router-1', 'webrtc');
      const router = createMockRouter('router-1', 1);
      mockStore.transports.set('t1', transport);
      mockStore.routers.set('router-1', router);
      (router.canConsume as jest.Mock).mockReturnValue(false);

      await expect(service.createConsumer('t1', 'p1', {} as any)).rejects.toThrow(MediasoupException);
    });
  });

  describe('getConsumers / getConsumerById', () => {
    it('should return all consumers', () => {
      const consumer = { id: 'c1' } as unknown as Consumer;
      mockStore.consumers.set('c1', consumer);
      expect(service.getConsumers()).toEqual([consumer]);
    });

    it('should return a consumer by id', () => {
      const consumer = { id: 'c1' } as unknown as Consumer;
      mockStore.consumers.set('c1', consumer);
      expect(service.getConsumerById('c1')).toBe(consumer);
    });

    it('should throw if the consumer is not found', () => {
      expect(() => service.getConsumerById('missing')).toThrow(MediasoupException);
    });
  });

  describe('createProducer', () => {
    it('should create a producer, marking direction as send', async () => {
      const transport = createMockTransport('t1', 'router-1', 'webrtc');
      mockStore.transports.set('t1', transport);
      (transport.produce as jest.Mock).mockResolvedValue({ id: 'p1' });

      const producer = await service.createProducer('t1', 'audio', {} as any);

      expect(transport.produce).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'audio',
          appData: expect.objectContaining({ routerId: 'router-1', transportId: 't1' }),
        }),
      );
      expect(transport.appData.direction).toBe('send');
      expect(producer).toEqual({ id: 'p1' });
    });
  });

  describe('getProducers / getProducerById', () => {
    it('should return all producers', () => {
      const producer = { id: 'p1' } as unknown as Producer;
      mockStore.producers.set('p1', producer);
      expect(service.getProducers()).toEqual([producer]);
    });

    it('should return a producer by id', () => {
      const producer = { id: 'p1' } as unknown as Producer;
      mockStore.producers.set('p1', producer);
      expect(service.getProducerById('p1')).toBe(producer);
    });

    it('should throw if the producer is not found', () => {
      expect(() => service.getProducerById('missing')).toThrow(MediasoupException);
    });
  });

  describe('createDataConsumer', () => {
    it('should create a data consumer on the given transport', async () => {
      const transport = createMockTransport('t1', 'router-1', 'webrtc');
      mockStore.transports.set('t1', transport);
      (transport.consumeData as jest.Mock).mockResolvedValue({ id: 'dc1' });

      const dataConsumer = await service.createDataConsumer('t1', { dataProducerId: 'dp1' });

      expect(transport.consumeData).toHaveBeenCalledWith(
        expect.objectContaining({
          dataProducerId: 'dp1',
          appData: expect.objectContaining({ routerId: 'router-1' }),
        }),
      );
      expect(dataConsumer).toEqual({ id: 'dc1' });
    });
  });

  describe('getDataConsumers / getDataConsumerById', () => {
    it('should return all data consumers', () => {
      const dc = { id: 'dc1' } as unknown as DataConsumer;
      mockStore.dataConsumers.set('dc1', dc);
      expect(service.getDataConsumers()).toEqual([dc]);
    });

    it('should return a data consumer by id', () => {
      const dc = { id: 'dc1' } as unknown as DataConsumer;
      mockStore.dataConsumers.set('dc1', dc);
      expect(service.getDataConsumerById('dc1')).toBe(dc);
    });

    it('should throw if the data consumer is not found', () => {
      expect(() => service.getDataConsumerById('missing')).toThrow(MediasoupException);
    });
  });

  describe('createDataProducer', () => {
    it('should create a data producer on the given transport', async () => {
      const transport = createMockTransport('t1', 'router-1', 'webrtc');
      mockStore.transports.set('t1', transport);
      (transport.produceData as jest.Mock).mockResolvedValue({ id: 'dp1' });

      const dataProducer = await service.createDataProducer('t1', { label: 'chat' });

      expect(transport.produceData).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'chat',
          appData: expect.objectContaining({ routerId: 'router-1' }),
        }),
      );
      expect(dataProducer).toEqual({ id: 'dp1' });
    });
  });

  describe('getDataProducers / getDataProducerById', () => {
    it('should return all data producers', () => {
      const dp = { id: 'dp1' } as unknown as DataProducer;
      mockStore.dataProducers.set('dp1', dp);
      expect(service.getDataProducers()).toEqual([dp]);
    });

    it('should return a data producer by id', () => {
      const dp = { id: 'dp1' } as unknown as DataProducer;
      mockStore.dataProducers.set('dp1', dp);
      expect(service.getDataProducerById('dp1')).toBe(dp);
    });

    it('should throw if the data producer is not found', () => {
      expect(() => service.getDataProducerById('missing')).toThrow(MediasoupException);
    });
  });

  describe('createActiveSpeakerObserver', () => {
    it('should create an active speaker observer on the router', async () => {
      const router = createMockRouter('router-1', 1);
      mockStore.routers.set('router-1', router);
      (router.createActiveSpeakerObserver as jest.Mock).mockResolvedValue({ id: 'aso1' });

      const observer = await service.createActiveSpeakerObserver('router-1', 300);

      expect(router.createActiveSpeakerObserver).toHaveBeenCalledWith(expect.objectContaining({ interval: 300, appData: expect.objectContaining({ routerId: 'router-1' }) }));
      expect(observer).toEqual({ id: 'aso1' });
    });
  });

  describe('createAudioLevelObserver', () => {
    it('should create an audio level observer on the router', async () => {
      const router = createMockRouter('router-1', 1);
      mockStore.routers.set('router-1', router);
      (router.createAudioLevelObserver as jest.Mock).mockResolvedValue({ id: 'alo1' });

      const observer = await service.createAudioLevelObserver('router-1', { threshold: -50 });

      expect(router.createAudioLevelObserver).toHaveBeenCalledWith(expect.objectContaining({ threshold: -50, appData: expect.objectContaining({ routerId: 'router-1' }) }));
      expect(observer).toEqual({ id: 'alo1' });
    });
  });

  describe('getRtpObservers', () => {
    it('should return all rtp observers when no type is given', () => {
      const o1 = { id: 'o1', type: 'audiolevel' } as unknown as RtpObserver;
      const o2 = { id: 'o2', type: 'activespeaker' } as unknown as RtpObserver;
      mockStore.rtpObservers.set('o1', o1);
      mockStore.rtpObservers.set('o2', o2);

      expect(service.getRtpObservers()).toEqual([o1, o2]);
    });

    it('should filter rtp observers by type', () => {
      const o1 = { id: 'o1', type: 'audiolevel' } as unknown as RtpObserver;
      const o2 = { id: 'o2', type: 'activespeaker' } as unknown as RtpObserver;
      mockStore.rtpObservers.set('o1', o1);
      mockStore.rtpObservers.set('o2', o2);

      expect(service.getRtpObservers('activespeaker')).toEqual([o2]);
    });
  });

  describe('getRtpObserverById', () => {
    it('should return an rtp observer by id', () => {
      const observer = { id: 'o1' } as unknown as RtpObserver;
      mockStore.rtpObservers.set('o1', observer);
      expect(service.getRtpObserverById('o1')).toBe(observer);
    });

    it('should throw if the rtp observer is not found', () => {
      expect(() => service.getRtpObserverById('missing')).toThrow(MediasoupException);
    });
  });

  describe('getRtpObserversByRouter', () => {
    it('should return all rtp observers for a router', () => {
      const o1 = { id: 'o1', type: 'audiolevel', appData: { routerId: 'router-1' } } as unknown as RtpObserver;
      const o2 = { id: 'o2', type: 'activespeaker', appData: { routerId: 'router-2' } } as unknown as RtpObserver;
      mockStore.rtpObservers.set('o1', o1);
      mockStore.rtpObservers.set('o2', o2);

      expect(service.getRtpObserversByRouter('router-1')).toEqual([o1]);
    });

    it('should filter rtp observers for a router by type', () => {
      const o1 = { id: 'o1', type: 'audiolevel', appData: { routerId: 'router-1' } } as unknown as RtpObserver;
      const o2 = { id: 'o2', type: 'activespeaker', appData: { routerId: 'router-1' } } as unknown as RtpObserver;
      mockStore.rtpObservers.set('o1', o1);
      mockStore.rtpObservers.set('o2', o2);

      expect(service.getRtpObserversByRouter('router-1', 'activespeaker')).toEqual([o2]);
    });
  });
});
