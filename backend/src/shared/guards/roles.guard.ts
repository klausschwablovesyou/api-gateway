import { Injectable, ExecutionContext, AuthGuard, UnauthorizedException } from '@danet/core';
import '@denorid/reflection';
import { JwtService } from '../services/jwt.service.ts';
import { ROLES_KEY } from '../decorators/roles.decorator.ts';
import { HonoRequest } from "jsr:@hono/hono@4.6.3/request";

/**
 * Registered globally (GLOBAL_GUARD in AppModule), so it runs for every HTTP route.
 * Routes without @Roles metadata (on the method or the controller class) stay public.
 * Method-level @Roles overrides class-level @Roles.
 *
 * - missing / invalid / expired token -> 401 Unauthorized
 * - valid token, role not allowed      -> 403 Forbidden
 */
@Injectable()
export class RolesGuard implements AuthGuard {
  public constructor(
    private jwtService: JwtService
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.getRequiredRoles(context);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // No roles required, allow access
    }

    const request = context.req;
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException();
    }

    const userPayload = await this.jwtService.extractUserFromToken(token);

    if (!userPayload) {
      throw new UnauthorizedException();
    }

    // Attach user info to request for use in controllers
    request.user = {
      id: userPayload.userId,
      userId: userPayload.userId,
      userRole: userPayload.userRole,
      email: userPayload.email,
    };

    // false -> Danet throws ForbiddenException (403)
    return requiredRoles.includes(userPayload.userRole);
  }

  private getRequiredRoles(context: ExecutionContext): string[] | undefined {
    // Danet's WebSocket router runs the global guard on connection without setting
    // getHandler, so both accessors must be treated as optional.
    const handler = context.getHandler?.();
    const handlerRoles = handler
      ? Reflect.getMetadata(ROLES_KEY, handler) as string[] | undefined
      : undefined;
    if (handlerRoles && handlerRoles.length > 0) {
      return handlerRoles;
    }
    const controller = context.getClass?.();
    return controller
      ? Reflect.getMetadata(ROLES_KEY, controller) as string[] | undefined
      : undefined;
  }

  private extractTokenFromHeader(request: HonoRequest): string | undefined {
    const authHeader = request.header('authorization');

    if (!authHeader) return undefined;

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
