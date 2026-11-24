from datetime import datetime, timedelta
from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func

from app.core.database import get_db
from app.models.client import ClientUser
from app.models.chat import InternalChatMessage

router = APIRouter(prefix="/api/client", tags=["Internal Portal Chat"])


# ---------------- SCHEMAS ----------------
class SendMessageRequest(BaseModel):
    channel_type: str = "GENERAL"  # GENERAL or DIRECT
    sender_id: int
    sender_name: str
    sender_role: str
    recipient_id: Optional[int] = None
    content: str


class UpdateAvailabilityRequest(BaseModel):
    user_id: int
    availability_status: str  # ONLINE, LUNCH, OFF_DUTY, BREAK, OUTSIDE, NOT_AVAILABLE
    not_available_from: Optional[str] = None
    not_available_to: Optional[str] = None
    not_available_reason: Optional[str] = None


class UpdateDisappearingSettingRequest(BaseModel):
    user_id: int
    ttl: str  # OFF, 24H, 7D, 30D


class TypingStatusRequest(BaseModel):
    sender_id: int
    recipient_id: int
    is_typing: bool


class MarkReadRequest(BaseModel):
    user_id: int
    peer_id: int
    is_read: bool = True


# Active typing tracking: key=(sender_id, recipient_id), value=datetime
typing_sessions = {}


def purge_expired_messages(client_id: int, ttl: str, db: Session):
    """
    Enforces strict privacy and auto-disappearing chat policy.
    Purges messages older than the configured TTL.
    """
    if ttl == "OFF" or not ttl:
        return
    now = datetime.utcnow()
    cutoff = None
    if ttl == "24H":
        cutoff = now - timedelta(hours=24)
    elif ttl == "7D":
        cutoff = now - timedelta(days=7)
    elif ttl == "30D":
        cutoff = now - timedelta(days=30)

    if cutoff:
        db.query(InternalChatMessage).filter(
            InternalChatMessage.client_id == client_id,
            InternalChatMessage.portal_type == "CLIENT",
            InternalChatMessage.created_at < cutoff,
        ).delete(synchronize_session=False)
        db.commit()


def serialize_message(m: InternalChatMessage):
    return {
        "id": m.id,
        "client_id": m.client_id,
        "portal_type": m.portal_type,
        "channel_type": m.channel_type,
        "sender_id": m.sender_id,
        "sender_name": m.sender_name,
        "sender_role": m.sender_role,
        "recipient_id": m.recipient_id,
        "recipient_name": m.recipient_name,
        "content": m.content,
        "created_at": m.created_at.isoformat() if m.created_at else None,
        "time_str": m.created_at.strftime("%H:%M") if m.created_at else "",
        "date_str": m.created_at.strftime("%d %b") if m.created_at else "",
        "is_delivered": bool(getattr(m, "is_delivered", False)),
        "is_read": bool(m.is_read),
    }


