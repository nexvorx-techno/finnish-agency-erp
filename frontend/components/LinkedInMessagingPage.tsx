"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  MessageSquare,
  Send,
  Users,
  Search,
  CheckCheck,
  AlertCircle,
  Coffee,
  Utensils,
  Moon,
  Car,
  Check,
  ChevronDown,
  ArrowLeft,
  ShieldCheck,
  X,
  Pin,
  Archive,
  ArchiveRestore,
  Trash2,
  MailCheck,
  Mail,
  MoreVertical,
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

export interface ChatUser {
  id: number;
  full_name: string;
  role: string;
  email: string;
  assigned_site_ids: string;
  avatar_url?: string | null;
  last_seen_at?: string | null;
  last_seen_str?: string;
  is_active?: boolean;
  availability_status: AvailabilityType;
  not_available_from?: string | null;
  not_available_to?: string | null;
  not_available_reason?: string | null;
  disappearing_messages_ttl?: string;
  unread_count: number;
  last_message?: {
    content: string;
    time_str: string;
  } | null;
}

export interface ChatMessage {
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
  is_delivered?: boolean;
  is_read: boolean;
}

interface LinkedInMessagingPageProps {
  clientId?: number;
  companyName?: string;
  currentUser?: CurrentUser | null;
  onUnreadCountChange?: (count: number) => void;
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

// Formats status next to colleague name (e.g. Rishikesh - Online, Mahesh - Not available till 30-11-2026)
function getContactStatus(user: ChatUser): { statusText: string; colorClass: string; dotClass: string } {
  const isUserOffline =
    user.is_active === false ||
    user.availability_status === "OFFLINE" ||
    !user.availability_status;
  const status: AvailabilityType = isUserOffline ? "OFFLINE" : user.availability_status;

  if (status === "ONLINE") {
    return {
      statusText: "Online",
      colorClass: "text-emerald-600 dark:text-emerald-400 font-semibold",
      dotClass: "bg-emerald-500",
    };
  }
  if (status === "NOT_AVAILABLE") {
    let text = "Not available";
    if (user.not_available_to) {
      try {
        const d = new Date(user.not_available_to);
        if (!isNaN(d.getTime())) {
          const day = String(d.getDate()).padStart(2, "0");
          const month = String(d.getMonth() + 1).padStart(2, "0");
          const year = d.getFullYear();
          text = `Not available till ${day}-${month}-${year}`;
        }
      } catch {}
    }
    return {
      statusText: text,
      colorClass: "text-rose-600 dark:text-rose-400 font-medium",
      dotClass: "bg-rose-500",
    };
  }
  if (status === "BUSY") {
    return { statusText: "Busy", colorClass: "text-red-500 font-medium", dotClass: "bg-red-500" };
  }
  if (status === "LUNCH") {
    return { statusText: "Lunch", colorClass: "text-amber-500 font-medium", dotClass: "bg-amber-500" };
  }
  if (status === "BREAK") {
    return { statusText: "Break", colorClass: "text-yellow-600 font-medium", dotClass: "bg-yellow-500" };
  }
  if (status === "OUTSIDE") {
    return { statusText: "Outside", colorClass: "text-sky-500 font-medium", dotClass: "bg-sky-500" };
  }
  if (status === "OFF_DUTY") {
    return { statusText: "Off-Duty", colorClass: "text-indigo-500 font-medium", dotClass: "bg-indigo-500" };
  }
  return { statusText: "Offline", colorClass: "text-slate-400 dark:text-slate-500 font-normal", dotClass: "bg-slate-400" };
}

export const LinkedInMessagingPage: React.FC<LinkedInMessagingPageProps> = ({
  clientId = 1,
  currentUser,
  onUnreadCountChange,
}) => {
  const effectiveClientId = clientId || currentUser?.clientId || 1;

  // Directory users
  const [chatUsers, setChatUsers] = useState<ChatUser[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const cached = localStorage.getItem("erp_cached_chat_users");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(true);

  // Selected peer for active conversation on the LEFT side (Starts as NULL, opens only on explicit click)
  const [selectedPeer, setSelectedPeer] = useState<ChatUser | null>(null);
  const [activeMessages, setActiveMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isPeerTyping, setIsPeerTyping] = useState(false);

  // Right side filters & search
  const [searchQuery, setSearchQuery] = useState("");
  const [directoryFilter, setDirectoryFilter] = useState<"ALL" | "ONLINE" | "UNREAD" | "ARCHIVED">("ALL");

  // Pinned & Archived chat state (Persisted in localStorage)
  const [pinnedUserIds, setPinnedUserIds] = useState<number[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const p =
        localStorage.getItem(`erp_pinned_chats_${currentUser?.userId || 1}`) ||
        localStorage.getItem("erp_pinned_chats");
      return p ? JSON.parse(p) : [];
    } catch {
      return [];
    }
  });

