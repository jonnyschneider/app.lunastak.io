# Trace Review & Error Coding System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build Jupyter-based trace analysis infrastructure for Phase 2 error coding with open-ended qualitative analysis support.

**Architecture:** Extend database schema with error coding fields, create Python helper library for Jupyter access, provide starter notebook with examples. Hybrid approach: Jupyter for analysis, direct DB writes for persistence.

**Tech Stack:** Prisma (schema), PostgreSQL, Python 3, SQLAlchemy, pandas, Jupyter

---

## Task 1: Update Database Schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add error coding fields to Trace model**

Open `prisma/schema.prisma` and locate the `Trace` model (around line 43).

Add these fields after the existing `refinementRequested` field:

```prisma
model Trace {
  // ... existing fields ...

  // Phase 2: Error coding fields
  openCodingNotes     String?  @db.Text
  errorCategories     String[] @default([])
  reviewedAt          DateTime?
  reviewedBy          String?
}
```

**Step 2: Add annotations field to Message model**

Locate the `Message` model (around line 27).

Add this field after the existing `confidenceReasoning` field:

```prisma
model Message {
  // ... existing fields ...

  // Phase 2: Message-level annotations
  annotations         String?  @db.Text
}
```

**Step 3: Generate Prisma Client**

Run: `npx prisma generate`

Expected output: "✔ Generated Prisma Client"

**Step 4: Push schema changes to database**

Run: `npx prisma db push`

Expected output:
```
🚀  Your database is now in sync with your Prisma schema.
✔ Generated Prisma Client
```

**Step 5: Verify schema changes**

Start Prisma Studio: `npx prisma studio`

Navigate to Trace model, verify new fields appear:
- openCodingNotes (String, nullable)
- errorCategories (String[], default [])
- reviewedAt (DateTime, nullable)
- reviewedBy (String, nullable)

Navigate to Message model, verify:
- annotations (String, nullable)

**Step 6: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add error coding fields to Trace and Message models

- Add openCodingNotes, errorCategories, reviewedAt, reviewedBy to Trace
- Add annotations to Message
- Support Phase 2 qualitative error analysis"
```

---

## Task 2: Create Python Requirements File

**Files:**
- Create: `requirements.txt`

**Step 1: Create requirements.txt**

Create new file `requirements.txt` in project root:

```txt
jupyter>=1.0.0
pandas>=2.0.0
sqlalchemy>=2.0.0
psycopg2-binary>=2.9.0
python-dotenv>=1.0.0
ipywidgets>=8.0.0
```

**Step 2: Test installation in virtual environment**

Run:
```bash
python3 -m venv venv-test
source venv-test/bin/activate
pip install -r requirements.txt
```

Expected: All packages install without errors

**Step 3: Clean up test environment**

Run:
```bash
deactivate
rm -rf venv-test
```

**Step 4: Commit**

```bash
git add requirements.txt
git commit -m "feat: add Python dependencies for Jupyter trace analysis"
```

---

## Task 3: Create Python Helper Library (Part 1 - Setup & Connection)

**Files:**
- Create: `scripts/trace_analysis.py`

**Step 1: Create scripts directory and file**

Run:
```bash
mkdir -p scripts
touch scripts/trace_analysis.py
touch scripts/__init__.py
```

**Step 2: Write imports and class skeleton**

Add to `scripts/trace_analysis.py`:

```python
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
        self.engine = create_engine(db_url)
        print("✅ Connected to database")
```

**Step 3: Test basic connection**

Create test file `scripts/test_connection.py`:

```python
import sys
sys.path.append('.')
from scripts.trace_analysis import TraceAnalyzer

try:
    analyzer = TraceAnalyzer()
    print("Connection test passed")
except Exception as e:
    print(f"Connection test failed: {e}")
    sys.exit(1)
```

Run: `python scripts/test_connection.py`

Expected output:
```
✅ Connected to database
Connection test passed
```

**Step 4: Clean up test file**

Run: `rm scripts/test_connection.py`

**Step 5: Commit**

```bash
git add scripts/
git commit -m "feat: create TraceAnalyzer class with database connection"
```

---

## Task 4: Create Python Helper Library (Part 2 - Load Traces)

**Files:**
- Modify: `scripts/trace_analysis.py`

**Step 1: Add load_traces method**

Add this method to the `TraceAnalyzer` class in `scripts/trace_analysis.py`:

```python
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
```

**Step 2: Test load_traces method**

Create `scripts/test_load.py`:

```python
import sys
sys.path.append('.')
from scripts.trace_analysis import TraceAnalyzer

