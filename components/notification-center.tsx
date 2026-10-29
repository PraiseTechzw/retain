"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell, Check, CheckCheck, LoaderCircle } from "lucide-react";
import {
  getMyNotifications,
  markAllMyNotificationsRead,
  markMyNotificationRead,
} from "@/lib/supabase/actions";

type NotificationRecord = {
  id: string;
  type: string;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
};

function notificationHref(notification: NotificationRecord) {
  const id = notification.entity_id;
  switch (notification.entity_type) {
    case "exit_request":
      return id ? `/dashboard/exit-requests/${encodeURIComponent(id)}` : "/dashboard/exit-requests";
    case "exit_case":
      return id ? `/dashboard/exit-requests/${encodeURIComponent(id)}` : "/dashboard/exit-requests";
    case "asset":
      return id ? `/dashboard/assets/${encodeURIComponent(id)}` : "/dashboard/assets";
    case "leave_request":
      return "/dashboard/leave";
    case "knowledge_document":
      return id ? `/dashboard/knowledge-hub/${encodeURIComponent(id)}` : "/dashboard/knowledge-hub";
    default:
      return "/dashboard";
  }
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const unreadCount = notifications.filter((item) => !item.read_at).length;

  async function toggle() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (!nextOpen || loaded || loading) return;

    setLoading(true);
    setError(null);
    try {
      const result = (await getMyNotifications()) as NotificationRecord[];
      setNotifications(result);
      setLoaded(true);
    } catch {
      setError("Unable to load notifications. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function markRead(id: string) {
    setBusyId(id);
    setError(null);
    const formData = new FormData();
    formData.set("notification_id", id);
    try {
      await markMyNotificationRead(formData);
      const readAt = new Date().toISOString();
      setNotifications((items) => items.map((item) => item.id === id ? { ...item, read_at: readAt } : item));
    } catch {
      setError("Unable to mark this notification as read.");
    } finally {
      setBusyId(null);
    }
  }

  async function markAllRead() {
    setBusyId("all");
    setError(null);
    try {
      await markAllMyNotificationsRead();
      const readAt = new Date().toISOString();
      setNotifications((items) => items.map((item) => ({ ...item, read_at: item.read_at ?? readAt })));
    } catch {
      setError("Unable to mark notifications as read.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-expanded={open}
        onClick={() => void toggle()}
        className="relative rounded-xl border border-transparent p-2.5 text-muted-foreground transition hover:border-border hover:bg-card hover:text-foreground focus-visible:border-primary focus-visible:outline-none"
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-none text-white ring-2 ring-background">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <section
          aria-label="Notifications"
          className="absolute right-0 top-14 z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Notifications</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {unreadCount ? `${unreadCount} unread` : "You're all caught up"}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                disabled={busyId !== null}
                onClick={() => void markAllRead()}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-primary hover:bg-primary/5 disabled:opacity-50"
              >
                {busyId === "all" ? <LoaderCircle className="size-3.5 animate-spin" /> : <CheckCheck className="size-3.5" />}
                Mark all read
              </button>
            )}
          </div>

          {error && <p role="alert" className="px-4 pt-3 text-xs text-rose-600">{error}</p>}
          <div className="max-h-[min(28rem,65vh)] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" /> Loading notifications…
              </div>
            ) : notifications.length ? (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`border-b border-border/70 px-4 py-3 last:border-b-0 ${notification.read_at ? "" : "bg-primary/[0.035]"}`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`mt-1.5 size-2 shrink-0 rounded-full ${notification.read_at ? "bg-muted-foreground/30" : "bg-primary"}`} />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={notificationHref(notification)}
                        onClick={() => { if (!notification.read_at) void markRead(notification.id); }}
                        className="text-sm font-semibold text-foreground hover:text-primary"
                      >
                        {notification.title}
                      </Link>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{notification.message}</p>
                      <p className="mt-1.5 text-[10px] text-muted-foreground/80">
                        {new Date(notification.created_at).toLocaleString()}
                      </p>
                    </div>
                    {!notification.read_at && (
                      <button
                        type="button"
                        aria-label="Mark as read"
                        title="Mark as read"
                        disabled={busyId !== null}
                        onClick={() => void markRead(notification.id)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                      >
                        {busyId === notification.id ? <LoaderCircle className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                {loaded ? "No notifications yet." : "Open notifications to load updates."}
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
