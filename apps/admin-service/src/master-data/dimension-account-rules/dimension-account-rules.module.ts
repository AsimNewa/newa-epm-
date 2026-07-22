import { Module } from '@nestjs/common';
import { DimensionAccountRulesController } from './dimension-account-rules.controller';
import { DimensionAccountRulesService } from './dimension-account-rules.service';

@Module({
  controllers: [DimensionAccountRulesController],
  providers: [DimensionAccountRulesService],
  exports: [DimensionAccountRulesService],
})
export class DimensionAccountRulesModule {}
