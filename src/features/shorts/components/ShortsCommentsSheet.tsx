// src/features/shorts/components/ShortsCommentsSheet.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Send, Sparkles, Smile, Trash2, Loader2, ShieldAlert } from 'lucide-react';
import { useShortsFeatureStore } from '../store/shortsStore';
import { fetchShortComments, addShortComment, deleteShortComment } from '../api/shortsApi';
import { ShortComment } from '../types';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/store/authStore';
import { formatRelativeTime } from '@/lib/formatters';

const EMOJI_REACTIONS = ['❤️', '👏', '🌟', '🎉', '🚀', '🔥', '😄'];

export function ShortsCommentsSheet() {
  const { commentsOpen, activeCommentVideo, closeComments } = useShortsFeatureStore();
  const { user, role } = useAuthStore();

  const [comments, setComments] = useState<ShortComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  const videoId = activeCommentVideo?.id;

  const loadComments = useCallback(async () => {
    if (!videoId) return;
    try {
      setLoading(true);
      setError(null);
      const list = await fetchShortComments(videoId);
      setComments(list);
    } catch (err: any) {
      console.error('Failed to load comments:', err);
      setError(err.message || 'Unable to load comments');
    } finally {
      setLoading(false);
    }
  }, [videoId]);

  useEffect(() => {
    if (commentsOpen && videoId) {
      loadComments();
    } else {
      setComments([]);
      setNewComment('');
      setError(null);
    }
  }, [commentsOpen, videoId, loadComments]);

  if (!commentsOpen || !activeCommentVideo) return null;

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newComment.trim();
    if (!clean || submitting || !videoId) return;

    try {
      setSubmitting(true);
      setError(null);
      const created = await addShortComment(videoId, clean, user?.name || '');
      setComments((prev) => [...prev, created]);
      setNewComment('');
    } catch (err: any) {
      setError(err.message || 'Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await deleteShortComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err: any) {
      setError(err.message || 'Failed to delete comment');
    }
  };

  const handleAddEmoji = (emoji: string) => {
    setNewComment((prev) => (prev + emoji).slice(0, 140));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm select-none transition-all">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={closeComments} />

      {/* Sheet Container */}
      <div className="relative w-full max-w-lg bg-surface-primary border-t border-border rounded-t-3xl shadow-2xl flex flex-col max-h-[75vh] z-10 overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <h3 className="text-fluid-base font-bold text-content-primary">Family Comments</h3>
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

        {/* Child-Safe Header Banner */}
        <div className="bg-brand-primary/5 px-4 py-2 border-b border-brand-primary/10 flex items-center gap-2 text-xs text-brand-primary font-medium">
          <Sparkles size={14} className="shrink-0" />
          <span>Comments are private to your family. Keep comments kind and encouraging!</span>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2 flex items-center gap-2 text-xs text-red-500">
            <ShieldAlert size={14} className="shrink-0" />
            <span className="truncate">{error}</span>
          </div>
        )}

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 text-content-secondary space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
              <p className="text-xs">Loading comments…</p>
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-10 text-content-secondary space-y-1">
              <p className="text-sm font-medium">No comments yet</p>
              <p className="text-xs text-content-tertiary">Be the first in your family to share a kind thought!</p>
            </div>
          ) : (
            comments.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3 group">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div
                    className={cn(
                      'h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm',
                      item.author_role === 'parent' ? 'bg-indigo-600' : 'bg-brand-primary'
                    )}
                  >
                    {item.author_name.charAt(0).toUpperCase() || 'C'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-bold text-content-primary truncate">
                        {item.author_name}
                      </span>
                      {item.author_role === 'parent' && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/15 text-indigo-500 font-semibold">
                          Parent
                        </span>
                      )}
                      <span className="text-[10px] text-content-tertiary">
                        {formatRelativeTime(item.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-content-secondary mt-0.5 break-words">
                      {item.body}
                    </p>
                  </div>
                </div>

                {/* Parent moderation delete or author delete */}
                {(item.can_delete || role === 'parent') && (
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="p-1 rounded text-content-tertiary hover:text-red-500 hover:bg-surface-secondary opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete comment"
                    aria-label="Delete comment"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Emoji Quick Picker */}
        <div className="px-4 py-2 bg-surface-secondary/50 border-t border-border flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <Smile size={16} className="text-content-tertiary mr-1 shrink-0" />
          {EMOJI_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleAddEmoji(emoji)}
              className="text-base p-1 rounded-lg hover:bg-surface-elevated active:scale-95 transition-all"
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Comment Input */}
        <form
          onSubmit={handlePost}
          className="p-3 bg-surface-primary border-t border-border flex items-center gap-2"
        >
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a kind comment…"
            className="flex-1 bg-surface-secondary border border-border rounded-full px-4 py-2 text-xs text-content-primary placeholder:text-content-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary"
            maxLength={140}
          />
          <button
            type="submit"
            disabled={!newComment.trim() || submitting}
            className="p-2.5 rounded-full bg-brand-primary text-white disabled:opacity-40 hover:bg-brand-primary/90 active:scale-95 transition-all shadow-md shadow-brand-primary/20"
            aria-label="Post comment"
          >
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </form>
      </div>
    </div>
  );
}

