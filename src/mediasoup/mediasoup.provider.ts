import { Provider } from '@nestjs/common';
import {
  Consumer,
  ConsumerId,
  DataConsumer,
  DataConsumerId,
  DataProducer,
  DataProducerId,
  MediasoupToken,
  MutableMediasoupResourceStore,
  Producer,
  ProducerId,
  Router,
  RouterId,
  RtpObserver,
  RtpObserverId,
  Transport,
  TransportId,
  WebRtcServer,
  WebRtcServerId,
  Worker,
} from './mediasoup.interface';

export const ResourceStoreProvider: Provider<MutableMediasoupResourceStore> = {
  provide: MediasoupToken.RESOURCE_STORE,
  useValue: {
    workers: new Map<number, Worker>(),
    routers: new Map<RouterId, Router>(),
    transports: new Map<TransportId, Transport>(),
    rtpObservers: new Map<RtpObserverId, RtpObserver>(),
    consumers: new Map<ConsumerId, Consumer>(),
    producers: new Map<ProducerId, Producer>(),
    dataConsumers: new Map<DataConsumerId, DataConsumer>(),
    dataProducers: new Map<DataProducerId, DataProducer>(),
    webRtcServers: new Map<WebRtcServerId, WebRtcServer>(),
  },
};
