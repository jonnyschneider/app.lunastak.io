# Decision Coach Agent V4

**Current Version:** v1.2.0 (unreleased)

A conversational AI agent that helps founders and business leaders develop strategic clarity through adaptive conversations, document analysis, and structured strategy generation.

## Features

### Cold Start Entry Points (v1.2.0)
- **Guided Conversation** - Adaptive 3-10 question flow with confidence scoring
- **Document Upload** - Extract context from PDFs, DOCX, TXT, MD files
- **Start from Canvas** - Visual strategy builder (fake door validation)
- **Fast Track** - Quick multiple choice (fake door validation)

### Adaptive Conversation System
- 3-10 questions based on confidence assessment
- Multiple extraction approaches (prescriptive, emergent)
- Experiment framework for A/B testing (Statsig integration)
- Reflective summaries identify strengths and gaps

### Strategy Output
- Vision statements (aspirational, future-focused)
- Strategy statements (coherent choices)
- SMART objectives with visual metrics
- Initiatives and principles (placeholder generation)

### Developer Tools
- Regeneration scripts for testing (`npm run regen`)
- Remote API for preview/prod regeneration
- Full conversation tracing and analytics
- Quality rating and feedback collection

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Anthropic API key

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env.local` file:
   ```bash
   # Database
   DATABASE_URL=postgresql://...

   # AI Services
   ANTHROPIC_API_KEY=your_anthropic_key
   UNSTRUCTURED_API_KEY=your_unstructured_key  # For document upload

   # Experiments (optional)
   STATSIG_SERVER_SECRET_KEY=your_statsig_key  # For A/B testing
   ```

3. **Initialize database:**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. **Run development server:**
   ```bash
   npm run dev
   ```

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

## Project Structure

```
/src                 # Application source code
/prisma              # Database schema
/scripts             # Python helper modules for analysis
/notebooks           # Jupyter notebooks for trace analysis
/docs                # Documentation
/readme              # Project planning documents
```

## Documentation

### For Contributors
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Development workflow, documentation structure, git strategy
- **[CHANGELOG.md](CHANGELOG.md)** - Version history and release notes
- **[scripts/README.md](scripts/README.md)** - Regeneration scripts and developer tools

### Design & Implementation
- **[docs/plans/](docs/plans/)** - Design docs and implementation plans for all features
- **[docs/session-notes/](docs/session-notes/)** - Notes from unplanned/iterative work

### Research & Analysis
- **[Trace Analysis Guide](notebooks/README.md)** - Jupyter notebooks for qualitative analysis
- **[Experiment Register](docs/experiments/EXPERIMENT_REGISTER.md)** - A/B test tracking

## License

Proprietary
