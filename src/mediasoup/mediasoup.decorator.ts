import { OnEvent } from '@nestjs/event-emitter';
import { MediasoupEventName } from './mediasoup.interface';

export const OnMediasoup = <Name extends MediasoupEventName>(name: Name) => OnEvent(name);