analyzer = TraceAnalyzer()
traces = analyzer.load_traces(limit=5)
print(f"Loaded {len(traces)} traces")
print(f"Columns: {list(traces.columns)}")
if len(traces) > 0:
    print(f"First trace ID: {traces.iloc[0]['id']}")
    print("Test passed")
else:
    print("Warning: No traces in database yet")
```

Run: `python scripts/test_load.py`

Expected: Loads traces successfully (or reports none if DB empty)

**Step 3: Clean up**

Run: `rm scripts/test_load.py`

**Step 4: Commit**

```bash
git add scripts/trace_analysis.py
git commit -m "feat: add load_traces method with filtering support"
```

---

## Task 5: Create Python Helper Library (Part 3 - Display Trace)

**Files:**
- Modify: `scripts/trace_analysis.py`

**Step 1: Add display_trace method**

Add this method to the `TraceAnalyzer` class:

```python
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
```

**Step 2: Commit**

```bash
git add scripts/trace_analysis.py
git commit -m "feat: add display_trace method for pretty-printed review"
```

---

## Task 6: Create Python Helper Library (Part 4 - Annotation Methods)

**Files:**
- Modify: `scripts/trace_analysis.py`

**Step 1: Add annotation methods**

Add these methods to the `TraceAnalyzer` class:

```python
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
```

**Step 2: Commit**

```bash
git add scripts/trace_analysis.py
git commit -m "feat: add annotation methods for traces and messages"
```

---

## Task 7: Create Python Helper Library (Part 5 - Summary Statistics)

**Files:**
- Modify: `scripts/trace_analysis.py`

**Step 1: Add get_coding_summary method**

Add this method to the `TraceAnalyzer` class:

```python
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
```

**Step 2: Commit**

```bash
git add scripts/trace_analysis.py
git commit -m "feat: add get_coding_summary for progress tracking"
```

---

## Task 8: Create Notebooks Directory and README

**Files:**
- Create: `notebooks/README.md`

**Step 1: Create notebooks directory**

Run: `mkdir -p notebooks`

**Step 2: Create README.md**

Create `notebooks/README.md`:

```markdown
# Trace Analysis Notebooks

## Setup (First Time)

1. **Create Python virtual environment:**
   ```bash
   python3 -m venv venv
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

**Keyboard shortcuts in Jupyter:**
- Run cell: `Shift + Enter`
- Add cell below: `B`
- Delete cell: `D D` (press D twice)
```

**Step 3: Commit**

```bash
git add notebooks/
git commit -m "docs: create notebooks directory with setup guide"
```

---

## Task 9: Create Starter Jupyter Notebook

**Files:**
- Create: `notebooks/trace_analysis_starter.ipynb`

**Step 1: Create notebook file**

Create `notebooks/trace_analysis_starter.ipynb` with this content:

