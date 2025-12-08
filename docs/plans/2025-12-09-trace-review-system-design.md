# Trace Review & Error Coding System

**Date:** 2025-12-09
**Status:** Design Complete
**Phase:** Phase 2 - Error Analysis Infrastructure

---

## Problem Statement

Prisma Studio is insufficient for qualitative trace analysis. Need a better tool for:

1. **Open coding workflow**: Review 50+ traces, record emergent observations
2. **Multi-level annotation**: Tag both individual messages and complete traces
3. **Pattern analysis**: View all coded traces together to identify themes
4. **Theme synthesis**: Apply error categories after patterns emerge
5. **Progress tracking**: Know what's been coded, what categories exist

---

## Requirements

### Must Have
- Load traces with full conversation context (messages, extraction, strategy output)
- Record freeform observations during initial review (emergent coding)
- Annotate specific message exchanges when needed
- Apply structured error categories after theme synthesis
- View all coded traces together for pattern discovery
- No CSV export/import workflow (annotations persist directly to database)

### Nice to Have
- Filter traces by lens, confidence, feedback, etc.
- Summary statistics (coding progress, category distribution)
- Support for AI-assisted theme synthesis (future)

### Non-Goals (Phase 2)
- Custom web UI (use Jupyter instead)
- Real-time collaboration (single reviewer for now)
- LLM-as-judge automation (Phase 3+)

---

## Solution Design

### Architecture

**Hybrid approach:**
1. **Database schema extensions** - Add fields for annotations
2. **Python helper library** - Easy data access from Jupyter
3. **Starter notebook** - Copy-paste workflow examples

**Why Jupyter:**
- Standard tool for qualitative analysis in evals methodology
- Flexible - supports both exploratory and systematic workflows
- No UI development overhead
- Easy to share analysis artifacts

---

## Part 1: Database Schema Extensions

### Changes to `prisma/schema.prisma`

```prisma
model Trace {
  // ... existing fields ...

  // Phase 2: Error coding fields
  openCodingNotes     String?  @db.Text       // Freeform observations during initial review
  errorCategories     String[] @default([])   // Applied after theme synthesis
  reviewedAt          DateTime?               // When this trace was coded
  reviewedBy          String?                 // Who reviewed it (multi-reviewer future)
}

model Message {
  // ... existing fields ...

  // Phase 2: Message-level annotations
  annotations         String?  @db.Text       // Notes on specific exchanges
}
```

### Design Decisions

**Freeform text fields** (`openCodingNotes`, `annotations`):
- Support emergent coding - don't know error types upfront
- Can record detailed observations without schema constraints
- Natural for qualitative analysis workflow

**String array** for `errorCategories`:
- Multiple tags per trace (e.g., both "extraction-overgeneralization" and "weak-objectives")
- Easy to query with PostgreSQL array operators
- Can evolve taxonomy without migrations

