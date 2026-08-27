import { IsEmail, IsString, MinLength } from "class-validator";

export class LoginDto {
  @IsEmail() email!: string;
  @IsString() password!: string;
}
export class RegisterDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(12) password!: string;
  @IsString() invitationToken!: string;
}
