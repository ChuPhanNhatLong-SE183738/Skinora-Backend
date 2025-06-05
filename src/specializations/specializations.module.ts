import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SpecializationsService } from './specializations.service';
import { SpecializationsController } from './specializations.controller';
import { Specialization, SpecializationSchema } from './entities/specialization.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Specialization.name, schema: SpecializationSchema }
    ])
  ],
  controllers: [SpecializationsController],
  providers: [SpecializationsService],
  exports: [SpecializationsService]
})
export class SpecializationsModule {}
