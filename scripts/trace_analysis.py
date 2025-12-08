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

    def load_traces(self, limit=50, filters=None):
        """
        Load traces with full conversation context.

        Args:
            limit: Max traces to load (default 50)
            filters: Dict like {'selectedLens': 'A', 'userFeedback': 'not_helpful'}

        Returns:
            DataFrame with trace and conversation data
        """
        query = """
        SELECT
            t.id,
            t."conversationId",
            t."userId",
            t.timestamp,
            t."extractedContext",
            t.output,
            t."claudeThoughts",
            t."openCodingNotes",
            t."errorCategories",
            t."reviewedAt",
            t."userFeedback",
            c."selectedLens",
            c."questionCount",
            c."currentPhase",
            c.status,
            json_agg(
                json_build_object(
                    'role', m.role,
                    'content', m.content,
                    'stepNumber', m."stepNumber",
                    'confidenceScore', m."confidenceScore",
                    'annotations', m.annotations
                ) ORDER BY m."stepNumber"
            ) as messages
        FROM "Trace" t
        JOIN "Conversation" c ON t."conversationId" = c.id
        LEFT JOIN "Message" m ON m."conversationId" = c.id
        WHERE 1=1
        """

        params = {}
        if filters:
            if 'selectedLens' in filters:
                query += ' AND c."selectedLens" = :lens'
                params['lens'] = filters['selectedLens']
            if 'userFeedback' in filters:
                query += ' AND t."userFeedback" = :feedback'
                params['feedback'] = filters['userFeedback']
            if 'hasNotes' in filters and filters['hasNotes']:
                query += ' AND t."openCodingNotes" IS NOT NULL'
            if 'hasCategories' in filters and filters['hasCategories']:
                query += ' AND array_length(t."errorCategories", 1) > 0'

        query += """
        GROUP BY t.id, c.id
        ORDER BY t.timestamp DESC
        LIMIT :limit
        """
        params['limit'] = limit

        with self.engine.connect() as conn:
            df = pd.read_sql_query(text(query), conn, params=params)

        return df
