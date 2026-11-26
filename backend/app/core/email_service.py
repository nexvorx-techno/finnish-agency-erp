import os
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "nexvorx@gmail.com")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "xirhvtygbwwdwifv")
EMAIL_SENDER = os.getenv("EMAIL_SENDER", SMTP_USER or "nexvorx@gmail.com")
SUPPORT_INBOX = "nexvorx@gmail.com"
PORTAL_URL = "https://clientpannel-29653.web.app"


def send_email_message(to_address: str, subject: str, html_body: str, text_body: str) -> bool:
    """
    Sends an email using configured SMTP settings.
    Falls back gracefully to logging if SMTP is not configured or in sandbox.
    """
    if not to_address:
        logger.warning("[EmailService] No recipient address specified.")
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Finnish Agency ERP <{EMAIL_SENDER}>"
    msg["To"] = to_address

    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    if SMTP_USER and SMTP_PASSWORD:
        pwd_clean = SMTP_PASSWORD.replace(" ", "").strip()
        try:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
                server.starttls()
                server.login(SMTP_USER.strip(), pwd_clean)
                server.sendmail(EMAIL_SENDER.strip(), [to_address.strip()], msg.as_string())
            logger.info(f"[EmailService] Live email successfully sent to {to_address} (Subject: {subject})")
            return True
        except Exception as e:
            logger.error(f"[EmailService] SMTP transmission failed: {e}. Falling back to system log.")
    
    # Graceful fallback logging
    print("\n" + "="*70)
    print(f"📧 [EMAIL DISPATCH AUDIT] To: {to_address}")
    print(f"📌 Subject: {subject}")
    print(f"📝 Content Summary:\n{text_body}")
    print("="*70 + "\n")
    return True


