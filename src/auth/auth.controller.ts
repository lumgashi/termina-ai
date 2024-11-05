import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from './dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { RefreshAuthGuard } from './guards/refresh-auth/refresh-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth/jwt-auth.guard';
import { Public } from './decorator';
import { GoogleAuthGuard } from './guards/google-auth/google-auth.guard';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(
    @Req() req,
    //@Body() loginDto: LoginDto,
  ) {
    //return req.user;
    console.log('req.user', req.user);
    return this.authService.login(req.user.id);
  }

  @Public()
  @Post('register')
  async register(@Body() createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto);
  }

  @UseGuards(RefreshAuthGuard)
  @Post('refresh/tkn')
  async refreshToken(@Req() req) {
    console.log('req.user', req);
    return this.authService.refreshToken(req.user.id);
  }

  @Public()
  @Get('google/login')
  @UseGuards(GoogleAuthGuard)
  async googleLogin() {
    // initiates the Google OAuth2 login flow
  }

  @Public()
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(@Req() req, @Res() res) {
    // initiates the Google OAuth2 login flow
    const response = await this.authService.login(req.user.id);
    res.redirect(
      `${this.configService.get('base_url')}/login?token=${response.accessToken}&refreshToken=${response.refreshToken}`,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('signout')
  async signOut(@Req() req) {
    return this.authService.signOut(req.user.id);
  }
}