# ---------------- ENDPOINTS ----------------
@router.get("/{client_id}/chat/users")
def get_internal_chat_users(
    client_id: int,
    current_user_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """
    STRICT PORTAL PRIVACY:
    Returns ONLY real users belonging to this client company.
    Completely excludes Agency and Candidate/Employee users. Zero dummy users generated.
    """
    now = datetime.utcnow()
    unread_counts_map = {}
    last_msg_map = {}

    if current_user_id:
        # Heartbeat: record active timestamp and deliver pending messages FIRST
        db.query(ClientUser).filter(ClientUser.id == current_user_id).update(
            {"last_seen_at": now}, synchronize_session=False
        )
        # Any messages pending for current_user_id are now delivered (double grey tick)
        db.query(InternalChatMessage).filter(
            InternalChatMessage.client_id == client_id,
            InternalChatMessage.portal_type == "CLIENT",
            InternalChatMessage.channel_type == "DIRECT",
            InternalChatMessage.recipient_id == current_user_id,
            InternalChatMessage.is_delivered == False,
        ).update({"is_delivered": True}, synchronize_session=False)
        db.commit()

        counts = (
            db.query(InternalChatMessage.sender_id, func.count(InternalChatMessage.id))
            .filter(
                InternalChatMessage.client_id == client_id,
                InternalChatMessage.portal_type == "CLIENT",
                InternalChatMessage.channel_type == "DIRECT",
                InternalChatMessage.recipient_id == current_user_id,
                InternalChatMessage.is_read == False,
            )
            .group_by(InternalChatMessage.sender_id)
            .all()
        )
        unread_counts_map = {sender_id: count for sender_id, count in counts}

        # Fetch recent messages involving current_user_id in a single fast query
        recent_msgs = (
            db.query(InternalChatMessage)
            .filter(
                InternalChatMessage.client_id == client_id,
                InternalChatMessage.portal_type == "CLIENT",
                InternalChatMessage.channel_type == "DIRECT",
                or_(
                    InternalChatMessage.sender_id == current_user_id,
                    InternalChatMessage.recipient_id == current_user_id,
                ),
            )
            .order_by(InternalChatMessage.id.desc())
            .limit(25)
            .all()
        )
        for m in recent_msgs:
            peer_key = m.recipient_id if m.sender_id == current_user_id else m.sender_id
            if peer_key and peer_key not in last_msg_map:
                last_msg_map[peer_key] = {
                    "content": m.content[:35],
                    "time_str": m.created_at.strftime("%H:%M") if m.created_at else "",
                    "created_at": m.created_at.isoformat() if m.created_at else None,
                }

    # Query fresh user records after heartbeat update
    users = (
        db.query(ClientUser)
        .filter(ClientUser.client_id == client_id)
        .order_by(ClientUser.id.asc())
        .all()
    )

    # Get current user's disappearing TTL
    current_user = next((u for u in users if current_user_id and u.id == current_user_id), None)
    active_ttl = current_user.disappearing_messages_ttl if current_user and current_user.disappearing_messages_ttl else "OFF"

    # Enforce auto-disappearing purge if active
    if active_ttl != "OFF":
        purge_expired_messages(client_id, active_ttl, db)

    result = []
    for u in users:
        unread_count = unread_counts_map.get(u.id, 0)
        last_msg = last_msg_map.get(u.id)

        # WhatsApp Theory Presence:
        # A user is ONLINE if:
        # 1. is_active == True
        # 2. availability_status != "OFFLINE"
        # 3. User is current caller OR last_seen_at was recorded within the last 25 seconds
        raw_status = (getattr(u, "availability_status", "OFFLINE") or "OFFLINE").upper()
        last_seen = getattr(u, "last_seen_at", None)
        is_stale = (u.id != current_user_id) and (last_seen is None or (now - last_seen).total_seconds() > 25)
        effective_status = "OFFLINE" if (not u.is_active or raw_status == "OFFLINE" or is_stale) else raw_status

        last_seen_str = ""
        last_seen_iso = None
        if last_seen:
            last_seen_iso = last_seen.isoformat() + "Z"
            if last_seen.date() == now.date():
                last_seen_str = f"today at {last_seen.strftime('%H:%M')}"
            elif last_seen.date() == (now - timedelta(days=1)).date():
                last_seen_str = f"yesterday at {last_seen.strftime('%H:%M')}"
            else:
                last_seen_str = last_seen.strftime("%d %b, %H:%M")

        result.append(
            {
                "id": u.id,
                "full_name": u.full_name,
                "role": u.role,
                "email": u.email,
                "avatar_url": getattr(u, "avatar_url", None),
                "is_active": u.is_active,
                "assigned_site_ids": u.assigned_site_ids or "*",
                "availability_status": effective_status,
                "last_seen_at": last_seen_iso,
                "last_seen_str": last_seen_str,
                "not_available_from": getattr(u, "not_available_from", None),
                "not_available_to": getattr(u, "not_available_to", None),
                "not_available_reason": getattr(u, "not_available_reason", None),
                "disappearing_messages_ttl": getattr(u, "disappearing_messages_ttl", "OFF") or "OFF",
                "unread_count": unread_count,
                "last_message": last_msg,
            }
        )

    return {
        "client_id": client_id,
        "portal": "CLIENT",
        "users": result,
        "disappearing_ttl": active_ttl,
        "general_total_messages": 0,
    }


@router.patch("/{client_id}/chat/availability")
def update_user_availability(
    client_id: int,
    payload: UpdateAvailabilityRequest,
    db: Session = Depends(get_db),
):
    user = (
        db.query(ClientUser)
        .filter(ClientUser.id == payload.user_id, ClientUser.client_id == client_id)
        .first()
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.availability_status = payload.availability_status.strip().upper()
    user.last_seen_at = datetime.utcnow()
    if payload.availability_status.strip().upper() == "NOT_AVAILABLE":
        user.not_available_from = payload.not_available_from
        user.not_available_to = payload.not_available_to
        user.not_available_reason = payload.not_available_reason
    else:
        user.not_available_from = None
        user.not_available_to = None
        user.not_available_reason = None

    db.commit()
    db.refresh(user)
    return {
        "status": "UPDATED",
        "user_id": user.id,
        "availability_status": user.availability_status,
        "not_available_from": user.not_available_from,
        "not_available_to": user.not_available_to,
        "not_available_reason": user.not_available_reason,
    }


@router.patch("/{client_id}/chat/disappearing-setting")
def update_disappearing_setting(
    client_id: int,
    payload: UpdateDisappearingSettingRequest,
    db: Session = Depends(get_db),
):
    user = (
        db.query(ClientUser)
        .filter(ClientUser.id == payload.user_id, ClientUser.client_id == client_id)
        .first()
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    ttl = payload.ttl.strip().upper()
    if ttl not in ("OFF", "24H", "7D", "30D"):
        raise HTTPException(status_code=400, detail="Invalid TTL. Allowed: OFF, 24H, 7D, 30D")

    user.disappearing_messages_ttl = ttl
    db.commit()
    db.refresh(user)

    if ttl != "OFF":
        purge_expired_messages(client_id, ttl, db)

    return {"status": "UPDATED", "user_id": user.id, "disappearing_ttl": ttl}


@router.post("/{client_id}/chat/typing")
def set_typing_status(
    client_id: int,
    payload: TypingStatusRequest,
):
    key = (payload.sender_id, payload.recipient_id)
    if payload.is_typing:
        typing_sessions[key] = datetime.utcnow()
    else:
        typing_sessions.pop(key, None)
    return {"status": "OK"}


@router.get("/{client_id}/chat/messages")
def get_internal_chat_messages(
    client_id: int,
    channel_type: str = Query("GENERAL"),
    user_id: Optional[int] = Query(None),
    peer_id: Optional[int] = Query(None),
    limit: int = Query(60),
    db: Session = Depends(get_db),
):
    """
    STRICT PORTAL SCOPE:
    Fetches message thread for either the Plant General channel or 1-on-1 Direct Chat between internal client users.
    """
    query = db.query(InternalChatMessage).filter(
        InternalChatMessage.client_id == client_id,
        InternalChatMessage.portal_type == "CLIENT",
        InternalChatMessage.channel_type == channel_type,
    )

    is_peer_typing = False
    if channel_type == "DIRECT":
        if not user_id or not peer_id:
            raise HTTPException(status_code=400, detail="user_id and peer_id required for DIRECT chat")
        query = query.filter(
            or_(
                and_(
                    InternalChatMessage.sender_id == user_id,
                    InternalChatMessage.recipient_id == peer_id,
                ),
                and_(
                    InternalChatMessage.sender_id == peer_id,
                    InternalChatMessage.recipient_id == user_id,
                ),
            )
        )
        # Check typing status
        peer_typing_time = typing_sessions.get((peer_id, user_id))
        if peer_typing_time and (datetime.utcnow() - peer_typing_time).total_seconds() < 4.0:
            is_peer_typing = True

    messages = query.order_by(InternalChatMessage.id.asc()).limit(limit).all()

    # Mark unread messages delivered & read in a single quick update
    if channel_type == "DIRECT" and user_id and peer_id:
        unread_ids = [m.id for m in messages if m.recipient_id == user_id and (not m.is_read or not m.is_delivered)]
        if unread_ids:
            db.query(InternalChatMessage).filter(InternalChatMessage.id.in_(unread_ids)).update(
                {"is_read": True, "is_delivered": True}, synchronize_session=False
            )
            db.commit()
            for m in messages:
                if m.id in unread_ids:
                    m.is_read = True
                    m.is_delivered = True

    return {
        "client_id": client_id,
        "portal": "CLIENT",
        "channel_type": channel_type,
        "messages": [serialize_message(m) for m in messages],
        "is_peer_typing": is_peer_typing,
    }


@router.post("/{client_id}/chat/messages")
def send_internal_chat_message(
    client_id: int,
    payload: SendMessageRequest,
    db: Session = Depends(get_db),
):
    """
    Sends an internal portal message. Strictly verifies client scoping.
    """
    sender = (
        db.query(ClientUser)
        .filter(ClientUser.id == payload.sender_id, ClientUser.client_id == client_id)
        .first()
    )
    if not sender:
        raise HTTPException(status_code=403, detail="Sender does not belong to this client organization.")

    recipient_name = None
    if payload.channel_type == "DIRECT":
        if not payload.recipient_id:
            raise HTTPException(status_code=400, detail="recipient_id required for DIRECT chat")
        recipient = (
            db.query(ClientUser)
            .filter(ClientUser.id == payload.recipient_id, ClientUser.client_id == client_id)
            .first()
        )
        if not recipient:
            raise HTTPException(status_code=404, detail="Recipient not found in this client organization.")
        recipient_name = recipient.full_name
        # Clear typing on message send
        typing_sessions.pop((payload.sender_id, payload.recipient_id), None)

    # WhatsApp theory: if recipient is active and online right now, message is immediately delivered (double tick)
    is_delivered = False
    if payload.channel_type == "DIRECT" and recipient:
        now = datetime.utcnow()
        rec_status = (getattr(recipient, "availability_status", "OFFLINE") or "OFFLINE").upper()
        rec_last_seen = getattr(recipient, "last_seen_at", None)
        if recipient.is_active and rec_status != "OFFLINE" and rec_last_seen and (now - rec_last_seen).total_seconds() < 25:
            is_delivered = True

    new_msg = InternalChatMessage(
        client_id=client_id,
        portal_type="CLIENT",
        channel_type=payload.channel_type,
        sender_id=sender.id,
        sender_name=sender.full_name,
        sender_role=payload.sender_role or sender.role,
        recipient_id=payload.recipient_id,
        recipient_name=recipient_name,
        content=payload.content.strip(),
        created_at=datetime.utcnow(),
        is_delivered=is_delivered,
        is_read=False,
    )
    db.add(new_msg)
    db.commit()
    db.refresh(new_msg)

    return serialize_message(new_msg)


@router.post("/{client_id}/chat/mark-read")
def mark_chat_read(
    client_id: int,
    payload: MarkReadRequest,
    db: Session = Depends(get_db),
):
    """
    Marks direct messages between user_id and peer_id as read or unread.
    """
    if payload.is_read:
        db.query(InternalChatMessage).filter(
            InternalChatMessage.client_id == client_id,
            InternalChatMessage.portal_type == "CLIENT",
            InternalChatMessage.channel_type == "DIRECT",
            InternalChatMessage.recipient_id == payload.user_id,
            InternalChatMessage.sender_id == payload.peer_id,
            InternalChatMessage.is_read == False,
        ).update({"is_read": True, "is_delivered": True}, synchronize_session=False)
    else:
        latest = (
            db.query(InternalChatMessage)
            .filter(
                InternalChatMessage.client_id == client_id,
                InternalChatMessage.portal_type == "CLIENT",
                InternalChatMessage.channel_type == "DIRECT",
                InternalChatMessage.recipient_id == payload.user_id,
                InternalChatMessage.sender_id == payload.peer_id,
            )
            .order_by(InternalChatMessage.id.desc())
            .first()
        )
        if latest:
            latest.is_read = False
    db.commit()
    return {"status": "SUCCESS", "is_read": payload.is_read}


@router.delete("/{client_id}/chat/messages")
def delete_chat_history(
    client_id: int,
    user_id: int = Query(...),
    peer_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """
    Deletes entire direct conversation thread between user_id and peer_id.
    """
    deleted_count = (
        db.query(InternalChatMessage)
        .filter(
            InternalChatMessage.client_id == client_id,
            InternalChatMessage.portal_type == "CLIENT",
            InternalChatMessage.channel_type == "DIRECT",
            or_(
                and_(
                    InternalChatMessage.sender_id == user_id,
                    InternalChatMessage.recipient_id == peer_id,
                ),
                and_(
                    InternalChatMessage.sender_id == peer_id,
                    InternalChatMessage.recipient_id == user_id,
                ),
            ),
        )
        .delete(synchronize_session=False)
    )
    db.commit()
    return {"status": "DELETED", "deleted_count": deleted_count}
