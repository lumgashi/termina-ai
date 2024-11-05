import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import * as bcryptjs from 'bcryptjs';
import { CreateUserDto } from './dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { AuthJwtPayload } from './types/auth-jwt-payload';
import refreshJwtConfig from './config/refresh-jwt.config';
import { ConfigType } from '@nestjs/config';
import * as argon2 from 'argon2';
import { CurrentUser } from './types/current-user.dto';

@Injectable()
export class AuthService {
  constructor(
    @Inject(refreshJwtConfig.KEY)
    private refreshTokenConfig: ConfigType<typeof refreshJwtConfig>,
    private userService: UsersService,
    private readonly prisma: PrismaService,
    private jwtService: JwtService,
  ) {}
  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userService.findByEmail(email);

    if (!user) throw new UnauthorizedException('User not found');

    const isPasswordMatched = await bcryptjs.compare(password, user.password);

    if (!isPasswordMatched)
      throw new UnauthorizedException('Invalid credentials');
    return { id: user.id, email: user.email };
  }

  async login(userId: string) {
    //const { user } = req;
    // const payload: AuthJwtPayload = {
    //   sub: user.id,
    // };
    // const token = this.jwtService.sign(payload);
    // const refreshToken = this.jwtService.sign(payload, this.refreshTokenConfig);
    const { accessToken, refreshToken } = await this.generateTokens(userId);
    const hashedRefreshToken = await argon2.hash(refreshToken);
    console.log('am i here?')
    console.log('herexxx', { userId, hashedRefreshToken });
    await this.userService.updateHashedRefreshedToken(
      userId,
      hashedRefreshToken,
    );
    return { accessToken, refreshToken, userId: userId };
  }

  async register(createUserDto: CreateUserDto) {
    const hashedPassword = await bcryptjs.hash(createUserDto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        ...createUserDto,
        password: hashedPassword,
      },
    });
    return user;
  }

  async refreshToken(userId: string) {
    const { accessToken, refreshToken } = await this.generateTokens(userId);
    const hashedRefreshToken = await argon2.hash(refreshToken);
    console.log('well here')
    await this.userService.updateHashedRefreshedToken(
      userId,
      hashedRefreshToken,
    );
    return { accessToken, refreshToken, userId };
  }

  async generateTokens(userId: string) {
    const payload: AuthJwtPayload = {
      sub: userId,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(payload, this.refreshTokenConfig),
    ]);

    return { accessToken, refreshToken };
  }

  async validateRefreshToken(userId: string, refreshToken: string) {
    const user = await this.userService.findOne(userId);
    if (!user || !user.hashedRefreshToken)
      throw new UnauthorizedException('Invalid Refresh Token');
    const refreshTokenMatches = await argon2.verify(
      user.hashedRefreshToken,
      refreshToken,
    );
    if (!refreshTokenMatches)
      throw new UnauthorizedException('Invalid Refresh Token');

    return { id: user.id };
  }

  async signOut(userId: string) {
    await this.userService.updateHashedRefreshedToken(userId, null);
  }

  async validateJwtUser(userId: string) {
    const user = await this.userService.findOne(userId);
    if (!user) throw new UnauthorizedException('User not found');
    const currentUser: CurrentUser = { id: user.id, role: user.role };
    return currentUser;
  }

  async validateGoogleUser(googleUser: CreateUserDto) {
    const user = await this.userService.findByEmail(googleUser.email);
    if (user) return user;
    return await this.userService.create(googleUser);
  }
}
