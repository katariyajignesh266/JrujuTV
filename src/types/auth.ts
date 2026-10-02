// src/types/auth.ts
export type Role = 'guest' | 'parent' | 'child';

export interface User {
  id: string;
  name: string;
  email?: string;
  username?: string;
  avatar?: string;
  role: Role;
  parentId?: string;
}
