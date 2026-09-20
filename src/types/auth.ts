// src/types/auth.ts
export type Role = 'guest' | 'parent' | 'child';

export interface User {
  id: string;
  name: string;
  avatar?: string;
  role: Role;
}

