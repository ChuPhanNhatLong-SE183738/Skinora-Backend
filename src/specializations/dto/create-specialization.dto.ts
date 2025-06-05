import { IsString, IsOptional, IsBoolean, MinLength, MaxLength } from 'class-validator';

export class CreateSpecializationDto {
    @IsString()
    @MinLength(2)
    @MaxLength(100)
    specializationName: string;

    @IsString()
    @IsOptional()
    @MaxLength(500)
    description?: string;

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}
