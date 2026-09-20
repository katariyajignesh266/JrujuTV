'use client';

import { Search, X } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/cn';
import { useUIStore } from '@/store/uiStore';

export function SearchBar() {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className={cn(
        'flex items-center group',
        'w-full max-w-[600px]',
        'h-10 rounded-full',
        // Glassmorphic base — adapts to light/dark
        'bg-black/[0.04] dark:bg-white/5 backdrop-blur-md',
        'border border-black/[0.08] dark:border-white/10',
        'shadow-[0_2px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_16px_rgba(0,0,0,0.3)]',
        // Focus glow
        'focus-within:border-brand-primary/50 focus-within:bg-black/[0.06] dark:focus-within:bg-white/8',
        'focus-within:shadow-[0_0_0_3px_rgba(229,57,53,0.12),0_2px_16px_rgba(0,0,0,0.10)]',
        'transition-all duration-300 overflow-hidden'
      )}
    >
      {/* Search icon left */}
      <div className="pl-4 shrink-0 text-content-disabled group-focus-within:text-brand-primary transition-colors duration-200">
        <Search size={15} strokeWidth={2} aria-hidden="true" />
      </div>

      <div className="flex flex-1 items-center px-3 gap-2 min-w-0">
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search JruJu TV..."
          aria-label="Search JruJu TV"
          className={cn(
            'flex-1 bg-transparent text-fluid-sm text-content-primary',
            'placeholder:text-content-disabled/70',
            'outline-none border-none shadow-none',
            'focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0',
            'min-w-0'
          )}
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search query"
            onClick={() => setQuery('')}
            className="shrink-0 text-content-disabled hover:text-content-primary transition-colors p-0.5 rounded-full hover:bg-white/20"
          >
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Glassmorphic search submit button on right */}
      <button
        type="submit"
        aria-label="Submit search"
        className={cn(
          'flex items-center justify-center px-4 h-full shrink-0',
          'bg-black/[0.04] dark:bg-white/5 hover:bg-brand-primary/10',
          'border-l border-black/[0.08] dark:border-white/10',
          'text-content-secondary hover:text-brand-primary',
          'transition-all duration-200',
          'rounded-r-full'
        )}
      >
        <Search size={16} strokeWidth={2} aria-hidden="true" />
      </button>
    </form>
  );
}

// Mobile: full-screen search overlay
export function MobileSearchOverlay() {
  const { searchOpen, closeSearch } = useUIStore();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!searchOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeSearch();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen, closeSearch]);

  if (!searchOpen) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-[200] flex flex-col',
        'bg-surface-primary',
        'animate-in slide-in-from-top duration-200'
      )}
      role="dialog"
      aria-label="Search"
      aria-modal="true"
    >
      {/* Search Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-border">
        <button
          type="button"
          aria-label="Close search"
          onClick={closeSearch}
          className="text-content-secondary hover:text-content-primary min-touch flex items-center justify-center"
        >
          <X size={22} aria-hidden="true" />
        </button>
        <div
          className={cn(
            'flex flex-1 items-center gap-2',
            'h-10 px-4 rounded-full',
            'bg-surface-secondary border border-border',
            'focus-within:border-brand-primary'
          )}
        >
          <Search size={16} className="shrink-0 text-content-disabled" aria-hidden="true" />
          <input
            ref={inputRef}
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search JruJu TV..."
            aria-label="Search"
            className={cn(
              'flex-1 bg-transparent text-fluid-sm text-content-primary',
              'placeholder:text-content-disabled',
              'outline-none border-none shadow-none',
              'focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0'
            )}
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery('')}
              className="text-content-disabled hover:text-content-primary"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Placeholder results area */}
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div>
          <Search size={40} strokeWidth={1} className="mx-auto mb-3 text-content-disabled" aria-hidden="true" />
          <p className="text-fluid-sm text-content-secondary">
            {query ? `Searching for "${query}"…` : 'Start typing to search videos, channels & more'}
          </p>
        </div>
      </div>
    </div>
  );
}

