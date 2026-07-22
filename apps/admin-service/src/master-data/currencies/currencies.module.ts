import { Module } from '@nestjs/common';
import { CustomFieldsModule } from '../../custom-fields/custom-fields.module';
import { CurrenciesController } from './currencies.controller';
import { CurrenciesService } from './currencies.service';

@Module({
  imports: [CustomFieldsModule],
  controllers: [CurrenciesController],
  providers: [CurrenciesService],
})
export class CurrenciesModule {}
