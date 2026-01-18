import { Module } from '@danet/core';
import { RealtimeController } from './realtime.controller.ts';
import { RealtimeService } from './realtime.service.ts';
import { JwtService } from '../../shared/services/jwt.service.ts';

@Module({
  controllers: [RealtimeController],
  injectables: [RealtimeService, JwtService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
