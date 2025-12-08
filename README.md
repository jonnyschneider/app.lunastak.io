# Decision Coach Agent V4

A conversational AI agent that helps users develop business strategies through adaptive questioning and context extraction.

## Features

- Multi-lens decision-making framework (Lenses A-E)
- Adaptive conversation flow based on confidence scoring
- Context extraction and strategy generation
- Full conversation tracing and analytics
- User feedback collection

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
   ```
   DATABASE_URL=postgresql://...
   ANTHROPIC_API_KEY=your_api_key_here
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

- [Development Plan](readme/V4_DEVELOPMENT_PLAN.md)
- [Project Status](readme/PROJECT_STATUS.md)
- [Feature Backlog](readme/FEATURE_BACKLOG.md)
- [Trace Analysis Guide](notebooks/README.md)

## License

Proprietary
