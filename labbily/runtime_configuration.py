"""Encrypted provider-owned settings; secrets are never returned by administration APIs."""
import os
from .db import one, postgres, transaction, path

def value(key,default=''):
    # Independent SQLite reader permits use inside the service's write transaction.
    previous = 'WASLA_' + key[8:] if key.startswith('LABBILY_') else key
    query = 'SELECT ciphertext FROM provider_configuration WHERE key IN (?,?) ORDER BY CASE WHEN key=? THEN 0 ELSE 1 END LIMIT 1'
    if postgres():
        with transaction() as db:r=one(db,query,(key,previous,key))
    else:
        import sqlite3
        with sqlite3.connect(path()) as db:
            db.row_factory=sqlite3.Row
            r=one(db,query,(key,previous,key))
    if r:
        from .service_oauth import cipher
        from cryptography.fernet import InvalidToken
        from fastapi import HTTPException
        try:return cipher().decrypt(r['ciphertext'].encode()).decode()
        except InvalidToken:raise HTTPException(503,'configuration_decryption_failed')
    return os.getenv(key,default)
