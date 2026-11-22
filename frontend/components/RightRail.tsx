"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  MessageSquare,
  Send,
  Users,
  X,
  Search,
  CheckCheck,
  Clock,
  Minus,
  Maximize2,
  AlertCircle,
  Coffee,
  Utensils,
  Moon,
  Car,
  Check,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { CurrentUser } from "../app/page";

export type AvailabilityType =
  | "ONLINE"
  | "BUSY"
  | "LUNCH"
  | "OFF_DUTY"
  | "BREAK"
  | "OUTSIDE"
  | "NOT_AVAILABLE"
  | "OFFLINE";

export type DisappearingTtl = "OFF" | "24H" | "7D" | "30D";

interface ChatUser {
  id: number;
  full_name: string;
  role: string;
  email: string;
  assigned_site_ids: string;
  is_active?: boolean;
  availability_status: AvailabilityType;
  not_available_from?: string | null;
  not_available_to?: string | null;
  not_available_reason?: string | null;
  disappearing_messages_ttl?: DisappearingTtl;
  unread_count: number;
  last_message?: {
    content: string;
    time_str: string;
  } | null;
}

interface ChatMessage {
  id: number;
  client_id: number;
  portal_type: string;
  channel_type: "GENERAL" | "DIRECT";
  sender_id: number;
  sender_name: string;
  sender_role: string;
  recipient_id: number | null;
  recipient_name: string | null;
  content: string;
  created_at: string;
  time_str: string;
  date_str: string;
  is_read: boolean;
}

