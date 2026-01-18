import { Injectable, ExecutionContext, AuthGuard } from '@danet/core';
import '@denorid/reflection';
import { JwtService } from '../services/jwt.service.ts';
import { ROLES_KEY } from '../decorators/roles.decorator.ts';
import { HonoRequest } from "jsr:@hono/hono@4.6.3/request";

@Injectable()
export class RolesGuard implements AuthGuard {
  public constructor(
    private jwtService: JwtService
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get the handler (method) from the execution context
    const handler = context.getHandler();

    // Get required roles from metadata
    const requiredRoles = Reflect.getMetadata(ROLES_KEY, handler) as string[];

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // No roles required, allow access
    }

    const request = context.req;
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      return false; // No token provided
    }

    const userPayload = await this.jwtService.extractUserFromToken(token);

    if (!userPayload) {
      return false; // Invalid token
    }

    // Check if user's role is in the required roles
    const hasRequiredRole = requiredRoles.includes(userPayload.userRole);

    // Attach user info to request for use in controllers
    request.user = {
      id: userPayload.userId,
      userId: userPayload.userId,
      userRole: userPayload.userRole,
      email: userPayload.email,
    };

    return hasRequiredRole;
  }


  private extractTokenFromHeader(request: HonoRequest): string | undefined {
    const authHeader = request.header('authorization');

    if (!authHeader) return undefined;

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}