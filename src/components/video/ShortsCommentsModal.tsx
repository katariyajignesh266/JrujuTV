// src/components/video/ShortsCommentsModal.tsx
'use client';

import React, { useState } from 'react';
import { X, Send, Sparkles, Smile } from 'lucide-react';
import { useShortsStore } from '@/store/shortsStore';
import { cn } from '@/lib/cn';

interface CommentItem {
  id: string;
  author: string;
  avatarBg: string;
  text: string;
  timeAgo: string;
  likes: number;
}

const PRESET_COMMENTS: CommentItem[] = [
  {
    id: 'c1',
    author: 'Little Explorer',
    avatarBg: 'bg-indigo-500',
    text: 'This made me smile so much! ✨',
    timeAgo: '2h ago',
    likes: 12,
  },
  {
    id: 'c2',
    author: 'Aarav K.',
    avatarBg: 'bg-emerald-500',
    text: 'Super funny and cool! 😂👏',
    timeAgo: '5h ago',
    likes: 8,
  },
  {
    id: 'c3',
    author: 'Star Watcher',
    avatarBg: 'bg-amber-500',
    text: 'Watched this twice already! Loved it ❤️',
    timeAgo: '1d ago',
    likes: 19,
  },
  {
    id: 'c4',
    author: 'Junior Fan',
    avatarBg: 'bg-pink-500',
    text: 'Can we have more videos like this? 🚀',
    timeAgo: '1d ago',
    likes: 5,
  },
];

const EMOJI_REACTIONS = ['❤️', '😂', '👏', '🌟', '🎉', '🚀', '🔥'];

export function ShortsCommentsModal() {
  const { commentsOpen, closeComments } = useShortsStore();
  const [comments, setComments] = useState<CommentItem[]>(PRESET_COMMENTS);
  const [newComment, setNewComment] = useState('');

  if (!commentsOpen) return null;

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    const item: CommentItem = {
      id: `c-${Date.now()}`,
      author: 'You',
      avatarBg: 'bg-brand-primary',
      text: newComment.trim(),
      timeAgo: 'Just now',
      likes: 1,
    };

    setComments([item, ...comments]);
    setNewComment('');
  };

  const handleAddEmoji = (emoji: string) => {
    setNewComment((prev) => prev + emoji);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm select-none transition-all">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={closeComments} />

      {/* Slide-up Container */}
      <div className="relative w-full max-w-lg bg-surface-primary border-t border-border rounded-t-3xl shadow-2xl flex flex-col max-h-[75vh] z-10 overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <h3 className="text-fluid-base font-bold text-content-primary">Comments</h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-brand-primary/10 text-brand-primary">
              {comments.length}
            </span>
          </div>
          <button
            type="button"
            onClick={closeComments}
            className="p-1.5 rounded-full hover:bg-surface-secondary text-content-secondary hover:text-content-primary transition-colors"
            aria-label="Close comments"
          >
            <X size={20} />
          </button>
        </div>

        {/* Safe, Kid-friendly Banner */}
        <div className="bg-brand-primary/5 px-4 py-2 border-b border-brand-primary/10 flex items-center gap-2 text-xs text-brand-primary font-medium">
          <Sparkles size={14} className="shrink-0" />
          <span>Keep comments kind, friendly, and respectful!</span>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {comments.map((item) => (
            <div key={item.id} className="flex items-start gap-3">
              <div
                className={cn(
                  'h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm',
                  item.avatarBg
                )}
              >
                {item.author.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-bold text-content-primary truncate">
                    {item.author}
                  </span>
                  <span className="text-[10px] text-content-tertiary">{item.timeAgo}</span>
                </div>
                <p className="text-xs text-content-secondary mt-0.5 break-words">
                  {item.text}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Emoji Reaction Row */}
        <div className="px-4 py-2 bg-surface-secondary/50 border-t border-border flex items-center justify-between gap-1 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1.5">
            <Smile size={16} className="text-content-tertiary ml-1 mr-1" />
            {EMOJI_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleAddEmoji(emoji)}
                className="text-lg p-1 rounded-lg hover:bg-surface-elevated active:scale-95 transition-all"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <form
          onSubmit={handleAddComment}
          className="p-3 bg-surface-primary border-t border-border flex items-center gap-2"
        >
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a kind comment…"
            className="flex-1 bg-surface-secondary border border-border rounded-full px-4 py-2 text-xs text-content-primary placeholder:text-content-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary"
            maxLength={120}
          />
          <button
            type="submit"
            disabled={!newComment.trim()}
            className="p-2.5 rounded-full bg-brand-primary text-white disabled:opacity-40 hover:bg-brand-primary/90 active:scale-95 transition-all shadow-md shadow-brand-primary/20"
            aria-label="Post comment"
          >
            <Send size={15} />
          </button>
        </form>
      </div>
    </div>
  );
}
