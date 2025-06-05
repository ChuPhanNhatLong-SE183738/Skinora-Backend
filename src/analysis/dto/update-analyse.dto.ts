import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateAnalyseDto {
  @ApiProperty({
    description: 'Updated skin type',
    example: 'normal',
    required: false,
  })
  @IsOptional()
  @IsString()
  skinType?: string;

  @ApiProperty({
    description: 'Updated analysis result',
    example: 'Your skin type is normal with 95.1% confidence',
    required: false,
  })
  @IsOptional()
  @IsString()
  result?: string;
}
