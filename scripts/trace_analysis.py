"""
Helper functions for trace analysis in Jupyter notebooks.
Provides easy data loading, formatting, and annotation persistence.
"""

import os
import pandas as pd
from sqlalchemy import create_engine, text
from datetime import datetime
import json
from dotenv import load_dotenv
from IPython.display import display, Markdown


class TraceAnalyzer:
    """Main interface for working with traces in notebooks."""

    def __init__(self):
        """Connect to database using DATABASE_URL from .env.local"""
        load_dotenv('.env.local')
        db_url = os.getenv('DATABASE_URL')
        if not db_url:
            raise ValueError("DATABASE_URL not found in environment")
        # SQLAlchemy 2.0 requires 'postgresql://' instead of 'postgres://'
        if db_url.startswith('postgres://'):
            db_url = db_url.replace('postgres://', 'postgresql://', 1)
        self.engine = create_engine(db_url)
        print("✅ Connected to database")
