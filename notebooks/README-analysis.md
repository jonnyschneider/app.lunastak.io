# Trace Analysis Notebooks

## Available Notebooks

### 1. `trace_analysis_starter.ipynb`
General-purpose trace analysis for open coding, event analysis, and quality correlation.

### 2. `dimensional_coverage_analysis.ipynb`
Dimensional coverage analysis for Experiment 2 (E2) - analyzing how emergent themes map to strategic dimensions.

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

## Dimensional Coverage Analysis (E2)

### Prerequisites

Before analyzing dimensional coverage data, you need to:

1. **Run the backfill script** to add dimensional coverage to existing traces:
   ```bash
   # From project root
   npx tsx scripts/backfill-dimensional-coverage.ts
   ```

2. **Options for backfill script:**
   ```bash
   # Dry run (preview without updating)
   npx tsx scripts/backfill-dimensional-coverage.ts --dry-run

   # Process only first N traces
   npx tsx scripts/backfill-dimensional-coverage.ts --limit 10

   # Process specific trace
   npx tsx scripts/backfill-dimensional-coverage.ts --trace-id <trace-id>
   ```

3. **Verify dimensional coverage exists:**
   ```bash
   npx tsx scripts/check-dimensional-coverage.ts
   ```

### Using the Dimensional Coverage Notebook

1. **Open the notebook:**
   - Start Jupyter: `jupyter notebook`
   - Navigate to `notebooks/dimensional_coverage_analysis.ipynb`

2. **Run cells in order:**
   - **Setup:** Load dimensional coverage functions
   - **Summary:** Overall coverage statistics
   - **Patterns:** Coverage rate by dimension
   - **Gaps:** Identify systematically under-covered dimensions
   - **Trace Detail:** Deep-dive into individual trace coverage
   - **Theme Mappings:** Analyze which themes map to which dimensions

3. **Key Analysis Functions:**
   - `load_dimensional_coverage()` - Load all traces with coverage data
   - `analyze_coverage_patterns(df)` - Coverage rate per dimension
   - `find_systematic_gaps(df, threshold=0.5)` - Dimensions covered <50% of the time
   - `get_coverage_summary_stats(df)` - Overall summary metrics
   - `get_theme_to_dimension_mapping(df)` - Theme → dimension relationships

### What to Look For

**Coverage Patterns:**
- Which dimensions are well-covered vs systematically missed?
- Average coverage percentage across all traces
- Number of primary (high confidence) dimensions per trace

**Systematic Gaps:**
- Dimensions covered in <50% of conversations
- May indicate need for proactive questioning in future experiments

**Theme Mappings:**
- Which emergent themes consistently map to which dimensions?
- Are themes mapping to expected dimensions?

**Quality Correlation:**
- Does higher dimensional coverage correlate with better quality ratings?
- Are certain dimensions more predictive of quality than others?
