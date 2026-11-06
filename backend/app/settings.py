import os
import secrets

APP_ENV = os.getenv("APP_ENV", "development")
PRODUCTION = APP_ENV == "production"
PUBLIC_URL = os.getenv("PUBLIC_URL", "http://localhost:3000").rstrip("/")
SEED_DEMO = os.getenv("SEED_DEMO", "0" if PRODUCTION else "1") == "1"
CERT_VALID_DAYS = int(os.getenv("CERT_VALID_DAYS", "365"))
REQUIRE_STAFF_2FA = os.getenv("REQUIRE_STAFF_2FA", "0") == "1"

# Payments: "mock" (OTP demo, dev only) or "mpesa" (Daraja STK push; sandbox or live by MPESA_ENV)
PAYMENT_PROVIDER = os.getenv("PAYMENT_PROVIDER", "mock")
MPESA_ENV = os.getenv("MPESA_ENV", "sandbox")  # sandbox | production
MPESA_CONSUMER_KEY = os.getenv("MPESA_CONSUMER_KEY", "")
MPESA_CONSUMER_SECRET = os.getenv("MPESA_CONSUMER_SECRET", "")
MPESA_SHORTCODE = os.getenv("MPESA_SHORTCODE", "174379")  # Daraja sandbox default
MPESA_PASSKEY = os.getenv("MPESA_PASSKEY", "")  # from the Daraja portal "Test credentials" page
MPESA_TXN_TYPE = os.getenv("MPESA_TXN_TYPE", "CustomerPayBillOnline")
MPESA_CALLBACK_SECRET = os.getenv("MPESA_CALLBACK_SECRET") or secrets.token_urlsafe(24)
MPESA_BASE = "https://sandbox.safaricom.co.ke" if MPESA_ENV == "sandbox" else "https://api.safaricom.co.ke"
MPESA_READY = PAYMENT_PROVIDER == "mpesa" and all([MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_PASSKEY])
# Simulated payment: no money moves. On by default in production until M-Pesa is live (SIMULATE_PAYMENTS=0 turns it off).
SIMULATE_PAYMENTS = (not MPESA_READY) and os.getenv("SIMULATE_PAYMENTS", "1" if PRODUCTION else "0") == "1"

# Optional reader for scanned paper records (free, self-hosted). Without a key the import screen works by hand.
OCR_URL = os.getenv("OCR_URL", "https://ocr.oqtekal.com").rstrip("/")
OCR_API_KEY = os.getenv("OCR_API_KEY", "")
# TESTING ONLY: lets an administrator delete a paper record completely, including the registration it created, so the same
# document can be imported again. Leave off (0) in live production.
ALLOW_IMPORT_TEST_DELETE = os.getenv("ALLOW_IMPORT_TEST_DELETE", "0") == "1"
# the reader's document type ids for our two paper forms (created once in the reader's admin); they pick which fields it extracts
OCR_TYPE_PLAYER = os.getenv("OCR_TYPE_PLAYER", "")
OCR_TYPE_CLUB = os.getenv("OCR_TYPE_CLUB", "")

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", "no-reply@sports.go.ke")
