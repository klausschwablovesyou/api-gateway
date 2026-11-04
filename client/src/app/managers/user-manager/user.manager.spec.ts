import { UserManager } from './user.manager';
import { User } from '@shared/models/user.model';
import { UserRole } from '@shared/types/user-role';

describe('UserManager', () => {
  let manager: UserManager;
  const user = () => new User({ id: 'user-1', username: 'anna', userRole: UserRole.Admin });

  beforeEach(() => {
    localStorage.removeItem('currentUser');
    manager = new UserManager();
  });

  afterEach(() => localStorage.removeItem('currentUser'));

  it('should return null when nothing is stored', () => {
    expect(manager.getUser()).toBeNull();
  });

  it('should return the user that was set', () => {
    const current = user();

    manager.setUser(current);

    expect(manager.getUser()).toBe(current);
  });

  it('should restore the user from localStorage in a new session, as a User instance', () => {
    manager.setUser(user());

    const restored = new UserManager().getUser();

    expect(restored).toBeInstanceOf(User);
    expect(restored?.id).toBe('user-1');
    expect(restored?.hasRole(UserRole.Admin)).toBeTrue();
  });

  it('should remove the stored user when set to null', () => {
    manager.setUser(user());

    manager.setUser(null);

    expect(localStorage.getItem('currentUser')).toBeNull();
    expect(manager.getUser()).toBeNull();
  });

  it('should clear the user from memory and localStorage', () => {
    manager.setUser(user());

    manager.clearUser();

    expect(localStorage.getItem('currentUser')).toBeNull();
    expect(manager.getUser()).toBeNull();
  });
});