interface RightRailProps {
  clientId?: number;
  companyName?: string;
  currentUser?: CurrentUser;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const AVAILABILITY_CONFIG: Record<
  AvailabilityType,
  { label: string; icon: React.ElementType; color: string; dotClass: string; badgeClass: string }
> = {
  ONLINE: {
    label: "Online",
    icon: Check,
    color: "#10b981",
    dotClass: "bg-emerald-500",
    badgeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  },
  BUSY: {
    label: "Busy",
    icon: AlertCircle,
    color: "#ef4444",
    dotClass: "bg-red-500",
    badgeClass: "bg-red-500/10 text-red-600 border-red-500/20",
  },
  LUNCH: {
    label: "Lunch",
    icon: Utensils,
    color: "#f59e0b",
    dotClass: "bg-amber-500",
    badgeClass: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  },
  BREAK: {
    label: "Break",
    icon: Coffee,
    color: "#eab308",
    dotClass: "bg-yellow-500",
    badgeClass: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  },
  OUTSIDE: {
    label: "Outside",
    icon: Car,
    color: "#0ea5e9",
    dotClass: "bg-sky-500",
    badgeClass: "bg-sky-500/10 text-sky-600 border-sky-500/20",
  },
  OFF_DUTY: {
    label: "Off-Duty",
    icon: Moon,
    color: "#6366f1",
    dotClass: "bg-indigo-500",
    badgeClass: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  },
  NOT_AVAILABLE: {
    label: "Not Available",
    icon: AlertCircle,
    color: "#ef4444",
    dotClass: "bg-rose-500",
    badgeClass: "bg-rose-500/10 text-rose-600 border-rose-500/20",
  },
  OFFLINE: {
    label: "Offline",
    icon: Moon,
    color: "#94a3b8",
    dotClass: "bg-slate-400 dark:bg-slate-500",
    badgeClass: "bg-slate-500/10 text-slate-500 border-slate-500/20",
  },
};

export const RightRail: React.FC<RightRailProps> = ({
  clientId = 1,
  companyName = "Valmet Technologies Oy",
  currentUser,
}) => {
  // Floating Drawer Open/Collapse State (docked at bottom right)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Users & Availability state
  const [chatUsers, setChatUsers] = useState<ChatUser[]>([]);
  const [myAvailability, setMyAvailability] = useState<AvailabilityType>("ONLINE");
  const [myNotAvailableDetails, setMyNotAvailableDetails] = useState<{
    from: string;
    to: string;
    reason: string;
  }>({ from: "", to: "", reason: "" });
  const [isNotAvailableModalOpen, setIsNotAvailableModalOpen] = useState(false);

  // Auto-disappear Chat setting
  const [disappearingTtl, setDisappearingTtl] = useState<DisappearingTtl>("OFF");
  const [isTtlMenuOpen, setIsTtlMenuOpen] = useState(false);
  const ttlMenuRef = useRef<HTMLDivElement>(null);

  // Search filter in drawer
  const [userSearch, setUserSearch] = useState("");

  // =========================================================================
  // LINKEDIN-STYLE FLOATING CHAT BOX (Active Conversation Window)
  // =========================================================================
  const [floatingChat, setFloatingChat] = useState<{
    isOpen: boolean;
    isMinimized: boolean;
    peer: ChatUser | null;
  }>({
    isOpen: false,
    isMinimized: false,
    peer: null,
  });

  const chatBoxRef = useRef<HTMLDivElement>(null);
  const [activeMessages, setActiveMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevUnreadMapRef = useRef<Record<number, number>>({});
  const isFirstLoadRef = useRef(true);
  const lastMsgIdRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Play pleasant notification chime (Web Audio API - Slack/iOS style two-tone)
  const playNotificationSound = useCallback(() => {
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContextClass();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;

      // Note 1: 587.33Hz (D5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.2, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.22);

      // Note 2: 880Hz (A5)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(880, now + 0.08);
      gain2.gain.setValueAtTime(0.25, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.38);
    } catch {}
  }, []);

  // Unlock audio context on user interaction
  useEffect(() => {
    const unlockAudio = () => {
      if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume().catch(() => {});
      }
    };
    window.addEventListener("click", unlockAudio, { once: true });
    window.addEventListener("keydown", unlockAudio, { once: true });
    return () => {
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, []);

  // Notify backend typing state
  const notifyTyping = useCallback(
    async (isTyping: boolean) => {
      if (!currentUser || !floatingChat.peer) return;
      try {
        await fetch(`${API_BASE}/api/client/${clientId}/chat/typing`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sender_id: currentUser.userId,
            recipient_id: floatingChat.peer.id,
            is_typing: isTyping,
          }),
        });
      } catch {}
    },
    [clientId, currentUser, floatingChat.peer]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setChatInput(e.target.value);
    notifyTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      notifyTyping(false);
    }, 2500);
  };

  // Auto-collapse drawer and chat box on outside click (if modal is not open)
  useEffect(() => {
    const handleGlobalClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (ttlMenuRef.current && !ttlMenuRef.current.contains(target)) {
        setIsTtlMenuOpen(false);
      }
      if (isNotAvailableModalOpen) return;

      const isInsideDrawer = drawerRef.current && drawerRef.current.contains(target);
      const isInsideChatBox = chatBoxRef.current && chatBoxRef.current.contains(target);

      // Onclick anywhere outside drawer & chat box: auto collapse both!
      if (!isInsideDrawer && !isInsideChatBox) {
        setIsDrawerOpen(false);
        setFloatingChat((prev) => (prev.isOpen ? { ...prev, isMinimized: true } : prev));
      }
    };
    document.addEventListener("mousedown", handleGlobalClick);
    document.addEventListener("touchstart", handleGlobalClick);
    return () => {
      document.removeEventListener("mousedown", handleGlobalClick);
      document.removeEventListener("touchstart", handleGlobalClick);
    };
  }, [isNotAvailableModalOpen]);

  // Fetch Users & Presence
  const fetchUsers = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/client/${clientId}/chat/users?current_user_id=${currentUser.userId}`
      );
      if (res.ok) {
        const data = await res.json();
        const users: ChatUser[] = data.users || [];
        setChatUsers(users);

        // When a new unread message arrives from a colleague: play chime and directly open & maximize chat box!
        if (!isFirstLoadRef.current) {
          for (const u of users) {
            const prev = prevUnreadMapRef.current[u.id] || 0;
            if (u.id !== currentUser.userId && (u.unread_count || 0) > prev) {
              playNotificationSound();
              setFloatingChat({
                isOpen: true,
                isMinimized: false,
                peer: u,
              });
              break;
            }
          }
        }
        isFirstLoadRef.current = false;
        const unreadMap: Record<number, number> = {};
        users.forEach((u) => {
          unreadMap[u.id] = u.unread_count || 0;
        });
        prevUnreadMapRef.current = unreadMap;

        // Sync my own availability
        const me = users.find((u) => u.id === currentUser.userId);
        if (me) {
          setMyAvailability(me.availability_status || "ONLINE");
          setMyNotAvailableDetails({
            from: me.not_available_from || "",
            to: me.not_available_to || "",
            reason: me.not_available_reason || "",
          });
          setDisappearingTtl(me.disappearing_messages_ttl || "OFF");
        }
      }
    } catch {}
  }, [clientId, currentUser, playNotificationSound]);

  // Fetch Floating Box Messages (1-on-1 direct chat + typing status)
  const fetchFloatingMessages = useCallback(async () => {
    if (!floatingChat.isOpen || !currentUser || !floatingChat.peer) return;
    try {
      const params = new URLSearchParams({
        channel_type: "DIRECT",
        user_id: String(currentUser.userId),
        peer_id: String(floatingChat.peer.id),
      });
      const res = await fetch(
        `${API_BASE}/api/client/${clientId}/chat/messages?${params.toString()}`
      );
      if (res.ok) {
        const data = await res.json();
        const msgs: ChatMessage[] = data.messages || [];
        if (msgs.length > 0) {
          const lastMsg = msgs[msgs.length - 1];
          if (
            lastMsgIdRef.current !== 0 &&
            lastMsg.id > lastMsgIdRef.current &&
            lastMsg.sender_id !== currentUser.userId
          ) {
            playNotificationSound();
          }
          lastMsgIdRef.current = lastMsg.id;
        }
        setActiveMessages(msgs);
        setIsPeerTyping(Boolean(data.is_peer_typing));
      }
    } catch {}
  }, [clientId, currentUser, floatingChat.isOpen, floatingChat.peer, playNotificationSound]);

  // Real-time polling: 2s when active conversation is open
  useEffect(() => {
    fetchUsers();
    fetchFloatingMessages();
    const interval = setInterval(() => {
      fetchUsers();
      fetchFloatingMessages();
    }, 2000);
    return () => clearInterval(interval);
  }, [fetchUsers, fetchFloatingMessages]);

  // Auto-scroll chat box to bottom
  useEffect(() => {
    if (floatingChat.isOpen && !floatingChat.isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeMessages, floatingChat.isOpen, floatingChat.isMinimized]);

  // Handle Availability Change
  const handleSelectAvailability = async (status: AvailabilityType) => {
    if (status === "NOT_AVAILABLE") {
      setIsNotAvailableModalOpen(true);
      return;
    }
    if (!currentUser) return;
    try {
      const res = await fetch(`${API_BASE}/api/client/${clientId}/chat/availability`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: currentUser.userId,
          availability_status: status,
        }),
      });
      if (res.ok) {
        setMyAvailability(status);
        fetchUsers();
      }
    } catch {}
  };

  // Submit Not Available Popup
  const handleSaveNotAvailable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    try {
      const res = await fetch(`${API_BASE}/api/client/${clientId}/chat/availability`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: currentUser.userId,
          availability_status: "NOT_AVAILABLE",
          not_available_from: myNotAvailableDetails.from,
          not_available_to: myNotAvailableDetails.to,
          not_available_reason: myNotAvailableDetails.reason.trim(),
        }),
      });
      if (res.ok) {
        setMyAvailability("NOT_AVAILABLE");
        setIsNotAvailableModalOpen(false);
        fetchUsers();
      }
    } catch {}
  };

  // Handle Disappearing Setting Change
  const handleSelectDisappearingTtl = async (ttl: DisappearingTtl) => {
    if (!currentUser) return;
    try {
      const res = await fetch(`${API_BASE}/api/client/${clientId}/chat/disappearing-setting`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: currentUser.userId,
          ttl,
        }),
      });
      if (res.ok) {
        setDisappearingTtl(ttl);
        fetchUsers();
      }
    } catch {}
  };

  // Open LinkedIn Floating Chat Box (Direct 1-on-1)
  const handleOpenFloatingChat = (peer: ChatUser) => {
    setFloatingChat({
      isOpen: true,
      isMinimized: false,
      peer,
    });
  };

  // Send Message inside LinkedIn Floating Chat Box
  const handleSendChatMessage = async () => {
    const text = chatInput.trim();
    if (!text || !currentUser || !floatingChat.peer || isSending) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    notifyTyping(false);
    setIsSending(true);
    try {
      const payload = {
        channel_type: "DIRECT",
        sender_id: currentUser.userId,
        sender_name: currentUser.fullName || "Client Admin",
        sender_role: currentUser.role || "CLIENT_ADMIN",
        recipient_id: floatingChat.peer.id,
        content: text,
      };

      const res = await fetch(`${API_BASE}/api/client/${clientId}/chat/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const newMsg: ChatMessage = await res.json();
        setActiveMessages((prev) => [...prev, newMsg]);
        setChatInput("");
        fetchUsers();
      }
    } catch {} finally {
      setIsSending(false);
    }
  };

  // Filter colleague users (exclude myself)
  const colleagues = useMemo(() => {
    return chatUsers.filter((u) => {
      if (currentUser && u.id === currentUser.userId) return false;
      if (!userSearch.trim()) return true;
      return (
        u.full_name.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.role.toLowerCase().includes(userSearch.toLowerCase())
      );
    });
  }, [chatUsers, currentUser, userSearch]);

  const totalUnreadCount = useMemo(() => {
    return chatUsers.reduce((sum, u) => sum + (u.unread_count || 0), 0);
  }, [chatUsers]);

  const myCfg = currentUser
    ? AVAILABILITY_CONFIG[myAvailability] || AVAILABILITY_CONFIG.ONLINE
    : AVAILABILITY_CONFIG.OFFLINE;

  return (
    <>
      {/* =================================================================== */}
      {/* 1. MODERN DOCKED MESSAGING BAR & DRAWER (Fixed at Bottom-Right)      */}
      {/* =================================================================== */}
      <div ref={drawerRef} className="fixed bottom-4 right-3 sm:right-5 z-[75] select-none flex flex-col items-end max-w-[calc(100vw-1.5rem)]">
        {/* EXPANDED MESSAGING DRAWER */}
        {isDrawerOpen && (
          <div className="w-[calc(100vw-1.5rem)] sm:w-88 max-w-sm h-[490px] mb-2 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-200">
            {/* Header: Streamlined with Team Chat, inline Status Selector, and One Auto-disappear icon */}
            <div className="p-2.5 border-b border-[var(--border-color)] bg-[var(--bg-secondary)] shrink-0">
              <div className="flex items-center justify-between gap-1.5">
                {/* 1. Team Chat + 2. Next to Team chat: Status Selector only */}
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-[var(--accent-color)]/10 text-[var(--accent-color)] flex items-center justify-center shrink-0">
                    <MessageSquare className="w-3.5 h-3.5" />
                  </div>
                  <h3
                    title={`${companyName} Team Chat`}
                    className="text-xs font-bold text-[var(--text-primary)] whitespace-nowrap cursor-default"
                  >
                    Team Chat
                  </h3>

                  {/* Status Selector only */}
                  <div className="relative">
                    <select
                      value={myAvailability}
                      onChange={(e) => handleSelectAvailability(e.target.value as AvailabilityType)}
                      className="text-[11px] font-semibold pl-2 pr-5 py-1 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-[var(--accent-color)] appearance-none shadow-2xs hover:bg-[var(--bg-secondary)] transition-colors"
                      title="Set availability status"
                    >
                      <option value="ONLINE">🟢 Online</option>
                      <option value="BUSY">⛔ Busy</option>
                      <option value="LUNCH">🍽️ Lunch</option>
                      <option value="OFF_DUTY">🌙 Off-Duty</option>
                      <option value="BREAK">☕ Break</option>
                      <option value="OUTSIDE">🚗 Outside</option>
                      <option value="NOT_AVAILABLE">🔴 Not Available...</option>
                      <option value="OFFLINE">⚪ Offline</option>
                    </select>
                    <ChevronDown className="w-3 h-3 text-[var(--text-secondary)] absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* Right controls: 3. One icon for Auto disappear setting + Collapse button */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* One icon for Auto disappear setting */}
                  <div className="relative" ref={ttlMenuRef}>
                    <button
                      type="button"
                      onClick={() => setIsTtlMenuOpen((prev) => !prev)}
                      title={`Auto-disappear chat: ${
                        disappearingTtl === "OFF" ? "Off (Keep all)" : disappearingTtl
                      }`}
                      className={`p-1.5 rounded-lg border transition-all cursor-pointer relative ${
                        disappearingTtl !== "OFF"
                          ? "border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-400"
                          : "border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      {disappearingTtl !== "OFF" && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500 ring-1 ring-white dark:ring-slate-900" />
                      )}
                    </button>

                    {isTtlMenuOpen && (
                      <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-2xl p-1.5 z-50 text-xs animate-in fade-in zoom-in-95">
                        <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center justify-between border-b border-[var(--border-color)]/60 mb-1">
                          <span>Auto-Disappear</span>
                          <span className="text-[9px] text-emerald-600 font-semibold">Strict Privacy</span>
                        </div>
                        {(
                          [
                            { ttl: "OFF", label: "Off (Keep all)" },
                            { ttl: "24H", label: "After 24 Hours" },
                            { ttl: "7D", label: "After 7 Days" },
                            { ttl: "30D", label: "After 30 Days" },
                          ] as const
                        ).map((item) => (
                          <button
                            key={item.ttl}
                            type="button"
                            onClick={() => {
                              handleSelectDisappearingTtl(item.ttl);
                              setIsTtlMenuOpen(false);
                            }}
                            className={`w-full px-2 py-1.5 rounded-lg text-left flex items-center justify-between text-xs cursor-pointer transition-colors ${
                              disappearingTtl === item.ttl
                                ? "bg-[var(--accent-color)]/10 text-[var(--accent-color)] font-bold"
                                : "hover:bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                            }`}
                          >
                            <span>{item.label}</span>
                            {disappearingTtl === item.ttl && (
                              <Check className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsDrawerOpen(false)}
                    title="Collapse Team Chat"
                    className="p-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] cursor-pointer"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Away Status details if Not Available is active */}
              {myAvailability === "NOT_AVAILABLE" && myNotAvailableDetails.to && (
                <div className="mt-2 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[10px] text-rose-600 dark:text-rose-400 flex items-center justify-between">
                  <span className="truncate">
                    Away until {myNotAvailableDetails.to} ({myNotAvailableDetails.reason || "Leave"})
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsNotAvailableModalOpen(true)}
                    className="font-bold underline ml-1 cursor-pointer shrink-0"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>

            {/* Users List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
              {/* Search user */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[var(--text-secondary)] absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Filter colleagues..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]"
                />
              </div>

              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] pt-1 px-1 flex items-center justify-between">
                <span>Active Colleagues ({colleagues.length})</span>
                <span className="text-[9px] font-normal lowercase">click to chat</span>
              </div>

              {/* Users list */}
              {colleagues.length === 0 ? (
                <div className="p-6 rounded-xl border border-dashed border-[var(--border-color)] text-center space-y-1.5 my-2">
                  <div className="w-8 h-8 mx-auto rounded-full bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-secondary)]">
                    <Users className="w-4 h-4" />
                  </div>
                  <p className="text-xs font-semibold text-[var(--text-primary)]">
                    No other colleagues yet
                  </p>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                    Once colleagues are added to your portal, they will appear here for direct 1-on-1 messaging.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {colleagues.map((u) => {
                    const isUserOffline = u.is_active === false || u.availability_status === "OFFLINE";
                    const effectiveStatus: AvailabilityType = isUserOffline
                      ? "OFFLINE"
                      : (u.availability_status || "OFFLINE");
                    const cfg = AVAILABILITY_CONFIG[effectiveStatus] || AVAILABILITY_CONFIG.OFFLINE;
                    const initials = u.full_name
                      .split(" ")
                      .map((n) => n[0])
                      .join("");
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleOpenFloatingChat(u)}
                        className="w-full p-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--bg-secondary)] flex items-center justify-between transition-all cursor-pointer text-left group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative w-8 h-8 rounded-full bg-[var(--accent-color)]/10 text-[var(--accent-color)] font-bold text-xs flex items-center justify-center shrink-0">
                            <span>{initials}</span>
                            <span
                              className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ${cfg.dotClass} ring-2 ring-white dark:ring-slate-900`}
                              title={cfg.label}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-[var(--text-primary)] truncate flex items-center gap-1.5">
                              <span>{u.full_name}</span>
                              <span className={`text-[8px] px-1 py-0.2 rounded border ${cfg.badgeClass}`}>
                                {cfg.label}
                              </span>
                            </div>
                            <div className="text-[10px] text-[var(--text-secondary)] truncate">
                              {u.role.replace(/_/g, " ")}
                            </div>
                            {u.availability_status === "NOT_AVAILABLE" && u.not_available_to && (
                              <div className="text-[9px] text-rose-500 truncate mt-0.5">
                                Away until {u.not_available_to} ({u.not_available_reason || "Leave"})
                              </div>
                            )}
                          </div>
                        </div>

                        {u.unread_count > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-rose-500 text-white shrink-0">
                            {u.unread_count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* COLLAPSED FLOATING MESSAGING PILL BUTTON (Bottom-Right Dock) */}
        <button
          type="button"
          onClick={() => setIsDrawerOpen(!isDrawerOpen)}
          className="px-4 py-2.5 rounded-full bg-[var(--bg-card)]/95 backdrop-blur-md border border-[var(--border-color)] shadow-xl hover:shadow-2xl flex items-center gap-2.5 cursor-pointer hover:scale-[1.02] transition-all"
        >
          <div className="relative flex items-center justify-center text-[var(--accent-color)]">
            <MessageSquare className="w-4 h-4" />
            {totalUnreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 px-1 py-0.2 rounded-full text-[9px] font-bold bg-rose-500 text-white animate-pulse">
                {totalUnreadCount}
              </span>
            )}
          </div>
          <span className="text-xs font-bold text-[var(--text-primary)]">
            Team Chat
          </span>
          <div className="flex items-center gap-1 pl-1 border-l border-[var(--border-color)]">
            <span className={`w-2 h-2 rounded-full ${myCfg.dotClass}`} />
            <span className="text-[10px] font-medium text-[var(--text-secondary)]">
              {myCfg.label}
            </span>
          </div>
          {isDrawerOpen ? (
            <ChevronDown className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
          )}
        </button>
      </div>

      {/* =================================================================== */}
      {/* 2. LINKEDIN-STYLE FLOATING CHAT BOX (Docked above or beside Team Chat) */}
      {/* =================================================================== */}
      {floatingChat.isOpen && (
        <div
          ref={chatBoxRef}
          className={`fixed transition-all duration-300 shadow-2xl rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] z-[80] ${
            isDrawerOpen
              ? "right-3 sm:right-88 lg:right-96 bottom-4"
              : floatingChat.isMinimized
              ? "right-3 sm:right-5 bottom-[68px]"
              : "right-3 sm:right-5 bottom-4"
          } ${
            floatingChat.isMinimized ? "w-64 sm:w-72 h-11" : "w-[calc(100vw-1.5rem)] sm:w-92 max-w-sm h-[490px] flex flex-col"
          }`}
        >
          {/* Floating Chat Header */}
          {(() => {
            const isPeerOffline =
              floatingChat.peer?.is_active === false ||
              floatingChat.peer?.availability_status === "OFFLINE";
            const peerStatus: AvailabilityType = isPeerOffline
              ? "OFFLINE"
              : (floatingChat.peer?.availability_status || "OFFLINE");
            const peerCfg = AVAILABILITY_CONFIG[peerStatus] || AVAILABILITY_CONFIG.OFFLINE;

            return (
              <div
                onClick={() => {
                  if (floatingChat.isMinimized) {
                    setFloatingChat((prev) => ({ ...prev, isMinimized: false }));
                  }
                }}
                className={`p-2.5 bg-[var(--bg-secondary)] ${
                  floatingChat.isMinimized ? "rounded-2xl" : "border-b border-[var(--border-color)] rounded-t-2xl"
                } flex items-center justify-between shrink-0 cursor-pointer select-none`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="relative w-6 h-6 rounded-full bg-[var(--accent-color)]/10 text-[var(--accent-color)] font-bold text-[10px] flex items-center justify-center shrink-0">
                    <span>
                      {floatingChat.peer?.full_name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </span>
                    <span
                      className={`absolute bottom-0 right-0 w-2 h-2 rounded-full ${peerCfg.dotClass} ring-1 ring-white dark:ring-slate-900`}
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                      {floatingChat.peer?.full_name}
                    </div>
                    <div className="text-[9px] text-[var(--text-secondary)] truncate">
                      {`${peerCfg.label} • ${
                        floatingChat.peer?.role.replace(/_/g, " ") || ""
                      }`}
                    </div>
                  </div>
                </div>

                {/* Minimize & Close Buttons */}
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() =>
                      setFloatingChat((prev) => ({ ...prev, isMinimized: !prev.isMinimized }))
                    }
                    title={floatingChat.isMinimized ? "Maximize Chat" : "Minimize Chat"}
                    className="p-1 rounded hover:bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    {floatingChat.isMinimized ? (
                      <Maximize2 className="w-3.5 h-3.5" />
                    ) : (
                      <Minus className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFloatingChat((prev) => ({ ...prev, isOpen: false }))}
                    title="Close Chat"
                    className="p-1 rounded hover:bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Floating Chat Body (Visible when not minimized) */}
          {!floatingChat.isMinimized && (
            <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg-card)] rounded-b-2xl overflow-hidden">
              {/* Privacy / Disappearing Notice */}
              {disappearingTtl !== "OFF" && (
                <div className="px-3 py-1 bg-amber-500/10 border-b border-amber-500/20 text-[9px] text-amber-700 dark:text-amber-300 flex items-center justify-between shrink-0">
                  <span className="flex items-center gap-1 font-semibold">
                    <Clock className="w-3 h-3" />
                    Auto-disappear active ({disappearingTtl})
                  </span>
                  <span className="opacity-75">Messages auto-deleted</span>
                </div>
              )}

              {/* Message Stream */}
              <div className="flex-1 overflow-y-auto p-3 pr-2.5 space-y-2.5 custom-scrollbar">
                {activeMessages.length === 0 ? (
                  <div className="py-14 text-center space-y-1">
                    <p className="text-xs font-semibold text-[var(--text-secondary)]">
                      No messages in this chat yet.
                    </p>
                    <p className="text-[10px] text-[var(--text-secondary)]">
                      Start private conversation with {floatingChat.peer?.full_name}.
                    </p>
                  </div>
                ) : (
                  activeMessages.map((m) => {
                    const isMe = currentUser && m.sender_id === currentUser.userId;
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                      >
                        {!isMe && (
                          <div className="flex items-center gap-1 mb-0.5 px-1">
                            <span className="text-[10px] font-bold text-[var(--text-primary)]">
                              {m.sender_name}
                            </span>
                            <span className="text-[8px] text-[var(--text-secondary)]">
                              • {m.sender_role.replace(/_/g, " ")}
                            </span>
                          </div>
                        )}
                        <div
                          className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-xs shadow-2xs leading-relaxed ${
                            isMe
                              ? "bg-[var(--accent-color)] text-white rounded-tr-xs"
                              : "bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-tl-xs"
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{m.content}</p>
                          <div
                            className={`flex items-center justify-end gap-1 mt-0.5 text-[8px] ${
                              isMe ? "text-white/80" : "text-[var(--text-secondary)]"
                            }`}
                          >
                            <span>{m.time_str}</span>
                            {isMe && <CheckCheck className="w-2.5 h-2.5" />}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                {/* Typing... Indicator */}
                {isPeerTyping && (
                  <div className="flex flex-col items-start px-1 animate-in fade-in slide-in-from-bottom-1">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[11px] text-[var(--text-secondary)] shadow-2xs">
                      <span className="font-semibold text-[10px] text-[var(--text-primary)]">
                        {floatingChat.peer?.full_name.split(" ")[0]}
                      </span>
                      <span>is typing</span>
                      <span className="flex items-center gap-0.5 ml-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-color)] animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-color)] animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-color)] animate-bounce" />
                      </span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Message Input Box */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendChatMessage();
                }}
                className="p-2 border-t border-[var(--border-color)] bg-[var(--bg-card)] flex items-center gap-1.5 shrink-0"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={handleInputChange}
                  placeholder={`Message ${floatingChat.peer?.full_name || ""}...`}
                  className="flex-1 px-3 py-1.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-hidden focus:ring-1 focus:ring-[var(--accent-color)]"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || isSending}
                  className="p-1.5 rounded-xl bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white cursor-pointer transition-transform active:scale-95 shadow-xs"
                  title="Send message (Enter)"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* 3. MODAL: SET "NOT AVAILABLE" DATE RANGE & REASON                   */}
      {/* =================================================================== */}
      {isNotAvailableModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    Set Not Available Schedule
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Specify absence period & reason for plant team
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNotAvailableModalOpen(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNotAvailable} className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                    From (Date/Time)
                  </label>
                  <input
                    type="datetime-local"
                    value={myNotAvailableDetails.from}
                    onChange={(e) =>
                      setMyNotAvailableDetails((prev) => ({ ...prev, from: e.target.value }))
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                    To (Date/Time)
                  </label>
                  <input
                    type="datetime-local"
                    value={myNotAvailableDetails.to}
                    onChange={(e) =>
                      setMyNotAvailableDetails((prev) => ({ ...prev, to: e.target.value }))
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                  Reason for Absence
                </label>
                <input
                  type="text"
                  value={myNotAvailableDetails.reason}
                  onChange={(e) =>
                    setMyNotAvailableDetails((prev) => ({ ...prev, reason: e.target.value }))
                  }
                  placeholder="e.g. Annual Leave / Vuosiloma, Offsite Audit, Sick Leave"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
                  required
                />
              </div>

              {/* Quick reason chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  "Annual Leave (Vuosiloma)",
                  "Sick Leave (Sairausloma)",
                  "Customer Meeting",
                  "Offsite Plant Inspection",
                  "Personal",
                ].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() =>
                      setMyNotAvailableDetails((prev) => ({ ...prev, reason: r }))
                    }
                    className="px-2 py-0.5 rounded-md text-[10px] bg-[var(--bg-secondary)] hover:bg-[var(--accent-color)]/10 text-[var(--text-secondary)] hover:text-[var(--accent-color)] border border-[var(--border-color)] transition-colors cursor-pointer"
                  >
                    {r}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => setIsNotAvailableModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer shadow-sm"
                >
                  Set Not Available
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
