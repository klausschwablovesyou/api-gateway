import { Injectable } from '@danet/core';
import { signJWT, validateJWT } from '@cross/jwt';
import { UserRole } from '@shared/types/user-role';
import { JwtPayload } from '@shared/types/jwt-payload.ts';

@Injectable()
export class JwtService {

  private readonly _secretKey = Deno.env.get('JWT_SECRET');

  public async generateToken(userId: string, userRole: UserRole, email: string): Promise<string> {
    const payload: JwtPayload = {
      userId,
      userRole,
      email,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
    };

    return await signJWT(payload, this._secretKey);
  }

  public async verifyToken(token: string): Promise<JwtPayload | null> {
    try {
      const payload = await validateJWT(token, this._secretKey);
      return payload as JwtPayload;
    } catch (error) {
      console.error('JWT verification failed:', error);
      return null;
    }
  }

  public async extractUserFromToken(token: string): Promise<{ userId: string; userRole: UserRole; email: string } | null> {
    const payload = await this.verifyToken(token);
    if (!payload) return null;

    return {
      userId: payload.userId,
      userRole: payload.userRole,
      email: payload.email,
    };
  }
}