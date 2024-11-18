import os


class Config:
    MAIL_SERVER = os.getenv("TERMIC_MAIL_SERVER", None)
    MAIL_PORT = os.getenv("TERMIC_MAIL_PORT", None)
    MAIL_USERNAME = os.getenv("TERMIC_MAIL_USERNAME", None)
    MAIL_PASSWORD = os.getenv("TERMIC_MAIL_PASSWORD", None)
    MAIL_USE_TLS = False
    MAIL_USE_SSL = True

    MAIL_SENDER = os.getenv("TERMIC_MAIL_SENDER", None)
    MAIL_RECIPIENTS = os.getenv("TERMIC_MAIL_RECIPIENTS", None)
