import { config } from '../config';

export function isAdmin(email: string, username: string): boolean {
  return config.adminEmails.includes(email) || config.adminUsernames.includes(username);
}
