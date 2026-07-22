import { Module } from '@nestjs/common';
import { CustomFieldsModule } from '../../custom-fields/custom-fields.module';
import { EntitiesController } from './entities.controller';
import { EntitiesService } from './entities.service';

@Module({
  imports: [CustomFieldsModule],
  controllers: [EntitiesController],
  providers: [EntitiesService],
})
export class EntitiesModule {}
