import { IsEmail, IsLowercase, IsString } from 'class-validator';

// create login dto with email aand password
export class LoginDto {
  @IsEmail()
  email: string;
  @IsString()
  @IsLowercase()
  password: string;
}
