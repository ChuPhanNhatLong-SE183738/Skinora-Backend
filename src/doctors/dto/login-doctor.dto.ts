import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDoctorDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