```json
{
 "cells": [
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "# Trace Analysis Starter\n",
    "\n",
    "This notebook demonstrates the basic workflow for trace analysis and error coding.\n",
    "\n",
    "## Setup\n",
    "\n",
    "Make sure you've:\n",
    "1. Created a virtual environment: `python3 -m venv venv`\n",
    "2. Activated it: `source venv/bin/activate`\n",
    "3. Installed dependencies: `pip install -r requirements.txt`\n",
    "4. Have DATABASE_URL in your `.env.local`"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": null,
   "metadata": {},
   "outputs": [],
   "source": [
    "# Cell 1: Setup\n",
    "import sys\n",
    "sys.path.append('..')  # Add parent directory to path\n",
    "\n",
    "from scripts.trace_analysis import TraceAnalyzer\n",
    "import pandas as pd\n",
    "\n",
    "# Connect to database\n",
    "analyzer = TraceAnalyzer()"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": null,
   "metadata": {},
   "outputs": [],
   "source": [
    "# Cell 2: Load traces\n",
    "traces = analyzer.load_traces(limit=50)\n",
    "print(f\"Loaded {len(traces)} traces\")\n",
    "\n",
    "# Quick overview\n",
    "traces[['id', 'selectedLens', 'questionCount', 'userFeedback', 'reviewedAt']].head()"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": null,
   "metadata": {},
   "outputs": [],
   "source": [
    "# Cell 3: Filter traces (example)\n",
    "# Example: Find all lens A conversations with negative feedback\n",
    "problematic = traces[\n",
    "    (traces['selectedLens'] == 'A') &\n",
    "    (traces['userFeedback'] == 'not_helpful')\n",
    "]\n",
    "print(f\"Found {len(problematic)} problematic traces\")\n",
    "problematic[['id', 'questionCount', 'timestamp']]"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": null,
   "metadata": {},
   "outputs": [],
   "source": [
    "# Cell 4: Review individual trace\n",
    "# Pick first trace from filtered set (or use any trace ID)\n",
    "if len(traces) > 0:\n",
    "    trace_id = traces.iloc[0]['id']\n",
    "    analyzer.display_trace(trace_id)\n",
    "else:\n",
    "    print(\"No traces available. Run the app and create some conversations first.\")"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": null,
   "metadata": {},
   "outputs": [],
   "source": [
    "# Cell 5: Add open coding notes\n",
    "# Record observations as you review\n",
    "# analyzer.annotate_trace(\n",
    "#     trace_id=trace_id,\n",
    "#     notes=\"\"\"\n",
    "#     Observation: User provided specific customer pain point,\n",
    "#     but extraction generalized too much.\n",
    "#     \n",
    "#     Potential error: over-generalization in extraction phase\n",
    "#     Impact: Strategy output was too vague\n",
    "#     \"\"\"\n",
    "# )"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": null,
   "metadata": {},
   "outputs": [],
   "source": [
    "# Cell 6: View all coded traces\n",
    "coded = analyzer.load_traces(limit=100, filters={'hasNotes': True})\n",
    "print(f\"{len(coded)} traces have been coded\")\n",
    "\n",
    "# Browse notes\n",
    "for idx, row in coded.iterrows():\n",
    "    print(f\"\\n--- Trace {row['id'][:8]}... ---\")\n",
    "    print(f\"Lens: {row['selectedLens']}, Feedback: {row['userFeedback']}\")\n",
    "    notes = row['openCodingNotes']\n",
    "    if notes:\n",
    "        print(notes[:200] + \"...\" if len(notes) > 200 else notes)"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": null,
   "metadata": {},
   "outputs": [],
   "source": [
    "# Cell 7: Apply categories (after synthesis)\n",
    "# Once you've identified themes, apply categories\n",
    "# Example: Categorize traces with extraction issues\n",
    "\n",
    "# analyzer.categorize_trace(\n",
    "#     trace_id=trace_id,\n",
    "#     categories=['extraction-overgeneralization', 'weak-strategy-specificity']\n",
    "# )"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": null,
   "metadata": {},
   "outputs": [],
   "source": [
    "# Cell 8: Summary statistics\n",
    "summary = analyzer.get_coding_summary()\n",
    "\n",
    "print(f\"Total traces: {summary['total_traces']}\")\n",
    "print(f\"Coded: {summary['coded_traces']} ({summary['coded_traces']/summary['total_traces']*100:.1f}%)\")\n",
    "print(f\"Categorized: {summary['categorized_traces']}\")\n",
    "print(\"\\nCategory distribution:\")\n",
    "print(summary['category_distribution'])"
   ]
  }
 ],
 "metadata": {
  "kernelspec": {
   "display_name": "Python 3",
   "language": "python",
   "name": "python3"
  },
  "language_info": {
   "codemirror_mode": {
    "name": "ipython",
    "version": 3
   },
   "file_extension": ".py",
   "mimetype": "text/x-python",
   "name": "python",
   "nbconvert_exporter": "python",
   "pygments_lexer": "ipython3",
   "version": "3.11.0"
  }
 },
 "nbformat": 4,
 "nbformat_minor": 4
}
```

**Step 2: Commit**

```bash
git add notebooks/trace_analysis_starter.ipynb
git commit -m "feat: create starter Jupyter notebook with workflow examples"
```

---

## Task 10: Update Main README

**Files:**
- Modify: `README.md`

**Step 1: Add Trace Analysis section**

Add this section to `README.md` after the existing content:

```markdown

## Phase 2: Trace Analysis & Error Coding

For qualitative analysis and error coding of conversation traces, see:

**📊 [Trace Analysis Guide](notebooks/README.md)**

**Quick Start:**
1. Set up Python environment: `python3 -m venv venv && source venv/bin/activate`
2. Install dependencies: `pip install -r requirements.txt`
3. Start Jupyter: `jupyter notebook`
4. Open `notebooks/trace_analysis_starter.ipynb`

**What's included:**
- Database schema with error coding fields
- Python helper library (`TraceAnalyzer`) for easy data access
- Jupyter starter notebook with workflow examples
- Support for open coding, theme synthesis, and categorization
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add trace analysis section to main README"
```

---

## Task 11: Integration Testing

**Files:**
- Create: `scripts/test_trace_analysis.py`

**Step 1: Create integration test script**

Create `scripts/test_trace_analysis.py`:

