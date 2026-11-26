"""Labbily sales operations, version 1.0.0."""

import os

# Existing deployments keep their credentials until their hosting settings are migrated.
for previous_key, setting in tuple(os.environ.items()):
    if previous_key.startswith('WASLA_'):
        os.environ.setdefault('LABBILY_' + previous_key[6:], setting)