from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class InternalChatMessage(Base):
    __tablename__ = "internal_chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("client_companies.id"), nullable=False, index=True)
    portal_type = Column(String(50), nullable=False, default="CLIENT", index=True)
    # Channel type: "GENERAL" (team plant channel) or "DIRECT" (1-on-1 private message)
    channel_type = Column(String(20), nullable=False, default="GENERAL", index=True)
    
    sender_id = Column(Integer, ForeignKey("client_users.id"), nullable=False, index=True)
    sender_name = Column(String(255), nullable=False)
    sender_role = Column(String(100), nullable=False)
    
    recipient_id = Column(Integer, ForeignKey("client_users.id"), nullable=True, index=True)
    recipient_name = Column(String(255), nullable=True)
    
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    is_delivered = Column(Boolean, default=False, index=True)
    is_read = Column(Boolean, default=False, index=True)

    # Relationships
    company = relationship("ClientCompany")
    sender = relationship("ClientUser", foreign_keys=[sender_id])
    recipient = relationship("ClientUser", foreign_keys=[recipient_id])
