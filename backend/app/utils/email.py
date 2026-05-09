import asyncio
import logging
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").strip()
SMTP_USE_SSL = os.getenv("SMTP_USE_SSL", "").lower() in ("1", "true", "yes")


def _verification_link_base() -> str:
    """
    Base URL for links in verification emails (no trailing slash).
    Use EMAIL_VERIFICATION_BASE_URL if FRONTEND_URL is a comma-separated CORS list.
    """
    explicit = os.getenv("EMAIL_VERIFICATION_BASE_URL", "").strip().rstrip("/")
    if explicit:
        return explicit
    fe = os.getenv("FRONTEND_URL", "").strip()
    if fe:
        return fe.split(",")[0].strip().rstrip("/")
    # Deployed SPA default for this project (override with FRONTEND_URL on Render)
    return "https://gastricfrontend.vercel.app"


def _send_smtp(msg: MIMEMultipart) -> None:
    timeout = 30
    use_ssl = SMTP_USE_SSL or SMTP_PORT == 465
    if use_ssl:
        server = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=timeout)
    else:
        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=timeout)
        server.starttls()
    try:
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.send_message(msg)
    finally:
        try:
            server.quit()
        except Exception:
            pass


async def send_verification_email(email: str, token: str, username: str) -> bool:
    """Send email verification link. Returns True if SMTP accepted the message."""
    base = _verification_link_base()
    verification_link = f"{base}/verify-email?token={token}"

    if not SMTP_USER or not SMTP_PASSWORD:
        logger.warning(
            "SMTP_USER or SMTP_PASSWORD not set — verification email was NOT sent. "
            "Set both in Render (Gmail: use an App Password). Link for manual testing: %s",
            verification_link,
        )
        return False

    msg = MIMEMultipart()
    msg["From"] = SMTP_USER
    msg["To"] = email
    msg["Subject"] = "Verify Your Email - Gastric Cancer FL"

    body = f"""
    <html>
    <body>
        <h2>Welcome to Gastric Cancer FL, {username}!</h2>
        <p>Thank you for signing up. Please verify your email address by clicking the link below:</p>
        <p><a href="{verification_link}" style="background-color: #5bd0ff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Email</a></p>
        <p>Or copy and paste this link into your browser:</p>
        <p>{verification_link}</p>
        <p>This link will expire in 24 hours.</p>
        <p>If you didn't create an account, please ignore this email.</p>
    </body>
    </html>
    """

    msg.attach(MIMEText(body, "html"))

    try:
        await asyncio.to_thread(_send_smtp, msg)
        logger.info("Verification email sent to %s", email)
        return True
    except Exception:
        logger.exception(
            "Failed to send verification email to %s (check SMTP_*, Gmail App Password, firewall). "
            "Intended link: %s",
            email,
            verification_link,
        )
        return False
