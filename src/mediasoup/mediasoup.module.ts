import { DynamicModule, Inject, Logger, Module, OnApplicationBootstrap, OnApplicationShutdown, Provider } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { observer, version } from 'mediasoup';
import { MediasoupService, ObserverService } from './services';
import { MediasoupToken } from '@/mediasoup/mediasoup.interface';
import type { MediasoupModuleAsyncOptions, MediasoupModuleGlobalOptions, MediasoupModuleOptions, MediasoupOptionsFactory, Worker } from './mediasoup.interface';
import { ResourceStoreProvider } from './mediasoup.provider';

@Module({})
export class MediasoupModule implements OnApplicationBootstrap, OnApplicationShutdown {
  constructor(
    private readonly logger: Logger,
    private readonly mediasoupService: MediasoupService,
    private readonly observerService: ObserverService,
    @Inject(MediasoupToken.MODULE_OPTIONS) private readonly options: MediasoupModuleOptions,
  ) {}

  async onApplicationBootstrap() {
    observer.on('newworker', this.onNewWorker);
    const { workerSettings } = this.options;

    if (workerSettings.workerCount) {
      for (let i = 0; i < workerSettings.workerCount; i++) {
        await this.mediasoupService.createWorker();
      }
    }

    this.logger.log(`Mediasoup version ${version}`);
  }

  onApplicationShutdown() {
    observer.off('newworker', this.onNewWorker);
    const workers = this.mediasoupService.getWorkers();

    for (const worker of workers) {
      worker.close();
      this.logger.log(`Worker closed [PID]: ${worker.pid}`);
    }
  }

  /**
   * Registers the MediasoupModule synchronously with static options.
   *
   * @param options - Module configuration object.
   * @param globalOptions - Optional scope settings. Set `isGlobal: true` to make
   *   `MediasoupService` available application-wide without re-importing the module
   *   in each feature module.
   *
   * @example
   * # Local registration (default)
   * MediasoupModule.register({ workerSettings: { ... }, ... })
   *
   * @example
   * # Global registration
   * MediasoupModule.register({ workerSettings: { ... }, ... }, { isGlobal: true })
   */
  static register(options: MediasoupModuleOptions, globalOptions?: MediasoupModuleGlobalOptions): DynamicModule {
    return {
      global: globalOptions?.isGlobal ?? false,
      module: MediasoupModule,
      imports: [EventEmitterModule.forRoot()],
      providers: [
        {
          provide: Logger,
          useValue: new Logger(MediasoupModule.name),
        },
        MediasoupService,
        ObserverService,
        ResourceStoreProvider,
        {
          provide: MediasoupToken.MODULE_OPTIONS,
          useValue: options,
        },
      ],
      exports: [MediasoupService],
    };
  }

  /**
   * Registers the MediasoupModule asynchronously, allowing options to be resolved
   * via a factory function, an existing provider, or a class implementing
   * `MediasoupOptionsFactory`.
   *
   * Set `isGlobal: true` inside `asyncOptions` to make `MediasoupService` available
   * application-wide without re-importing the module.
   *
   * @param asyncOptions - Async registration configuration including optional `isGlobal`.
   *
   * @example
   * # Factory with ConfigService
   * MediasoupModule.registerAsync({
   *   isGlobal: true,
   *   imports: [ConfigModule],
   *   inject: [ConfigService],
   *   useFactory: (config: ConfigService) => ({
   *     workerSettings: { logLevel: config.get('MEDIASOUP_LOG_LEVEL') },
   *     ...
   *   }),
   * })
   */
  static registerAsync(asyncOptions: MediasoupModuleAsyncOptions): DynamicModule {
    return {
      global: asyncOptions.isGlobal ?? false,
      module: MediasoupModule,
      imports: [EventEmitterModule.forRoot(), ...(asyncOptions.imports ?? [])],
      providers: [
        {
          provide: Logger,
          useValue: new Logger(MediasoupModule.name),
        },
        MediasoupService,
        ObserverService,
        ResourceStoreProvider,
        ...MediasoupModule.createAsyncProviders(asyncOptions),
      ],
      exports: [MediasoupService],
    };
  }

  private static createAsyncProviders(asyncOptions: MediasoupModuleAsyncOptions): Provider[] {
    if (asyncOptions.useFactory) {
      return [
        {
          provide: MediasoupToken.MODULE_OPTIONS,
          useFactory: asyncOptions.useFactory,
          inject: asyncOptions.inject ?? [],
        },
      ];
    }

    const useClass = asyncOptions.useClass ?? asyncOptions.useExisting;

    return [
      {
        provide: MediasoupToken.MODULE_OPTIONS,
        useFactory: async (factory: MediasoupOptionsFactory) => factory.createMediasoupOptions(),
        inject: [useClass!],
      },
      ...(asyncOptions.useClass ? [{ provide: useClass!, useClass: useClass! }] : []),
    ];
  }

  private readonly onNewWorker = (worker: unknown) => {
    this.observerService.observer(worker as Worker);
  };
}
