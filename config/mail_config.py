import os

class Config:
    MAIL_SERVER = os.environ["TERMIC_MAIL_SERVER"]
    MAIL_PORT = os.environ["TERMIC_MAIL_PORT"]
    MAIL_USERNAME = os.environ["TERMIC_MAIL_USERNAME"]
    MAIL_PASSWORD = os.environ["TERMIC_MAIL_PASSWORD"]
    MAIL_USE_TLS = False
    MAIL_USE_SSL = True