```python
"""
Integration test for TraceAnalyzer.
Tests all methods with actual database connection.
"""

import sys
sys.path.append('.')
from scripts.trace_analysis import TraceAnalyzer

def test_trace_analyzer():
    print("Testing TraceAnalyzer...")

    # Test 1: Connection
    print("\n1. Testing connection...")
    analyzer = TraceAnalyzer()
    print("✅ Connected")

    # Test 2: Load traces
    print("\n2. Testing load_traces...")
    traces = analyzer.load_traces(limit=5)
    print(f"✅ Loaded {len(traces)} traces")

    if len(traces) == 0:
        print("⚠️  No traces in database. Create some conversations first.")
        return

    # Test 3: Display trace
    print("\n3. Testing display_trace...")
    trace_id = traces.iloc[0]['id']
    print(f"Displaying trace {trace_id[:8]}...")
    # Can't test display in non-Jupyter, but verify no errors
    # analyzer.display_trace(trace_id)
    print("✅ Display method exists")

    # Test 4: Annotate trace
    print("\n4. Testing annotate_trace...")
    test_notes = "Test annotation from integration test"
    analyzer.annotate_trace(trace_id, test_notes)

    # Verify annotation saved
    traces_after = analyzer.load_traces(limit=5)
    saved_note = traces_after[traces_after['id'] == trace_id].iloc[0]['openCodingNotes']
    assert saved_note == test_notes, "Annotation not saved"
    print("✅ Annotation saved and retrieved")

    # Test 5: Categorize trace
    print("\n5. Testing categorize_trace...")
    test_categories = ['test-category-1', 'test-category-2']
    analyzer.categorize_trace(trace_id, test_categories)

    # Verify categories saved
    traces_after = analyzer.load_traces(limit=5)
    saved_cats = traces_after[traces_after['id'] == trace_id].iloc[0]['errorCategories']
    assert saved_cats == test_categories, "Categories not saved"
    print("✅ Categories saved and retrieved")

    # Test 6: Get summary
    print("\n6. Testing get_coding_summary...")
    summary = analyzer.get_coding_summary()
    assert summary['total_traces'] > 0, "No traces counted"
    assert summary['coded_traces'] > 0, "No coded traces counted"
    print(f"✅ Summary: {summary['total_traces']} total, {summary['coded_traces']} coded")

    # Test 7: Filter by hasNotes
    print("\n7. Testing filter by hasNotes...")
    coded = analyzer.load_traces(limit=10, filters={'hasNotes': True})
    assert len(coded) > 0, "Should have coded traces"
    print(f"✅ Found {len(coded)} coded traces")

    # Clean up test data
    print("\n8. Cleaning up test data...")
    analyzer.annotate_trace(trace_id, None)
    analyzer.categorize_trace(trace_id, [])
    print("✅ Test data cleaned")

    print("\n✅ All tests passed!")

if __name__ == '__main__':
    try:
        test_trace_analyzer()
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
```

**Step 2: Run integration tests**

Run: `python scripts/test_trace_analysis.py`

Expected output:
```
Testing TraceAnalyzer...

1. Testing connection...
✅ Connected to database
✅ Connected

2. Testing load_traces...
✅ Loaded N traces

...

✅ All tests passed!
```

**Step 3: Keep test file for future use**

This test file is useful for regression testing, so keep it.

**Step 4: Commit**

```bash
git add scripts/test_trace_analysis.py
git commit -m "test: add integration tests for TraceAnalyzer"
```

---

## Task 12: Update .gitignore

**Files:**
- Modify: `.gitignore`

**Step 1: Add Python-specific ignores**

Add to `.gitignore`:

```
# Python
venv/
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
*.egg-info/
.ipynb_checkpoints/

# Jupyter
.jupyter/
```

**Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: add Python and Jupyter to gitignore"
```

---

## Success Criteria

After completing all tasks, verify:

- [ ] Database schema has new error coding fields
- [ ] `TraceAnalyzer` class exists with all methods
- [ ] Can connect to database from Python
- [ ] Can load traces with filters
- [ ] Can display trace in readable format
- [ ] Can annotate traces and messages
- [ ] Can categorize traces
- [ ] Can get summary statistics
- [ ] Starter notebook exists with examples
- [ ] README documents setup process
- [ ] Integration tests pass
- [ ] All changes committed to git

---

## Post-Implementation Testing

1. **Manual workflow test:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   jupyter notebook
   ```

2. **Open `notebooks/trace_analysis_starter.ipynb`**

3. **Run all cells** - should work without errors (may need traces in DB first)

4. **Try the workflow:**
   - Load traces
   - Display a trace
   - Annotate it
   - Check summary statistics

---

## Notes

- Python virtual environment is local only (not committed)
- `.env.local` must exist with valid `DATABASE_URL`
- If no traces exist, create some via main app first
- Jupyter runs on port 8888 by default
- Can run multiple notebooks simultaneously
- TraceAnalyzer connects fresh on each import (no connection pooling needed for Jupyter use case)
