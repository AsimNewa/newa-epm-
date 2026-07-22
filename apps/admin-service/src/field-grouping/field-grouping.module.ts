import { Module } from '@nestjs/common';
import { FieldGroupingController } from './field-grouping.controller';
import { FieldGroupingService } from './field-grouping.service';

@Module({
  controllers: [FieldGroupingController],
  providers: [FieldGroupingService],
  exports: [FieldGroupingService],
})
export class FieldGroupingModule {}
