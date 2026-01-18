import '@denorid/reflection';

export const ROLES_KEY = 'roles';

/**
 * Simple metadata decorator for role-based access control
 * @param key - The metadata key
 * @param value - The metadata value
 */
export const SetMetadata = (key: string, value: any) => {
  return (target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) => {
    if (descriptor) {
      // Method decorator
      Reflect.defineMetadata(key, value, descriptor.value);
    } else {
      // Class decorator
      Reflect.defineMetadata(key, value, target);
    }
  };
};

/**
 * Decorator to restrict access to controller actions based on user roles
 * @param roles - Array of role names that are allowed to access the endpoint
 * 
 * Usage examples:
 * @Roles('admin')
 * @Roles('admin', 'moderator')
 * @Roles('user', 'admin')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);