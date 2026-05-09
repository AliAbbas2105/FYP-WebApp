import asyncio
import logging
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").strip()
SMTP_USE_SSL = os.getenv("SMTP_USE_SSL", "").lower() in ("1", "true", "yes")
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "Gastric Cancer FL").strip()


def is_smtp_configured() -> bool:
    return bool(SMTP_USER and SMTP_PASSWORD)


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
    return "https://gastricfrontend.vercel.app"


def _send_smtp(msg: MIMEMultipart) -> None:
    timeout = 25
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

    if not is_smtp_configured():
        logger.warning(
            "SMTP_USER or SMTP_PASSWORD not set — verification email was NOT sent. "
            "Set both in Render (Gmail: use an App Password). Link: %s",
            verification_link,
        )
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Verify your email — Gastric Cancer FL"
    msg["From"] = formataddr((SMTP_FROM_NAME, SMTP_USER))
    msg["To"] = email
    msg["Reply-To"] = SMTP_USER

    plain = (
        f"Welcome to Gastric Cancer FL, {username}.\n\n"
        f"Verify your email by opening this link in your browser:\n{verification_link}\n\n"
        f"This link expires in 24 hours.\n"
        f"If you did not sign up, ignore this message.\n"
    )
    html = f"""
    <html><body>
        <h2>Welcome to Gastric Cancer FL, {username}!</h2>
        <p>Please verify your email by clicking the button below:</p>
        <p><a href="{verification_link}" style="background-color:#2563eb;color:#fff;padding:10px 20px;
        text-decoration:none;border-radius:6px;display:inline-block;">Verify email</a></p>
        <p>Or paste this link into your browser:</p>
        <p style="word-break:break-all;">{verification_link}</p>
        <p><small>This link expires in 24 hours. If you did not sign up, ignore this email.</small></p>
    </body></html>
    """

    msg.attach(MIMEText(plain, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))

    try:
        await asyncio.to_thread(_send_smtp, msg)
        logger.info("Verification email sent to %s", email)
        return True
    except Exception:
        logger.exception(
            "SMTP failed for %s — check Render env SMTP_* and Gmail App Password. Link was: %s",
            email,
            verification_link,
        )
        return False