def send_welcome_credentials_email(
    to_email: str,
    full_name: str,
    username: str,
    temp_password: str,
    role: str,
    company_name: str = "Corporate Client"
) -> bool:
    """
    Dispatches login credentials to newly created operational user.
    """
    subject = f"Your Login Credentials — Finnish Agency ERP ({company_name})"
    
    text_body = f"""Dear {full_name},

Your operational user account has been successfully created for {company_name} on the Finnish Agency ERP Client Portal.

Your Login Credentials:
------------------------------------------
Portal URL: {PORTAL_URL}
User ID (Login ID): {username}
Work Email ID: {to_email}
Temporary Password: {temp_password}
Job Role: {role}
------------------------------------------

Security Notice:
You will be prompted to set your personal permanent password on your first sign-in.

Best regards,
Finnish Agency ERP System
A Product of Nexvorx Technologies
"""

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; }}
        .card {{ max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }}
        .header {{ background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 28px 32px; color: #ffffff; }}
        .header h1 {{ margin: 0; font-size: 20px; font-weight: 800; }}
        .header p {{ margin: 6px 0 0 0; font-size: 13px; opacity: 0.9; }}
        .content {{ padding: 32px; color: #334155; line-height: 1.6; font-size: 14px; }}
        .box {{ background: #f1f5f9; border-radius: 12px; padding: 20px; border: 1px solid #cbd5e1; margin: 20px 0; }}
        .row {{ display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #cbd5e1; font-size: 13px; }}
        .row:last-child {{ border-bottom: none; }}
        .label {{ color: #64748b; font-weight: 600; }}
        .val {{ color: #0f172a; font-weight: 700; font-family: monospace; }}
        .btn {{ display: inline-block; background: #2563eb; color: #ffffff !important; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 13px; margin: 12px 0; }}
        .footer {{ padding: 20px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h1>Finnish Agency ERP &bull; Client Portal</h1>
          <p>Account Provisioning Confirmation &bull; {company_name}</p>
        </div>
        <div class="content">
          <p>Hello <strong>{full_name}</strong>,</p>
          <p>An operational account has been provisioned for you to access the <strong>{company_name}</strong> industrial management portal.</p>
          
          <div class="box">
            <div class="row"><span class="label">Portal URL:</span><span class="val"><a href="{PORTAL_URL}" style="color:#2563eb; text-decoration:none;">{PORTAL_URL}</a></span></div>
            <div class="row"><span class="label">User ID (Login ID):</span><span class="val" style="color:#2563eb; font-size:14px;">{username}</span></div>
            <div class="row"><span class="label">Work Email ID:</span><span class="val">{to_email}</span></div>
            <div class="row"><span class="label">Temporary Password:</span><span class="val" style="background:#fef08a; padding:2px 6px; border-radius:4px;">{temp_password}</span></div>
            <div class="row"><span class="label">Assigned Role:</span><span class="val">{role}</span></div>
          </div>

          <div style="text-align: center;">
            <a href="{PORTAL_URL}" class="btn">Sign In to Client Portal &rarr;</a>
          </div>

          <p style="font-size: 12px; color: #64748b; margin-top: 20px;">
            🔒 <em>Security notice: For statutory data compliance, you will be prompted to establish your personal permanent password upon your first login.</em>
          </p>
        </div>
        <div class="footer">
          A Product of Nexvorx Technologies &bull; Powered by Finnish Agency ERP &bull; Confidential
        </div>
      </div>
    </body>
    </html>
    """
    return send_email_message(to_email, subject, html_body, text_body)


def send_support_ticket_email(ticket: Dict[str, Any]) -> bool:
    """
    Forwards a user-submitted complaint/ticket directly to nexvorx@gmail.com.
    """
    ticket_code = ticket.get("ticket_code", "TICK-NEW")
    module_issue = ticket.get("module_issue", "General Issue")
    priority = ticket.get("priority", "MEDIUM")
    explanation = ticket.get("explanation", "")
    user_name = ticket.get("user_name", "Unknown User")
    user_id = ticket.get("user_id", "N/A")
    user_email = ticket.get("user_email", "N/A")
    user_role = ticket.get("user_role", "N/A")
    client_name = ticket.get("client_name", "Valmet Technologies Oy")
    created_at = ticket.get("created_at", "Just now")

    subject = f"[ERP Support Ticket: {ticket_code}] {module_issue} - Priority: {priority}"

    text_body = f"""ERP SUPPORT TICKET / COMPLAINT DISPATCH
------------------------------------------------------------
Ticket Code: {ticket_code}
Priority: {priority}
Module Issue: {module_issue}
Submission Time: {created_at}

User Details (Auto-fetched):
------------------------------------------------------------
Name: {user_name}
User ID: {user_id}
Email: {user_email}
Role: {user_role}
Company: {client_name}

Explanation / Issue Description:
------------------------------------------------------------
{explanation}

------------------------------------------------------------
This email was automatically forwarded to {SUPPORT_INBOX}
Finnish Agency ERP &bull; A Product of Nexvorx Technologies
"""

    badge_color = "#eab308" if priority == "MEDIUM" else "#ef4444" if priority in ["HIGH", "CRITICAL"] else "#3b82f6"

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; padding: 24px; margin: 0; }}
        .card {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; }}
        .header {{ background: #0f172a; padding: 24px 30px; color: #ffffff; }}
        .header h1 {{ margin: 0; font-size: 18px; }}
        .badge {{ display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; text-transform: uppercase; color: #ffffff; background: {badge_color}; }}
        .body {{ padding: 28px 30px; font-size: 13px; color: #334155; line-height: 1.6; }}
        .section-title {{ font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-top: 18px; margin-bottom: 6px; }}
        .box {{ background: #f1f5f9; border-radius: 10px; padding: 14px 18px; font-size: 12px; border: 1px solid #e2e8f0; }}
        .row {{ display: flex; justify-content: space-between; padding: 4px 0; }}
        .desc-box {{ background: #fdf2f8; border: 1px solid #fbcfe8; border-radius: 10px; padding: 16px; font-size: 13px; color: #831843; white-space: pre-wrap; font-family: inherit; }}
        .footer {{ padding: 16px 30px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <h1>ERP Support Complaint Ticket</h1>
            <span class="badge">{priority}</span>
          </div>
          <p style="margin:4px 0 0 0; font-size:12px; color:#94a3b8;">Ticket #{ticket_code} &bull; Module: {module_issue}</p>
        </div>
        <div class="body">
          <div class="section-title">User Information (Auto-Fetched)</div>
          <div class="box">
            <div class="row"><strong>Name:</strong> <span>{user_name}</span></div>
            <div class="row"><strong>User ID:</strong> <span>{user_id}</span></div>
            <div class="row"><strong>Email:</strong> <span>{user_email}</span></div>
            <div class="row"><strong>Role:</strong> <span>{user_role}</span></div>
            <div class="row"><strong>Client Company:</strong> <span>{client_name}</span></div>
            <div class="row"><strong>Submitted At:</strong> <span>{created_at}</span></div>
          </div>

          <div class="section-title">Complaint / Issue Explanation</div>
          <div class="desc-box">{explanation}</div>
        </div>
        <div class="footer">
          Forwarded automatically to <strong>{SUPPORT_INBOX}</strong><br>
          <a href="{PORTAL_URL}/?resolve_ticket={ticket_code}" style="display:inline-block; margin-top:8px; padding:6px 14px; background:#2563eb; color:#ffffff; text-decoration:none; border-radius:6px; font-weight:bold; font-size:11px;">View & Resolve in ERP Portal</a><br><br>
          A Product of Nexvorx Technologies &bull; Trademark
        </div>
      </div>
    </body>
    </html>
    """

    return send_email_message(SUPPORT_INBOX, subject, html_body, text_body)


def send_ticket_resolved_email(ticket: Dict[str, Any]) -> bool:
    """
    Sends an automated notification to the user who raised the ticket informing them
    that their issue has been successfully resolved.
    """
    to_email = ticket.get("user_email")
    if not to_email:
        return False

    user_name = ticket.get("user_name", "Valued User")
    ticket_code = ticket.get("ticket_code", "TICK-NEW")
    module_issue = ticket.get("module_issue", "ERP Issue")
    explanation = ticket.get("explanation", "")
    resolution_notes = ticket.get("resolution_notes", "The reported issue has been diagnosed and resolved by the Nexvorx engineering desk.")
    resolved_by = ticket.get("resolved_by", "Nexvorx Engineering Support")
    resolved_at = ticket.get("resolved_at", "Just now")
    client_name = ticket.get("client_name", "Valmet Technologies Oy")

    subject = f"✅ [Resolved] Support Ticket #{ticket_code} — {module_issue}"

    text_body = f"""Dear {user_name},

Your support ticket #{ticket_code} regarding '{module_issue}' has been marked as RESOLVED.

------------------------------------------------------------
TICKET RESOLUTION DETAILS:
------------------------------------------------------------
Ticket Code: {ticket_code}
Module: {module_issue}
Client Organization: {client_name}
Resolved At: {resolved_at}
Resolved By: {resolved_by}

Your Original Complaint / Description:
{explanation}

Resolution / Action Taken by Engineering:
{resolution_notes}
------------------------------------------------------------

You can also view the updated status and history directly inside your Client Portal.

Best regards,
Nexvorx Technologies Support Desk
Finnish Agency ERP
"""

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; padding: 24px; margin: 0; }}
        .card {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }}
        .header {{ background: linear-gradient(135deg, #059669, #047857); padding: 26px 30px; color: #ffffff; }}
        .header h1 {{ margin: 0; font-size: 19px; font-weight: 800; }}
        .badge {{ display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; text-transform: uppercase; color: #047857; background: #d1fae5; }}
        .body {{ padding: 28px 30px; font-size: 13px; color: #334155; line-height: 1.6; }}
        .section-title {{ font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-top: 18px; margin-bottom: 6px; }}
        .box {{ background: #f8fafc; border-radius: 10px; padding: 14px 18px; font-size: 12px; border: 1px solid #e2e8f0; }}
        .row {{ display: flex; justify-content: space-between; padding: 4px 0; }}
        .solution-box {{ background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 16px; font-size: 13px; color: #065f46; white-space: pre-wrap; font-weight: 500; }}
        .orig-box {{ background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; font-size: 12px; color: #64748b; }}
        .footer {{ padding: 18px 30px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <h1>Issue Resolved</h1>
            <span class="badge">RESOLVED</span>
          </div>
          <p style="margin:6px 0 0 0; font-size:12px; opacity:0.9;">Ticket #{ticket_code} &bull; {module_issue}</p>
        </div>
        <div class="body">
          <p style="margin-top:0;">Dear <strong>{user_name}</strong>,</p>
          <p>Your support ticket regarding <strong>{module_issue}</strong> has been successfully reviewed, addressed, and marked as <strong>Resolved</strong> by our engineering team.</p>

          <div class="section-title">Resolution & Fix Notes</div>
          <div class="solution-box">{resolution_notes}</div>

          <div class="section-title">Ticket Information</div>
          <div class="box">
            <div class="row"><strong>Ticket ID:</strong> <span>{ticket_code}</span></div>
            <div class="row"><strong>Organization:</strong> <span>{client_name}</span></div>
            <div class="row"><strong>Resolved By:</strong> <span>{resolved_by}</span></div>
            <div class="row"><strong>Resolved At:</strong> <span>{resolved_at}</span></div>
          </div>

          <div class="section-title">Original Issue Description</div>
          <div class="orig-box">{explanation}</div>
        </div>
        <div class="footer">
          Finnish Agency ERP &bull; A Product of <strong>Nexvorx Technologies</strong> (Trademark)<br>
          If your issue is not fully addressed, you may submit a follow-up ticket in the portal.
        </div>
      </div>
    </body>
    </html>
    """

    return send_email_message(to_email, subject, html_body, text_body)
