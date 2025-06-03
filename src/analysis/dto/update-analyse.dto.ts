import { PartialType } from '@nestjs/mapped-types';
import { CreateAnalyseDto } from './create-analyse.dto';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateAnalyseDto extends PartialType(CreateAnalyseDto) {
  @ApiProperty({
    description: 'Updated skin type',
    example: 'normal',
    required: false,
  })
  skinType?: string;

  @ApiProperty({
    description: 'Updated analysis result',
    example: 'Your skin type is normal with 95.1% confidence',
    required: false,
  })
  result?: string;
}
