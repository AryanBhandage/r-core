"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";

interface Notification {
  id: number;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  createdAt: string;
}

/**
 * Global notifications inbox with unread state. Events are written by the
 * backend whenever an application moves, an interview is scheduled, or an
 * offer is made — for both candidates and recruiters.
 */
export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/portal/notifications")
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) return;
        setRows(d.notifications);
        setUnread(d.unread ?? 0);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const markAllRead = async () => {
    setRows((r) => r.map((n) => ({ ...n, read: true })));
    setUnread(0);
    await fetch("/api/portal/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
  };

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) markAllRead();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        title="Notifications"
        className="relative rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-violet-600 px-1 text-[9px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-sm font-semibold text-slate-900">Notifications</span>
            <button onClick={markAllRead} className="flex items-center gap-1 text-[11px] text-violet-700 hover:underline">
              <CheckCheck size={12} /> Mark all read
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {rows.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">No notifications yet.</p>
            ) : (
              rows.map((n) => (
                <div key={n.id} className={`border-b border-slate-50 px-4 py-3 ${n.read ? "" : "bg-violet-50/50"}`}>
                  <div className="text-sm font-medium text-slate-900">{n.title}</div>
                  {n.body && <div className="mt-0.5 text-xs text-slate-600">{n.body}</div>}
                  <div className="mt-1 text-[10px] text-slate-400">{new Date(n.createdAt).toLocaleString()}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
