import { Module } from '@nestjs/common';
import { CustomFieldsModule } from '../../custom-fields/custom-fields.module';
import { DimensionsController } from './dimensions.controller';
import { DimensionsService } from './dimensions.service';

@Module({
  imports: [CustomFieldsModule],
  controllers: [DimensionsController],
  providers: [DimensionsService],
})
export class DimensionsModule {}
