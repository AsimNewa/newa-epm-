import { Module } from '@nestjs/common';
import { RateTypesController } from './rate-types.controller';
import { RateTypesService } from './rate-types.service';

@Module({
  controllers: [RateTypesController],
  providers: [RateTypesService],
})
export class RateTypesModule {}
