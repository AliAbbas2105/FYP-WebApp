import asyncio
import logging
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr

import httpx
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").strip()
SMTP_USE_SSL = os.getenv("SMTP_USE_SSL", "").lower() in ("1", "true", "yes")
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "Gastric Cancer FL").strip()

# Resend HTTPS API — works on Render free tier (SMTP 25/465/587 often blocked).
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "").strip()
RESEND_FROM = os.getenv(
    "RESEND_FROM",
    "Gastric Cancer FL <onboarding@resend.dev>",
).strip()

# Demo / FYP deployment: skip email and mark user verified at signup (no third-party email).
def is_auto_verify_signup() -> bool:
    return os.getenv("AUTO_VERIFY_EMAIL", "").lower() in ("1", "true", "yes")


def is_smtp_configured() -> bool:
    return bool(SMTP_USER and SMTP_PASSWORD)


def is_resend_configured() -> bool:
    return bool(RESEND_API_KEY)


def is_email_delivery_configured() -> bool:
    """True if we can attempt to send (Resend or SMTP)."""
    return is_resend_configured() or is_smtp_configured()


def _verification_link_base() -> str:
    explicit = os.getenv("EMAIL_VERIFICATION_BASE_URL", "").strip().rstrip("/")
    if explicit:
        return explicit
    fe = os.getenv("FRONTEND_URL", "").strip()
    if fe:
        return fe.split(",")[0].strip().rstrip("/")
    return "https://gastricfrontend.vercel.app"


def _build_verification_bodies(username: str, verification_link: str) -> tuple[str, str, str]:
    subject = "Verify your email — Gastric Cancer FL"
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
    return subject, plain, html


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


async def _send_via_resend(to_email: str, subject: str, html: str, plain: str) -> bool:
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": RESEND_FROM,
                    "to": [to_email],
                    "subject": subject,
                    "html": html,
                    "text": plain,
                },
            )
        if resp.status_code >= 400:
            logger.error(
                "Resend API error %s: %s",
                resp.status_code,
                resp.text[:500],
            )
            return False
        return True
    except Exception:
        logger.exception("Resend request failed for %s", to_email)
        return False


async def send_verification_email(email: str, token: str, username: str) -> bool:
    """
    Send verification email: Resend first (HTTPS), then SMTP if configured.
    Render free tier often blocks SMTP; use RESEND_API_KEY for mail there.
    """
    base = _verification_link_base()
    verification_link = f"{base}/verify-email?token={token}"
    subject, plain, html = _build_verification_bodies(username, verification_link)

    if is_resend_configured():
        ok = await _send_via_resend(email, subject, html, plain)
        if ok:
            logger.info("Verification email sent via Resend to %s", email)
        else:
            logger.error("Resend did not accept email for %s. Link: %s", email, verification_link)
        return ok

    if not is_smtp_configured():
        logger.warning(
            "No RESEND_API_KEY and no SMTP — verification email not sent. Link: %s",
            verification_link,
        )
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = formataddr((SMTP_FROM_NAME, SMTP_USER))
    msg["To"] = email
    msg["Reply-To"] = SMTP_USER
    msg.attach(MIMEText(plain, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))

    try:
        await asyncio.to_thread(_send_smtp, msg)
        logger.info("Verification email sent via SMTP to %s", email)
        return True
    except OSError as e:
        errno = getattr(e, "errno", None)
        if errno == 101 or "Network is unreachable" in str(e):
            logger.error(
                "SMTP failed: network unreachable (common on Render Free). "
                "Set RESEND_API_KEY, or AUTO_VERIFY_EMAIL=true for demo, or use paid Render. Link: %s",
                verification_link,
            )
        else:
            logger.exception(
                "SMTP failed for %s. Link was: %s",
                email,
                verification_link,
            )
        return False
    except Exception:
        logger.exception(
            "SMTP failed for %s — check SMTP_* / Gmail App Password. Link: %s",
            email,
            verification_link,
        )
        return False