**Optional fields**:
- Non-breaking - existing traces continue to work
- Can add coding incrementally (don't need to code everything at once)
- reviewedBy supports future multi-reviewer workflows

---

## Part 2: Python Helper Library

### File: `scripts/trace_analysis.py`

```python
"""
Helper functions for trace analysis in Jupyter notebooks.
Provides easy data loading, formatting, and annotation persistence.
"""

import os
import pandas as pd
from sqlalchemy import create_engine
from datetime import datetime
import json
from dotenv import load_dotenv

class TraceAnalyzer:
    """Main interface for working with traces in notebooks."""

    def __init__(self):
        """Connect to database using DATABASE_URL from .env.local"""
        load_dotenv('.env.local')  # Load environment variables
        db_url = os.getenv('DATABASE_URL')
        if not db_url:
            raise ValueError("DATABASE_URL not found in environment")
        self.engine = create_engine(db_url)

    def load_traces(self, limit=50, filters=None):
        """
        Load traces with full conversation context.

        Args:
            limit: Max traces to load (default 50)
            filters: Dict like {'selectedLens': 'A', 'userFeedback': 'not_helpful'}

        Returns:
            DataFrame with columns:
            - id, conversationId, userId, timestamp
            - selectedLens, questionCount, currentPhase
            - extractedContext (JSON), output (JSON)
            - openCodingNotes, errorCategories
            - userFeedback, claudeThoughts
            - messages (nested list of conversation)
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

        # Add filters
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
            df = pd.read_sql_query(query, conn, params=params)

        return df

    def display_trace(self, trace_id):
        """
        Pretty-print a single trace for review.

        Displays:
        - Metadata (lens, question count, phase)
        - Full conversation thread
        - Extracted context (formatted JSON)
        - Strategy output (vision, mission, objectives)
        - Current notes and categories
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
            result = pd.read_sql_query(query, conn, params={'trace_id': trace_id})

        if result.empty:
            print(f"Trace {trace_id} not found")
            return

        trace = result.iloc[0]

        # Format output as markdown for Jupyter
        from IPython.display import display, Markdown

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
        from sqlalchemy import text

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
        from sqlalchemy import text

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
        from sqlalchemy import text

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
            Dict with:
            - total_traces: Total in database
            - coded_traces: Have openCodingNotes
            - categorized_traces: Have errorCategories
            - category_distribution: Count by category
        """
        from sqlalchemy import text

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
            categories = pd.read_sql_query("""
                SELECT unnest("errorCategories") as category, COUNT(*) as count
                FROM "Trace"
                WHERE array_length("errorCategories", 1) > 0
                GROUP BY category
                ORDER BY count DESC
            """, conn)

        return {
            'total_traces': int(total.iloc[0]['count']),
            'coded_traces': int(coded.iloc[0]['count']),
            'categorized_traces': int(categorized.iloc[0]['count']),
            'category_distribution': categories
        }
```

### Design Decisions

**Single class interface**:
- Easy to import and use: `from scripts.trace_analysis import TraceAnalyzer`
- All methods in one place
- Clear naming (load, display, annotate, categorize)

**SQLAlchemy + pandas**:
- Standard Python data stack
- Easy to learn/modify for moderate Python users
- Pandas DataFrames are natural for analysis

**Rich display formatting**:
- Uses Jupyter's Markdown rendering
- Emojis for visual scanning (🤖/👤 for roles)
- JSON formatting for structured data
- Clear section breaks

**Direct database writes**:
- No sync workflow needed
- Immediate persistence
- Simple error handling

---

## Part 3: Starter Jupyter Notebook

### File: `notebooks/trace_analysis_starter.ipynb`

**Cell 1: Setup**
```python
# Load the helper library
import sys
sys.path.append('..')  # Add parent directory to path

from scripts.trace_analysis import TraceAnalyzer
import pandas as pd

# Connect to database
analyzer = TraceAnalyzer()
print("✅ Connected to database")
```

**Cell 2: Load traces**
```python
# Load recent traces
traces = analyzer.load_traces(limit=50)
print(f"Loaded {len(traces)} traces")

# Quick overview
traces[['id', 'selectedLens', 'questionCount', 'userFeedback', 'reviewedAt']].head()
```

**Cell 3: Filter traces (example)**
```python
# Example: Find all lens A conversations with negative feedback
problematic = traces[
    (traces['selectedLens'] == 'A') &
    (traces['userFeedback'] == 'not_helpful')
]
print(f"Found {len(problematic)} problematic traces")
problematic[['id', 'questionCount', 'timestamp']]
```

**Cell 4: Review individual trace**
```python
# Pick first trace from filtered set
trace_id = problematic.iloc[0]['id']

# Display full trace with conversation, extraction, strategy
analyzer.display_trace(trace_id)
```

**Cell 5: Add open coding notes**
```python
# Record observations as you review
analyzer.annotate_trace(
    trace_id=trace_id,
    notes="""
    Observation: User provided specific customer pain point about
    "restaurant staff turnover", but extraction generalized to
    "operational challenges". Strategy output was too vague as a result.

    Potential error: over-generalization in extraction phase
    Impact: Vision/mission statements lacked specificity
    """
)
```

**Cell 6: Annotate specific message (optional)**
```python
# If you need to tag a specific exchange
# First, get message IDs from trace display above
message_id = 'cm4x...'  # Copy from trace display

analyzer.annotate_message(
    message_id=message_id,
    annotation="User gave very specific answer here, but next question didn't build on it"
)
```

**Cell 7: View all coded traces**
```python
# Load only traces you've already coded
coded = analyzer.load_traces(limit=100, filters={'hasNotes': True})
print(f"{len(coded)} traces have been coded")

# Browse notes
for idx, row in coded.iterrows():
    print(f"\n--- Trace {row['id'][:8]}... ---")
    print(f"Lens: {row['selectedLens']}, Feedback: {row['userFeedback']}")
    print(row['openCodingNotes'][:200] + "..." if len(row['openCodingNotes']) > 200 else row['openCodingNotes'])
```

**Cell 8: Pattern discovery**
```python
# After reviewing many traces, look for recurring themes
# Example: Search notes for keywords
extraction_issues = coded[coded['openCodingNotes'].str.contains('extraction', case=False, na=False)]
print(f"Found {len(extraction_issues)} traces mentioning extraction issues")

# Or export for AI-assisted theme synthesis
coded[['id', 'selectedLens', 'openCodingNotes']].to_csv('coded_traces_for_synthesis.csv')
print("Exported coded traces to CSV for theme synthesis")
```

**Cell 9: Apply categories (after synthesis)**
```python
# Once you've identified themes, apply categories
# Example: Categorize the traces with extraction issues

for idx, row in extraction_issues.iterrows():
    analyzer.categorize_trace(
        trace_id=row['id'],
        categories=['extraction-overgeneralization', 'weak-strategy-specificity']
    )

print(f"Categorized {len(extraction_issues)} traces")
```

**Cell 10: Summary statistics**
```python
# See coding progress
summary = analyzer.get_coding_summary()

print(f"Total traces: {summary['total_traces']}")
print(f"Coded: {summary['coded_traces']} ({summary['coded_traces']/summary['total_traces']*100:.1f}%)")
print(f"Categorized: {summary['categorized_traces']}")
print("\nCategory distribution:")
print(summary['category_distribution'])
```

---

## Part 4: Environment Setup

### File: `requirements.txt`

```txt
jupyter>=1.0.0
pandas>=2.0.0
sqlalchemy>=2.0.0
psycopg2-binary>=2.9.0
python-dotenv>=1.0.0
ipywidgets>=8.0.0
```

### File: `notebooks/README.md`

```markdown
# Trace Analysis Notebooks

## Setup (First Time)

1. **Create Python virtual environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Start Jupyter:**
   ```bash
   jupyter notebook
   ```

   This will open Jupyter in your browser at http://localhost:8888

4. **Open starter notebook:**
   - Navigate to `notebooks/trace_analysis_starter.ipynb`
   - Run cells from top to bottom

## Environment Variables

The `TraceAnalyzer` class reads `DATABASE_URL` from your `.env.local` file.

Make sure you have:
```
DATABASE_URL=postgresql://...
```

## Analysis Workflow

### Phase 1: Initial Open Coding

1. Load traces (all, or filtered by lens/feedback)
2. Review one by one using `display_trace()`
3. Record observations with `annotate_trace()`
4. Tag specific messages if needed with `annotate_message()`
5. Continue until you've reviewed enough to see patterns (30-50 traces recommended)

### Phase 2: Theme Synthesis

1. Load all coded traces
2. Search notes for recurring keywords/patterns
3. Export notes to CSV for AI-assisted synthesis (optional)
4. Define error taxonomy based on patterns found
5. Document categories (what each means, examples)

### Phase 3: Categorization

1. Apply error categories to coded traces using `categorize_trace()`
2. Can categorize multiple traces at once with a loop
3. One trace can have multiple categories

### Phase 4: Analysis

1. Use `get_coding_summary()` to see category distribution
2. Filter traces by category to deep-dive
3. Measure prevalence (which errors are most common?)
4. Prioritize fixes based on frequency and impact
5. Track improvement over time (re-code after changes)

## Example Notebooks

Current:
- `trace_analysis_starter.ipynb` - Basic workflow with examples

Future:
- `theme_synthesis.ipynb` - AI-assisted pattern finding
- `eval_metrics.ipynb` - Measure improvement over time
- `lens_comparison.ipynb` - Compare error rates by lens

## Tips

**Filtering traces:**
- By lens: `filters={'selectedLens': 'A'}`
- By feedback: `filters={'userFeedback': 'not_helpful'}`
- Only coded: `filters={'hasNotes': True}`
- Only categorized: `filters={'hasCategories': True}`

**Searching notes:**
- Use pandas string methods: `traces['openCodingNotes'].str.contains('keyword')`
- Case insensitive: add `case=False`
- Handle nulls: add `na=False`

**Exporting data:**
- To CSV: `traces.to_csv('filename.csv')`
- Selected columns: `traces[['col1', 'col2']].to_csv('filename.csv')`
- For AI synthesis: Export id, lens, notes

**Keyboard shortcuts in Jupyter:**
- Run cell: `Shift + Enter`
- Add cell below: `B`
- Delete cell: `D D` (press D twice)
- Command mode: `Esc`
- Edit mode: `Enter`
```

---

## Implementation Plan

### Database Migration
1. Add new fields to Prisma schema
2. Run `npx prisma migrate dev --name add-error-coding-fields`
3. Push to Vercel Postgres: `npx prisma db push`

### Python Setup
1. Create `scripts/trace_analysis.py` with `TraceAnalyzer` class
2. Create `requirements.txt` with dependencies
3. Create `notebooks/` directory
4. Add `notebooks/README.md` with setup instructions
5. Create `notebooks/trace_analysis_starter.ipynb` with examples

### Testing
1. Create Python venv and install dependencies
2. Test database connection
3. Test each `TraceAnalyzer` method
4. Run through notebook examples end-to-end
5. Verify annotations persist to database

### Documentation
1. Update main README with link to notebooks/README.md
2. Add to PROJECT_STATUS.md (Phase 2 infrastructure complete)
3. Document in session notes

---

## Success Criteria

- [ ] Database schema supports open coding and categorization
- [ ] Can load traces with full context in Jupyter
- [ ] Can display trace in readable format
- [ ] Can annotate traces and messages
- [ ] Can apply error categories
- [ ] Annotations persist to database immediately
- [ ] Can query coded traces
- [ ] Can generate summary statistics
- [ ] Starter notebook runs without errors
- [ ] Setup instructions work for fresh Python environment

---

## Future Enhancements (Not Phase 2)

### AI-Assisted Theme Synthesis
- Notebook that sends coded notes to Claude
- Asks Claude to identify recurring patterns
- Suggests error taxonomy
- Still requires human review/refinement

### Eval Metrics Dashboard
- Track coding progress over time
- Measure error rate before/after fixes
- Compare error distribution by lens
- Identify highest-impact improvements

### LLM-as-Judge (Phase 3)
- After error categories stabilized
- Train LLM to auto-code traces
- Human review for accuracy
- Scales error coding to all traces

### Web UI (If Needed)
- Only build if Jupyter proves insufficient
- Simple list + detail view
- Inline editing of notes/categories
- Would reuse same database schema

---

## Notes

- Jupyter is the right tool for qualitative analysis (standard in evals methodology)
- Schema is flexible - easy to add fields later without breaking existing code
- Helper library keeps notebook code clean and readable
- Direct database writes eliminate sync workflow complexity
- Can always build web UI later if needed (same schema supports both)

**Key principle**: Start simple, validate with real usage, iterate based on what's actually needed.
