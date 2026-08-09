import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService, LoginAdminResult, VerifyOtpResult } from './auth.service';
import { LoginAdminDto } from './dto/login-admin.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('otp/request')
  @HttpCode(200)
  requestOtp(@Body() dto: RequestOtpDto): { code: string } {
    return this.authService.requestOtp(dto.phone);
  }

  @Post('otp/verify')
  @HttpCode(200)
  async verifyOtp(@Body() dto: VerifyOtpDto): Promise<VerifyOtpResult> {
    return this.authService.verifyOtp(dto.phone, dto.code);
  }

  @Post('admin/login')
  @HttpCode(200)
  async loginAdmin(@Body() dto: LoginAdminDto): Promise<LoginAdminResult> {
    return this.authService.loginAdmin(dto.email, dto.password);
  }
}
