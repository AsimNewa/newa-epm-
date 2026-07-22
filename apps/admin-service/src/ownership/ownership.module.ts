import { Module } from '@nestjs/common';
import { CustomFieldsModule } from '../custom-fields/custom-fields.module';
import { OwnershipController } from './ownership.controller';
import { OwnershipService } from './ownership.service';

@Module({
  imports: [CustomFieldsModule],
  controllers: [OwnershipController],
  providers: [OwnershipService],
})
export class OwnershipModule {}
