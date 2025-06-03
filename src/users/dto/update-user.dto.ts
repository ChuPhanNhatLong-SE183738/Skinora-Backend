import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { IsOptional, IsBoolean, IsIn } from 'class-validator';

export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password'] as const),
) {
  @IsOptional()
  @IsBoolean({ message: 'isActive must be a boolean value' })
  isActive?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'isVerified must be a boolean value' })
  isVerified?: boolean;

  @IsOptional()
  @IsIn(['user', 'admin'], { message: 'Role must be either user or admin' })
  role?: string;
}
