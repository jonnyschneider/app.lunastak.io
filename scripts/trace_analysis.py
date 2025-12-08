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

    def display_trace(self, trace_id):
        """
        Pretty-print a single trace for review.

        Displays conversation, extraction, strategy output, and coding
        """
        query = """
        SELECT
            t.*,
            c."selectedLens",
            c."questionCount",
            c."currentPhase",
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
        WHERE t.id = :trace_id
        GROUP BY t.id, c.id
        """

        with self.engine.connect() as conn:
            result = pd.read_sql_query(text(query), conn, params={'trace_id': trace_id})

        if result.empty:
            print(f"Trace {trace_id} not found")
            return

        trace = result.iloc[0]

        md = f"""
# Trace: {trace['id'][:8]}...

**Metadata:**
- Lens: {trace['selectedLens']}
- Questions: {trace['questionCount']}
- Phase: {trace['currentPhase']}
- Feedback: {trace.get('userFeedback', 'None')}
- Reviewed: {trace.get('reviewedAt', 'Not yet')}

---

## Conversation

"""
        messages = json.loads(trace['messages'])
        for msg in messages:
            role = "🤖 Assistant" if msg['role'] == 'assistant' else "👤 User"
            md += f"\n**{role}** (Step {msg['stepNumber']}):\n{msg['content']}\n"
            if msg.get('confidenceScore'):
                md += f"*Confidence: {msg['confidenceScore']}*\n"
            if msg.get('annotations'):
                md += f"📝 *Annotation: {msg['annotations']}*\n"
            md += "\n"

        md += "\n---\n\n## Extracted Context\n\n```json\n"
        md += json.dumps(json.loads(trace['extractedContext']), indent=2)
        md += "\n```\n\n---\n\n## Strategy Output\n\n"

        output = json.loads(trace['output'])
        md += f"**Vision:** {output.get('vision', 'N/A')}\n\n"
        md += f"**Mission:** {output.get('mission', 'N/A')}\n\n"
        md += "**Objectives:**\n"
        for obj in output.get('objectives', []):
            md += f"- {obj}\n"

        if trace.get('claudeThoughts'):
            md += f"\n**Claude's Thoughts:** {trace['claudeThoughts']}\n"

        md += "\n---\n\n## Coding\n\n"

        if trace.get('openCodingNotes'):
            md += f"**Notes:**\n{trace['openCodingNotes']}\n\n"
        else:
            md += "*No notes yet*\n\n"

        if trace.get('errorCategories') and len(trace['errorCategories']) > 0:
            md += f"**Categories:** {', '.join(trace['errorCategories'])}\n"
        else:
            md += "*No categories yet*\n"

        display(Markdown(md))

    def annotate_trace(self, trace_id, notes):
        """
        Save open coding notes for a trace.

        Args:
            trace_id: Trace to annotate
            notes: Freeform text observations
        """
        query = text("""
        UPDATE "Trace"
        SET "openCodingNotes" = :notes,
            "reviewedAt" = NOW()
        WHERE id = :trace_id
        """)

        with self.engine.begin() as conn:
            conn.execute(query, {'notes': notes, 'trace_id': trace_id})

        print(f"✅ Annotated trace {trace_id[:8]}...")

    def categorize_trace(self, trace_id, categories):
        """
        Apply error categories after theme synthesis.

        Args:
            trace_id: Trace to categorize
            categories: List like ['over-generalization', 'weak-objectives']
        """
        query = text("""
        UPDATE "Trace"
        SET "errorCategories" = :categories
        WHERE id = :trace_id
        """)

        with self.engine.begin() as conn:
            conn.execute(query, {'categories': categories, 'trace_id': trace_id})

        print(f"✅ Categorized trace {trace_id[:8]}... with: {', '.join(categories)}")

    def annotate_message(self, message_id, annotation):
        """
        Save annotation for specific message exchange.

        Args:
            message_id: Message to annotate
            annotation: Freeform text note
        """
        query = text("""
        UPDATE "Message"
        SET annotations = :annotation
        WHERE id = :message_id
        """)

        with self.engine.begin() as conn:
            conn.execute(query, {'annotation': annotation, 'message_id': message_id})

        print(f"✅ Annotated message {message_id[:8]}...")

    def get_coding_summary(self):
        """
        Summary statistics for error coding progress.

        Returns:
            Dict with total, coded, categorized counts and distribution
        """
        with self.engine.connect() as conn:
            # Total traces
            total = pd.read_sql_query('SELECT COUNT(*) as count FROM "Trace"', conn)

            # Coded traces
            coded = pd.read_sql_query(
                'SELECT COUNT(*) as count FROM "Trace" WHERE "openCodingNotes" IS NOT NULL',
                conn
            )

            # Categorized traces
            categorized = pd.read_sql_query(
                'SELECT COUNT(*) as count FROM "Trace" WHERE array_length("errorCategories", 1) > 0',
                conn
            )

            # Category distribution
            categories = pd.read_sql_query(text("""
                SELECT unnest("errorCategories") as category, COUNT(*) as count
                FROM "Trace"
                WHERE array_length("errorCategories", 1) > 0
                GROUP BY category
                ORDER BY count DESC
            """), conn)

        return {
            'total_traces': int(total.iloc[0]['count']),
            'coded_traces': int(coded.iloc[0]['count']),
            'categorized_traces': int(categorized.iloc[0]['count']),
            'category_distribution': categories
        }
