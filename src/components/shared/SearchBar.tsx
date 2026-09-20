'use client';

import { Search, X } from 'lucide-react';
import { useRef, useState } from 'react';
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
        'flex items-center',
        'w-full max-w-[600px]',
        'h-10 rounded-full',
        'bg-surface-secondary border border-border',
        'focus-within:border-brand-primary focus-within:ring-1 focus-within:ring-brand-primary/20',
        'transition-all duration-200 overflow-hidden'
      )}
    >
      <div className="flex flex-1 items-center px-4 gap-2 min-w-0">
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search JruJu TV..."
          aria-label="Search JruJu TV"
          className={cn(
            'flex-1 bg-transparent text-fluid-sm text-content-primary',
            'placeholder:text-content-disabled',
            'outline-none border-none',
            'min-w-0'
          )}
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search query"
            onClick={() => setQuery('')}
            className="shrink-0 text-content-disabled hover:text-content-primary transition-colors p-1"
          >
            <X size={15} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* YouTube-style attached search button on right edge of pill */}
      <button
        type="submit"
        aria-label="Submit search"
        className={cn(
          'flex items-center justify-center px-5 h-full',
          'bg-surface-elevated/60 hover:bg-surface-elevated border-l border-border',
          'text-content-secondary hover:text-content-primary transition-colors'
        )}
      >
        <Search size={17} strokeWidth={2} aria-hidden="true" />
      </button>
    </form>
  );
}

// Mobile: full-screen search overlay
export function MobileSearchOverlay() {
  const { searchOpen, closeSearch } = useUIStore();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

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
            className="flex-1 bg-transparent text-fluid-sm text-content-primary placeholder:text-content-disabled outline-none"
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