  const [archivedUserIds, setArchivedUserIds] = useState<number[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const a =
        localStorage.getItem(`erp_archived_chats_${currentUser?.userId || 1}`) ||
        localStorage.getItem("erp_archived_chats");
      return a ? JSON.parse(a) : [];
    } catch {
      return [];
    }
  });

  // Action popover state
  const [openCardMenuId, setOpenCardMenuId] = useState<number | null>(null);
  const [isChatHeaderMenuOpen, setIsChatHeaderMenuOpen] = useState(false);
  const [deleteConfirmPeer, setDeleteConfirmPeer] = useState<ChatUser | null>(null);

  // Availability & Settings
  const [myAvailability, setMyAvailability] = useState<AvailabilityType>("ONLINE");
  const [isAvailabilityDropdownOpen, setIsAvailabilityDropdownOpen] = useState(false);
  const [isNotAvailableModalOpen, setIsNotAvailableModalOpen] = useState(false);
  const [myNotAvailableDetails, setMyNotAvailableDetails] = useState({
    from: "",
    to: "",
    reason: "",
  });

  // Audio Context chime & refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef<number>(0);
  const prevUnreadMapRef = useRef<Record<number, number>>({});
  const isFirstLoadRef = useRef(true);
  const lastMsgIdRef = useRef<number>(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Determine current user ID
  const actualMe = useMemo(() => {
    if (!currentUser) return null;
    return (
      chatUsers.find(
        (u) =>
          (currentUser.email && u.email && u.email.toLowerCase() === currentUser.email.toLowerCase()) ||
          u.id === currentUser.userId
      ) || null
    );
  }, [chatUsers, currentUser]);

  const currentUserId = actualMe?.id || currentUser?.userId || 1;

  // Sync pinned and archived chats whenever user identity changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const p =
        localStorage.getItem(`erp_pinned_chats_${currentUserId}`) ||
        localStorage.getItem("erp_pinned_chats");
      if (p) setPinnedUserIds(JSON.parse(p));
      const a =
        localStorage.getItem(`erp_archived_chats_${currentUserId}`) ||
        localStorage.getItem("erp_archived_chats");
      if (a) setArchivedUserIds(JSON.parse(a));
    } catch {}
  }, [currentUserId]);

  // Save pinned / archived to localStorage
  const handleTogglePin = (userId: number, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setOpenCardMenuId(null);
    setIsChatHeaderMenuOpen(false);
    setPinnedUserIds((prev) => {
      const isPinned = prev.includes(userId);
      const next = isPinned ? prev.filter((id) => id !== userId) : [userId, ...prev];
      try {
        localStorage.setItem(`erp_pinned_chats_${currentUserId}`, JSON.stringify(next));
        localStorage.setItem("erp_pinned_chats", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleToggleArchive = (userId: number, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setOpenCardMenuId(null);
    setIsChatHeaderMenuOpen(false);
    setArchivedUserIds((prev) => {
      const isArchived = prev.includes(userId);
      const next = isArchived ? prev.filter((id) => id !== userId) : [...prev, userId];
      try {
        localStorage.setItem(`erp_archived_chats_${currentUserId}`, JSON.stringify(next));
        localStorage.setItem("erp_archived_chats", JSON.stringify(next));
      } catch {}
      return next;
    });
    // If the active conversation was archived, close it
    if (selectedPeer?.id === userId) {
      setSelectedPeer(null);
    }
  };

  // Mark chat as read or unread
  const handleMarkChatRead = async (peer: ChatUser, isRead: boolean, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setOpenCardMenuId(null);
    setIsChatHeaderMenuOpen(false);
    try {
      await fetch(`${API_BASE}/api/client/${effectiveClientId}/chat/mark-read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: currentUserId,
          peer_id: peer.id,
          is_read: isRead,
        }),
      });
      // Optimistically update local state
      setChatUsers((prev) =>
        prev.map((u) => (u.id === peer.id ? { ...u, unread_count: isRead ? 0 : 1 } : u))
      );
      if (selectedPeer?.id === peer.id && !isRead) {
        setSelectedPeer(null);
      }
    } catch {}
  };

  // Delete chat history
  const handleConfirmDeleteChat = async () => {
    if (!deleteConfirmPeer) return;
    try {
      await fetch(
        `${API_BASE}/api/client/${effectiveClientId}/chat/messages?user_id=${currentUserId}&peer_id=${deleteConfirmPeer.id}`,
        { method: "DELETE" }
      );
      if (selectedPeer?.id === deleteConfirmPeer.id) {
        setActiveMessages([]);
        setSelectedPeer(null);
      }
      setChatUsers((prev) =>
        prev.map((u) => (u.id === deleteConfirmPeer.id ? { ...u, last_message: null, unread_count: 0 } : u))
      );
    } catch {}
    setDeleteConfirmPeer(null);
    setOpenCardMenuId(null);
    setIsChatHeaderMenuOpen(false);
  };

  // Notification chime
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

  // Unlock Web Audio
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

  // Close menus on outside click (avoid closing prematurely if clicking inside a menu container)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setIsAvailabilityDropdownOpen(false);
      }
      if (target.closest && target.closest("[data-menu-container]")) {
        return;
      }
      setOpenCardMenuId(null);
      setIsChatHeaderMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch directory of colleagues and calculate total unread
  const fetchUsers = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/client/${effectiveClientId}/chat/users?current_user_id=${currentUserId}`
      );
      if (res.ok) {
        const data = await res.json();
        const users: ChatUser[] = data.users || [];
        setChatUsers(users);
        setIsLoadingUsers(false);

        try {
          localStorage.setItem("erp_cached_chat_users", JSON.stringify(users));
        } catch {}

        const totalUnread = users.reduce(
          (sum, u) => sum + (u.id !== currentUserId ? u.unread_count || 0 : 0),
          0
        );
        onUnreadCountChange?.(totalUnread);

        if (!isFirstLoadRef.current) {
          for (const u of users) {
            const prev = prevUnreadMapRef.current[u.id] || 0;
            if (u.id !== currentUserId && (u.unread_count || 0) > prev) {
              playNotificationSound();
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

        if (selectedPeer) {
          const fresh = users.find((u) => u.id === selectedPeer.id);
          if (fresh) setSelectedPeer(fresh);
        }

        const me = users.find(
          (u) =>
            (currentUser?.email && u.email && u.email.toLowerCase() === currentUser.email.toLowerCase()) ||
            u.id === currentUserId
        );
        if (me) {
          setMyAvailability(me.availability_status || "ONLINE");
          setMyNotAvailableDetails({
            from: me.not_available_from || "",
            to: me.not_available_to || "",
            reason: me.not_available_reason || "",
          });
        }
      }
    } catch {
      setIsLoadingUsers(false);
    }
  }, [effectiveClientId, currentUser, currentUserId, onUnreadCountChange, playNotificationSound, selectedPeer]);

  // Fetch active conversation messages
  const fetchMessages = useCallback(async () => {
    if (!selectedPeer || !currentUser) return;
    try {
      const params = new URLSearchParams({
        channel_type: "DIRECT",
        user_id: String(currentUserId),
        peer_id: String(selectedPeer.id),
      });
      const res = await fetch(
        `${API_BASE}/api/client/${effectiveClientId}/chat/messages?${params.toString()}`
      );
      if (res.ok) {
        const data = await res.json();
        const msgs: ChatMessage[] = data.messages || [];
        if (msgs.length > 0) {
          const lastMsg = msgs[msgs.length - 1];
          if (
            lastMsgIdRef.current !== 0 &&
            lastMsg.id > lastMsgIdRef.current &&
            lastMsg.sender_id !== currentUserId
          ) {
            playNotificationSound();
          }
          lastMsgIdRef.current = lastMsg.id;
        }

        setActiveMessages((prev) => {
          const pendingOptimistic = prev.filter(
            (p) => p.id < 0 && !msgs.some((m) => m.content === p.content && m.sender_id === p.sender_id)
          );
          return [...msgs, ...pendingOptimistic];
        });
        setIsPeerTyping(Boolean(data.is_peer_typing));
      }
    } catch {}
  }, [selectedPeer, currentUser, currentUserId, effectiveClientId, playNotificationSound]);

  // Polling intervals
  useEffect(() => {
    fetchUsers();
    const userInterval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        fetchUsers();
      }
    }, 7000);
    return () => clearInterval(userInterval);
  }, [fetchUsers]);

  useEffect(() => {
    if (!selectedPeer) return;
    fetchMessages();
    const msgInterval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        fetchMessages();
      }
    }, 2500);
    return () => clearInterval(msgInterval);
  }, [selectedPeer, fetchMessages]);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    if (selectedPeer) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeMessages, selectedPeer]);

  // Notify backend typing state
  const notifyTyping = useCallback(
    async (isTyping: boolean) => {
      if (!currentUser || !selectedPeer) return;
      try {
        await fetch(`${API_BASE}/api/client/${effectiveClientId}/chat/typing`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sender_id: currentUserId,
            recipient_id: selectedPeer.id,
            is_typing: isTyping,
          }),
        });
      } catch {}
    },
    [currentUser, selectedPeer, effectiveClientId, currentUserId]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setChatInput(e.target.value);
    const now = Date.now();
    if (now - lastTypingSentRef.current > 3500) {
      lastTypingSentRef.current = now;
      notifyTyping(true);
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      notifyTyping(false);
      lastTypingSentRef.current = 0;
    }, 2500);
  };

  // Send message with instant 0ms optimistic UI
  const handleSendMessage = async () => {
    const text = chatInput.trim();
    if (!text || !currentUser || !selectedPeer) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    lastTypingSentRef.current = 0;
    notifyTyping(false);
    setChatInput("");

    const optimisticId = -Date.now();
    const optimisticMsg: ChatMessage = {
      id: optimisticId,
      client_id: effectiveClientId,
      portal_type: "CLIENT",
      channel_type: "DIRECT",
      sender_id: currentUserId,
      sender_name: currentUser.fullName || "Client Admin",
      sender_role: currentUser.role || "CLIENT_ADMIN",
      recipient_id: selectedPeer.id,
      recipient_name: selectedPeer.full_name,
      content: text,
      created_at: new Date().toISOString(),
      time_str: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: false }),
      date_str: "Today",
      is_read: false,
    };

    setActiveMessages((prev) => [...prev, optimisticMsg]);

    try {
      const payload = {
        channel_type: "DIRECT",
        sender_id: currentUserId,
        sender_name: currentUser.fullName || "Client Admin",
        sender_role: currentUser.role || "CLIENT_ADMIN",
        recipient_id: selectedPeer.id,
        content: text,
      };

      const res = await fetch(`${API_BASE}/api/client/${effectiveClientId}/chat/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        fetchMessages();
        fetchUsers();
      }
    } catch {}
  };

  // Select user to chat with (Triggered only when the user explicitly clicks a colleague)
  const handleSelectPeer = (peer: ChatUser) => {
    setSelectedPeer(peer);
    setActiveMessages([]);
    setChatUsers((prev) =>
      prev.map((u) => (u.id === peer.id ? { ...u, unread_count: 0 } : u))
    );
  };

  // Change availability status
  const handleSelectAvailability = async (status: AvailabilityType) => {
    setIsAvailabilityDropdownOpen(false);
    if (status === "NOT_AVAILABLE") {
      setIsNotAvailableModalOpen(true);
      return;
    }
    if (!currentUser) return;
    try {
      const res = await fetch(`${API_BASE}/api/client/${effectiveClientId}/chat/availability`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: currentUserId,
          availability_status: status,
        }),
      });
      if (res.ok) {
        setMyAvailability(status);
        fetchUsers();
      }
    } catch {}
  };

  // Save not available details
  const handleSaveNotAvailable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    try {
      const res = await fetch(`${API_BASE}/api/client/${effectiveClientId}/chat/availability`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: currentUserId,
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

  // Filtered and SORTED directory list:
  // 1. Pinned chats on top
  // 2. Unread messages on top
  // 3. Recent chats on top
  // 4. Alphabetical fallback
  const filteredUsers = useMemo(() => {
    return chatUsers
      .filter((u) => {
        if (u.id === currentUserId) return false;
        if (currentUser?.email && u.email && u.email.toLowerCase() === currentUser.email.toLowerCase()) {
          return false;
        }
        return true;
      })
      .filter((u) => {
        // Handle Archive filter:
        const isArchived = archivedUserIds.includes(u.id);
        if (directoryFilter === "ARCHIVED") {
          return isArchived;
        }
        // In All / Online / Unread: hide archived contacts
        if (isArchived) return false;

        const isOffline = u.is_active === false || u.availability_status === "OFFLINE" || !u.availability_status;
        const status = isOffline ? "OFFLINE" : u.availability_status;

        if (directoryFilter === "ONLINE") {
          return status === "ONLINE";
        }
        if (directoryFilter === "UNREAD") {
          return (u.unread_count || 0) > 0;
        }
        return true;
      })
      .filter((u) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          u.full_name.toLowerCase().includes(q) ||
          u.role.toLowerCase().includes(q) ||
          (u.email && u.email.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        // 1. Pinned chats on top (ordered by most recently pinned)
        const aPinned = pinnedUserIds.includes(a.id);
        const bPinned = pinnedUserIds.includes(b.id);
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;
        if (aPinned && bPinned) {
          return pinnedUserIds.indexOf(a.id) - pinnedUserIds.indexOf(b.id);
        }

        // 2. Unread messages on top
        const aUnread = a.unread_count || 0;
        const bUnread = b.unread_count || 0;
        if (aUnread > 0 && bUnread === 0) return -1;
        if (aUnread === 0 && bUnread > 0) return 1;
        if (aUnread > 0 && bUnread > 0 && aUnread !== bUnread) return bUnread - aUnread;

        // 3. Recent chats on top
        const aHasMsg = Boolean(a.last_message);
        const bHasMsg = Boolean(b.last_message);
        if (aHasMsg && !bHasMsg) return -1;
        if (!aHasMsg && bHasMsg) return 1;

        // 4. Alphabetical fallback
        return a.full_name.localeCompare(b.full_name);
      });
  }, [chatUsers, currentUserId, currentUser, searchQuery, directoryFilter, pinnedUserIds, archivedUserIds]);

  // Accurate online count (strictly status === "ONLINE" and active)
  const onlineCount = useMemo(() => {
    return chatUsers.filter((u) => {
      if (u.id === currentUserId) return false;
      if (currentUser?.email && u.email && u.email.toLowerCase() === currentUser.email.toLowerCase()) return false;
      return u.is_active !== false && u.availability_status === "ONLINE";
    }).length;
  }, [chatUsers, currentUserId, currentUser]);

  const totalUnreadCount = useMemo(() => {
    return chatUsers.reduce((sum, u) => sum + (u.id !== currentUserId ? u.unread_count || 0 : 0), 0);
  }, [chatUsers, currentUserId]);

  const totalArchivedCount = archivedUserIds.length;

  return (
    <div className="w-full h-full min-h-[500px] max-w-7xl mx-auto flex flex-col md:flex-row bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl shadow-sm overflow-hidden animate-in fade-in duration-150">
      
      {/* ========================================================================= */}
      {/* LEFT SIDE: ACTIVE CHAT SCREEN (Full Conversation Thread)                  */}
      {/* ========================================================================= */}
      <section
        className={`flex-1 flex flex-col min-w-0 h-full border-b md:border-b-0 md:border-r border-[var(--border-color)] bg-[var(--bg-card)] ${
          selectedPeer ? "flex" : "hidden md:flex"
        }`}
      >
        {selectedPeer ? (
          <>
            {/* 1. Chat Header */}
            {(() => {
              const peerStatus = getContactStatus(selectedPeer);
              const isPinned = pinnedUserIds.includes(selectedPeer.id);
              const isArchived = archivedUserIds.includes(selectedPeer.id);

              return (
                <header className="px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-card)] flex items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Mobile Back to People List */}
                    <button
                      type="button"
                      onClick={() => setSelectedPeer(null)}
                      className="md:hidden p-1.5 -ml-1 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] cursor-pointer"
                      title="Back to teammates"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>

                    {/* Peer Avatar & Status Ring */}
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full bg-[var(--accent-color)] text-white font-bold text-xs flex items-center justify-center overflow-hidden shadow-xs ring-2 ring-[var(--border-color)]">
                        {selectedPeer.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={selectedPeer.avatar_url}
                            alt={selectedPeer.full_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          selectedPeer.full_name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()
                        )}
                      </div>
                      <span
                        className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${peerStatus.dotClass}`}
                      />
                    </div>

                    {/* Next to Name - Show status (e.g. Rishikesh - Online, Mahesh - Not available till 30-11-2026) */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-[var(--text-primary)] truncate">
                          {selectedPeer.full_name} <span className="font-normal text-[var(--text-secondary)]">-</span>{" "}
                          <span className={peerStatus.colorClass}>{peerStatus.statusText}</span>
                        </h3>
                        {isPinned && <Pin className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />}
                      </div>

                      <p className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5">
                        {selectedPeer.role.replace(/_/g, " ")} • {selectedPeer.email}
                      </p>
                    </div>
                  </div>

                  {/* Action Controls & More Options Menu */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div
                      title="End-to-end encrypted plant channel"
                      className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--bg-secondary)] text-[var(--text-secondary)] text-[11px] font-medium"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Encrypted Direct</span>
                    </div>

                    {/* Direct 1-Click Pin Button in Chat Header */}
                    <button
                      type="button"
                      onClick={(e) => handleTogglePin(selectedPeer.id, e)}
                      title={isPinned ? "Unpin Chat" : "Pin Chat to Top"}
                      className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                        isPinned
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold ring-1 ring-amber-500/30"
                          : "text-[var(--text-secondary)] hover:text-amber-500 hover:bg-[var(--bg-secondary)]"
                      }`}
                    >
                      <Pin className={`w-4 h-4 ${isPinned ? "fill-amber-500 text-amber-500" : ""}`} />
                    </button>

                    {/* 3-dots Menu for Chat Actions */}
                    <div data-menu-container="true" className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsChatHeaderMenuOpen((prev) => !prev);
                        }}
                        className="p-1.5 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] cursor-pointer transition-colors"
                        title="Chat Options"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {isChatHeaderMenuOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 top-full mt-1 w-48 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xl z-50 py-1.5 animate-in fade-in zoom-in-95 duration-100 text-xs"
                        >
                          <button
                            type="button"
                            onClick={(e) => handleTogglePin(selectedPeer.id, e)}
                            className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] cursor-pointer"
                          >
                            <Pin className="w-3.5 h-3.5 text-amber-500" />
                            <span>{isPinned ? "Unpin Chat" : "Pin Chat to Top"}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleMarkChatRead(selectedPeer, false)}
                            className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] cursor-pointer"
                          >
                            <Mail className="w-3.5 h-3.5 text-blue-500" />
                            <span>Mark as Unread</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleArchive(selectedPeer.id)}
                            className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] cursor-pointer"
                          >
                            {isArchived ? (
                              <>
                                <ArchiveRestore className="w-3.5 h-3.5 text-indigo-500" />
                                <span>Unarchive Chat</span>
                              </>
                            ) : (
                              <>
                                <Archive className="w-3.5 h-3.5 text-indigo-500" />
                                <span>Archive Chat</span>
                              </>
                            )}
                          </button>

                          <div className="h-px bg-[var(--border-color)]/60 my-1" />

                          <button
                            type="button"
                            onClick={() => {
                              setDeleteConfirmPeer(selectedPeer);
                              setIsChatHeaderMenuOpen(false);
                            }}
                            className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-rose-500/10 text-rose-600 cursor-pointer font-medium"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete Chat</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Close Active Chat button */}
                    <button
                      type="button"
                      onClick={() => setSelectedPeer(null)}
                      title="Close conversation"
                      className="p-1.5 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] cursor-pointer transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </header>
              );
            })()}

            {/* 2. Messages Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[var(--bg-secondary)]/20 custom-scrollbar">
              {activeMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3 text-[var(--text-secondary)]">
                  <div className="w-12 h-12 rounded-2xl bg-[var(--accent-color)]/10 text-[var(--accent-color)] flex items-center justify-center">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[var(--text-primary)]">
                      Start a direct conversation with {selectedPeer.full_name}
                    </h4>
                    <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-sm">
                      Send shift handovers, attendance questions, or coordination notes in real-time.
                    </p>
                  </div>
                </div>
              ) : (
                activeMessages.map((msg, idx) => {
                  const isMe = msg.sender_id === currentUserId;
                  const prevMsg = activeMessages[idx - 1];
                  const showDate = !prevMsg || prevMsg.date_str !== msg.date_str;

                  return (
                    <React.Fragment key={msg.id || idx}>
                      {showDate && (
                        <div className="flex justify-center my-3">
                          <span className="px-3 py-1 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)] text-[10px] font-bold text-[var(--text-secondary)] shadow-2xs">
                            {msg.date_str || "Today"}
                          </span>
                        </div>
                      )}

                      <div
                        className={`flex flex-col ${
                          isMe ? "items-end" : "items-start"
                        } animate-in fade-in duration-100`}
                      >
                        <div
                          className={`max-w-[85%] sm:max-w-[70%] px-4 py-2.5 rounded-2xl text-xs leading-relaxed shadow-2xs ${
                            isMe
                              ? "bg-[var(--accent-color)] text-white rounded-br-xs"
                              : "bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-bl-xs"
                          }`}
                        >
                          {!isMe && (
                            <span className="block text-[10px] font-bold text-[var(--accent-color)] mb-1">
                              {msg.sender_name}
                            </span>
                          )}
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          <div
                            className={`flex items-center justify-end gap-1 mt-1 text-[9px] ${
                              isMe ? "text-white/80" : "text-[var(--text-secondary)]"
                            }`}
                          >
                            <span>{msg.time_str}</span>
                            {isMe && (
                              <CheckCheck
                                className={`w-3.5 h-3.5 ${
                                  msg.is_read ? "text-sky-300" : "text-white/70"
                                }`}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })
              )}

              {/* Typing Indicator */}
              {isPeerTyping && (
                <div className="flex items-center gap-2 p-2 text-xs text-[var(--text-secondary)] animate-pulse">
                  <div className="w-6 h-6 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-center font-bold text-[9px]">
                    {selectedPeer.full_name[0]}
                  </div>
                  <span className="italic">{selectedPeer.full_name} is typing...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* 3. Message Input Bar */}
            <footer className="p-3 border-t border-[var(--border-color)] bg-[var(--bg-card)] shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={handleInputChange}
                    placeholder={`Write a message to ${selectedPeer.full_name}...`}
                    className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-color)] focus:ring-1 focus:ring-[var(--accent-color)] transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="px-4 py-2.5 rounded-xl bg-[var(--accent-color)] text-white text-xs font-bold hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Send</span>
                </button>
              </form>
            </footer>
          </>
        ) : (
          /* Clean Enterprise Empty State (No consumer branding / no extra pills) */
          <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-[var(--accent-color)]/10 text-[var(--accent-color)] flex items-center justify-center shadow-inner">
              <MessageSquare className="w-8 h-8" />
            </div>
            <div className="max-w-md space-y-2">
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                Team Messaging & Operations Chat
              </h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Select any colleague from the directory on the right to start messaging, coordinate shifts, and discuss site operations.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* RIGHT SIDE: LIST OF PEOPLES (Teammates Directory)                         */}
      {/* ========================================================================= */}
      <aside
        className={`w-full md:w-80 lg:w-96 shrink-0 flex flex-col h-full bg-[var(--bg-secondary)]/30 ${
          selectedPeer ? "hidden md:flex" : "flex"
        }`}
      >
        {/* 1. Header with My Presence Selector */}
        <header className="p-3.5 border-b border-[var(--border-color)] bg-[var(--bg-card)] space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[var(--accent-color)]" />
                <span>Teammates</span>
              </h2>
              {onlineCount > 0 ? (
                <span className="px-2 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-bold border border-emerald-500/20">
                  {onlineCount} online
                </span>
              ) : (
                <span className="px-2 py-0.2 rounded-full bg-slate-500/10 text-slate-500 text-[10px] font-medium border border-slate-500/20">
                  0 online
                </span>
              )}
            </div>

            {/* My Presence Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsAvailabilityDropdownOpen((prev) => !prev)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                  AVAILABILITY_CONFIG[myAvailability]?.badgeClass || "bg-[var(--bg-secondary)]"
                }`}
                title="Change my status"
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    AVAILABILITY_CONFIG[myAvailability]?.dotClass || "bg-emerald-500"
                  }`}
                />
                <span>{AVAILABILITY_CONFIG[myAvailability]?.label}</span>
                <ChevronDown className="w-3 h-3 ml-0.5 opacity-70" />
              </button>

              {isAvailabilityDropdownOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xl z-50 py-1.5 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] border-b border-[var(--border-color)]/60 mb-1">
                    Set Your Status
                  </div>
                  {(Object.keys(AVAILABILITY_CONFIG) as AvailabilityType[]).map((st) => {
                    const cfg = AVAILABILITY_CONFIG[st];
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => handleSelectAvailability(st)}
                        className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between hover:bg-[var(--bg-secondary)] transition-colors cursor-pointer ${
                          myAvailability === st ? "font-bold text-[var(--accent-color)]" : "text-[var(--text-primary)]"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${cfg.dotClass}`} />
                          <span>{cfg.label}</span>
                        </div>
                        {myAvailability === st && <Check className="w-3.5 h-3.5 text-[var(--accent-color)]" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Search Teammates */}
          <div className="relative">
            <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, role or email..."
              className="w-full pl-10 pr-8 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-color)] transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Pills with Archived Tab */}
          <div className="flex items-center gap-1 pt-0.5">
            <button
              type="button"
              onClick={() => setDirectoryFilter("ALL")}
              className={`flex-1 py-1 rounded-lg text-[10px] font-bold text-center transition-all cursor-pointer ${
                directoryFilter === "ALL"
                  ? "bg-[var(--accent-color)] text-white shadow-2xs"
                  : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              All ({chatUsers.filter((u) => u.id !== currentUserId && !archivedUserIds.includes(u.id)).length})
            </button>
            <button
              type="button"
              onClick={() => setDirectoryFilter("ONLINE")}
              className={`flex-1 py-1 rounded-lg text-[10px] font-bold text-center transition-all cursor-pointer ${
                directoryFilter === "ONLINE"
                  ? "bg-[var(--accent-color)] text-white shadow-2xs"
                  : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              Online ({onlineCount})
            </button>
            <button
              type="button"
              onClick={() => setDirectoryFilter("UNREAD")}
              className={`flex-1 py-1 rounded-lg text-[10px] font-bold text-center transition-all cursor-pointer ${
                directoryFilter === "UNREAD"
                  ? "bg-[var(--accent-color)] text-white shadow-2xs"
                  : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              Unread {totalUnreadCount > 0 ? `(${totalUnreadCount})` : ""}
            </button>
            {totalArchivedCount > 0 && (
              <button
                type="button"
                onClick={() => setDirectoryFilter("ARCHIVED")}
                className={`py-1 px-2 rounded-lg text-[10px] font-bold text-center transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  directoryFilter === "ARCHIVED"
                    ? "bg-[var(--accent-color)] text-white shadow-2xs"
                    : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
                title="Archived Conversations"
              >
                <Archive className="w-3 h-3" />
                <span>({totalArchivedCount})</span>
              </button>
            )}
          </div>
        </header>

        {/* 2. Colleagues List (Sorted: Pinned -> Unread -> Recent chats -> Alphabetical) */}
        <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-color)]/60 custom-scrollbar">
          {isLoadingUsers && chatUsers.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--text-secondary)]">
              Loading colleagues...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center space-y-2 text-[var(--text-secondary)]">
              <Users className="w-8 h-8 mx-auto opacity-40" />
              <p className="text-xs font-bold text-[var(--text-primary)]">
                {directoryFilter === "ARCHIVED" ? "No archived chats" : "No contacts found"}
              </p>
              <p className="text-[11px]">
                {directoryFilter === "ARCHIVED"
                  ? "Conversations you archive will appear here."
                  : "Try adjusting your search query or filters."}
              </p>
            </div>
          ) : (
            filteredUsers.map((user) => {
              const isSelected = selectedPeer?.id === user.id;
              const hasUnread = (user.unread_count || 0) > 0;
              const statusInfo = getContactStatus(user);
              const isPinned = pinnedUserIds.includes(user.id);
              const isArchived = archivedUserIds.includes(user.id);
              const isMenuOpen = openCardMenuId === user.id;

              return (
                <div
                  key={user.id}
                  onClick={() => handleSelectPeer(user)}
                  className={`w-full p-3 text-left transition-all flex items-start gap-3 cursor-pointer group relative ${
                    isSelected
                      ? "bg-[var(--accent-light)]/60 border-l-4 border-l-[var(--accent-color)]"
                      : isPinned
                      ? "bg-amber-500/5 hover:bg-amber-500/10 border-l-4 border-l-amber-500"
                      : "hover:bg-[var(--bg-card)] border-l-4 border-l-transparent"
                  }`}
                >
                  {/* User Avatar with Presence Dot */}
                  <div className="relative shrink-0 mt-0.5">
                    <div className="w-9 h-9 rounded-full bg-[var(--accent-color)] text-white font-bold text-xs flex items-center justify-center overflow-hidden shadow-xs ring-1 ring-[var(--border-color)]">
                      {user.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={user.avatar_url}
                          alt={user.full_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        user.full_name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()
                      )}
                    </div>
                    <span
                      className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 ${statusInfo.dotClass}`}
                    />
                  </div>

                  {/* Details with Name - Status */}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center justify-between gap-1">
                      {/* Name - Status (e.g. Rishikesh - Online, Mahesh - Not available till 30-11-2026) */}
                      <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                        <h4
                          className={`text-xs truncate ${
                            hasUnread ? "font-black text-[var(--text-primary)]" : "font-bold text-[var(--text-primary)]"
                          }`}
                        >
                          {user.full_name} <span className="font-normal text-[var(--text-secondary)]">-</span>{" "}
                          <span className={statusInfo.colorClass}>{statusInfo.statusText}</span>
                        </h4>
                        {isPinned && (
                          <span
                            title="Pinned conversation"
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold text-[9px] border border-amber-500/30 shrink-0"
                          >
                            <Pin className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                            <span>Pinned</span>
                          </span>
                        )}
                      </div>

                      {user.last_message && (
                        <span className="text-[10px] text-[var(--text-secondary)] whitespace-nowrap shrink-0">
                          {user.last_message.time_str}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-1">
                      <p className="text-[11px] text-[var(--text-secondary)] truncate">
                        {user.last_message ? (
                          <span className={hasUnread ? "font-bold text-[var(--text-primary)]" : ""}>
                            {user.last_message.content}
                          </span>
                        ) : (
                          <span>{user.role.replace(/_/g, " ")}</span>
                        )}
                      </p>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {hasUnread && (
                          <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-black text-[9px] animate-pulse">
                            {user.unread_count}
                          </span>
                        )}

                        {/* Direct 1-Click Pin Button */}
                        <button
                          type="button"
                          onClick={(e) => handleTogglePin(user.id, e)}
                          title={isPinned ? "Unpin Chat" : "Pin Chat to Top"}
                          className={`p-1 rounded-md transition-all cursor-pointer ${
                            isPinned
                              ? "text-amber-500 opacity-100 hover:text-amber-600"
                              : "text-[var(--text-secondary)] hover:text-amber-500 opacity-0 group-hover:opacity-100"
                          }`}
                        >
                          <Pin className={`w-3.5 h-3.5 ${isPinned ? "fill-amber-500 text-amber-500" : ""}`} />
                        </button>

                        {/* 3-dots Context Menu Button */}
                        <div data-menu-container="true" className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenCardMenuId(isMenuOpen ? null : user.id);
                            }}
                            className="p-1 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            title="More options"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>

                          {/* Card Dropdown Menu */}
                          {isMenuOpen && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xl z-50 py-1 animate-in fade-in zoom-in-95 duration-100 text-[11px]"
                            >
                              <button
                                type="button"
                                onClick={(e) => handleTogglePin(user.id, e)}
                                className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] cursor-pointer"
                              >
                                <Pin className="w-3 h-3 text-amber-500" />
                                <span>{isPinned ? "Unpin Chat" : "Pin to Top"}</span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => handleMarkChatRead(user, hasUnread, e)}
                                className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] cursor-pointer"
                              >
                                {hasUnread ? (
                                  <>
                                    <MailCheck className="w-3 h-3 text-emerald-500" />
                                    <span>Mark as Read</span>
                                  </>
                                ) : (
                                  <>
                                    <Mail className="w-3 h-3 text-blue-500" />
                                    <span>Mark as Unread</span>
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={(e) => handleToggleArchive(user.id, e)}
                                className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] cursor-pointer"
                              >
                                {isArchived ? (
                                  <>
                                    <ArchiveRestore className="w-3 h-3 text-indigo-500" />
                                    <span>Unarchive</span>
                                  </>
                                ) : (
                                  <>
                                    <Archive className="w-3 h-3 text-indigo-500" />
                                    <span>Archive</span>
                                  </>
                                )}
                              </button>

                              <div className="h-px bg-[var(--border-color)]/60 my-1" />

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmPeer(user);
                                  setOpenCardMenuId(null);
                                }}
                                className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-rose-500/10 text-rose-600 cursor-pointer font-medium"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Delete Chat</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* DELETE CHAT CONFIRMATION MODAL                                            */}
      {/* ========================================================================= */}
      {deleteConfirmPeer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  Delete Chat History?
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Permanently delete all messages with {deleteConfirmPeer.full_name}? This cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmPeer(null)}
                className="px-3.5 py-2 rounded-xl bg-[var(--bg-secondary)] text-[var(--text-primary)] text-xs font-bold hover:bg-[var(--bg-card)] cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteChat}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 cursor-pointer transition-colors shadow-sm"
              >
                Delete Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* NOT AVAILABLE MODAL                                                       */}
      {/* ========================================================================= */}
      {isNotAvailableModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-500" />
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  Set Not Available Schedule
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNotAvailableModalOpen(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNotAvailable} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">
                    From
                  </label>
                  <input
                    type="datetime-local"
                    value={myNotAvailableDetails.from}
                    onChange={(e) =>
                      setMyNotAvailableDetails((prev) => ({ ...prev, from: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">
                    To
                  </label>
                  <input
                    type="datetime-local"
                    value={myNotAvailableDetails.to}
                    onChange={(e) =>
                      setMyNotAvailableDetails((prev) => ({ ...prev, to: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">
                  Reason / Handover Note
                </label>
                <textarea
                  rows={3}
                  value={myNotAvailableDetails.reason}
                  onChange={(e) =>
                    setMyNotAvailableDetails((prev) => ({ ...prev, reason: e.target.value }))
                  }
                  placeholder="e.g. In plant quarterly audit meeting until 15:00"
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none resize-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNotAvailableModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[var(--bg-secondary)] text-[var(--text-primary)] font-bold hover:bg-[var(--bg-card)] transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700 transition-all cursor-pointer"
                >
                  Save Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
