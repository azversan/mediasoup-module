import { Test, TestingModule } from '@nestjs/testing';
import { MediasoupService } from '@/mediasoup/services/mediasoup/mediasoup.service';
import { MediasoupToken } from '@/mediasoup/mediasoup.interface';
import { MediasoupException } from '@/mediasoup/mediasoup.exception';
import type { MutableMediasoupResourceStore, Worker, Router } from '@/mediasoup/mediasoup.interface';

describe('MediasoupService', () => {
  let service: MediasoupService;
  let mockStore: MutableMediasoupResourceStore;

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediasoupService,
        {
          provide: MediasoupToken.CURRENT_WORKER,
          useValue: 0,
        },
        {
          provide: MediasoupToken.RESOURCE_STORE,
          useValue: mockStore,
        },
        {
          provide: MediasoupToken.MODULE_OPTIONS,
          useValue: {
            webRtcServer: { enable: false },
            workerSettings: {},
            mediaCodecs: [],
          },
        },
      ],
    }).compile();

    service = module.get<MediasoupService>(MediasoupService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
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
});
