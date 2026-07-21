"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Bell, CheckCheck, Trash2, AtSign, MessageSquare, UserPlus, Info, X } from "lucide-react";
import type { NotificationItem } from "@/app/api/notifications/route";

interface NotificationDrawerProps {
  onSelectChannel?: (spaceId?: string, channelId?: string) => void;
  onOpenFriends?: () => void;
}

export function NotificationDrawer({
  onSelectChannel,
  onOpenFriends,
}: NotificationDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "mentions">("all");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchNotifications();
    }, 0);
    const interval = setInterval(fetchNotifications, 10000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const mentions = notifications.filter((n) => n.type === "MENTION");

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      }
    } catch {
      // Ignore
    }
  };

  const handleMarkSingleRead = async (id: string) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch {
      // Ignore
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/notifications?id=${id}`, { method: "DELETE" });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch {
      // Ignore
    }
  };

  const handleItemClick = (item: NotificationItem) => {
    handleMarkSingleRead(item.id);
    if (item.type === "MENTION" && item.targetChannelId) {
      onSelectChannel?.(item.targetSpaceId, item.targetChannelId);
    } else if (item.type === "DM" || item.type === "FRIEND_REQUEST") {
      onOpenFriends?.();
    }
    setIsOpen(false);
  };

  const currentList = activeTab === "all" ? notifications : mentions;

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="글로벌 알림 센터"
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-300 transition hover:bg-white/10 hover:text-white"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-gradient-to-r from-rose-500 to-indigo-500 px-1 text-[9px] font-extrabold text-white shadow-md shadow-rose-500/30 animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Slide / Popover Drawer */}
      {isOpen && (
        <div className="absolute right-0 top-12 z-50 w-80 md:w-96 rounded-2xl border border-white/15 bg-slate-950/95 p-4 shadow-2xl backdrop-blur-2xl animate-fadeIn">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white">알림 센터</h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">
                  {unreadCount}개의 안 읽음
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  title="모두 읽음"
                  className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-indigo-400 transition"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  <span>모두 읽음</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-zinc-500 hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 mb-3 border-b border-white/5 pb-2">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                activeTab === "all"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-zinc-400 hover:bg-white/5"
              }`}
            >
              전체 알림 ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("mentions")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                activeTab === "mentions"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-zinc-400 hover:bg-white/5"
              }`}
            >
              <AtSign className="h-3 w-3" />
              <span>@멘션 ({mentions.length})</span>
            </button>
          </div>

          {/* Notification List */}
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {currentList.length === 0 ? (
              <div className="py-10 text-center text-xs text-zinc-500">
                <p>도착한 알림이 없습니다.</p>
              </div>
            ) : (
              currentList.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={`group relative flex gap-3 rounded-xl border p-3 text-xs cursor-pointer transition ${
                    item.isRead
                      ? "border-white/5 bg-white/[0.02] text-zinc-400 hover:bg-white/5"
                      : "border-indigo-500/30 bg-indigo-500/10 text-white hover:bg-indigo-500/20"
                  }`}
                >
                  {/* Type Icon */}
                  <div className="shrink-0 pt-0.5">
                    {item.type === "MENTION" && (
                      <div className="h-7 w-7 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
                        <AtSign className="h-3.5 w-3.5" />
                      </div>
                    )}
                    {item.type === "DM" && (
                      <div className="h-7 w-7 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center">
                        <MessageSquare className="h-3.5 w-3.5" />
                      </div>
                    )}
                    {item.type === "FRIEND_REQUEST" && (
                      <div className="h-7 w-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                        <UserPlus className="h-3.5 w-3.5" />
                      </div>
                    )}
                    {item.type === "SYSTEM" && (
                      <div className="h-7 w-7 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
                        <Info className="h-3.5 w-3.5" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="font-semibold truncate text-white">
                        {item.title}
                      </span>
                      <span className="text-[10px] text-zinc-500 shrink-0">
                        {new Date(item.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-300 line-clamp-2">
                      {item.content}
                    </p>
                  </div>

                  {/* Delete Action */}
                  <button
                    type="button"
                    onClick={(e) => handleDelete(item.id, e)}
                    title="알림 삭제"
                    className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-rose-400 transition shrink-0 self-center p-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
