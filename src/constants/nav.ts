// src/constants/nav.ts
import {
  House,
  Zap,
  PlayCircle,
  Tv2,
  CircleUser,
  Heart,
  Settings,
  LogOut,
  Download,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  roles: ('guest' | 'parent' | 'child')[];
};

export const MAIN_NAV: NavItem[] = [
  { id: 'home',     label: 'Home',              icon: House,       href: '/',         roles: ['guest', 'parent', 'child'] },
  { id: 'shorts',   label: 'Shorts',            icon: Zap,         href: '/shorts',   roles: ['guest', 'parent', 'child'] },
  { id: 'videos',   label: 'Videos',            icon: PlayCircle,  href: '/videos',   roles: ['guest', 'parent', 'child'] },
  { id: 'channels', label: 'Channels',          icon: Tv2,         href: '/channels', roles: ['guest', 'parent', 'child'] },
  { id: 'bhakti',   label: 'My Bhakti Journey', icon: Heart,       href: '/bhakti',   roles: ['guest', 'parent', 'child'] },
];

export const MOBILE_BOTTOM_NAV: NavItem[] = [
  { id: 'home',     label: 'Home',     icon: House,       href: '/',         roles: ['guest', 'parent', 'child'] },
  { id: 'shorts',   label: 'Shorts',   icon: Zap,         href: '/shorts',   roles: ['guest', 'parent', 'child'] },
  { id: 'videos',   label: 'Videos',   icon: PlayCircle,  href: '/videos',   roles: ['guest', 'parent', 'child'] },
  { id: 'channels', label: 'Channels', icon: Tv2,         href: '/channels', roles: ['guest', 'parent', 'child'] },
  { id: 'profile',  label: 'You',      icon: CircleUser,  href: '/profile',  roles: ['guest', 'parent', 'child'] },
];

export const SIDEBAR_BOTTOM_NAV: NavItem[] = [
  { id: 'settings', label: 'Settings',     icon: Settings, href: '/settings',     roles: ['parent', 'child'] },
  { id: 'logout',   label: 'Logout',       icon: LogOut,   href: '#logout',       roles: ['parent', 'child'] },
  { id: 'download', label: 'Download App', icon: Download, href: '/download-app', roles: ['guest', 'parent', 'child'] },
];

export const ROUTES = {
  home: '/',
  shorts: '/shorts',
  videos: '/videos',
  channels: '/channels',
  bhakti: '/bhakti',
  profile: '/profile',
  authLogin: '/auth/login',
  authSignup: '/auth/signup',
  settings: '/settings',
  download: '/download-app',
} as const;

