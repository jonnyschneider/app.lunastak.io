# Linear Integration

LunaStack uses [Linear](https://linear.app/humventures) for backlog management - tracking technical chores, infrastructure work, and future experiments separate from active development.

## Quick Start

### 1. Setup (One-time)

Run the setup script to create projects and labels:

```bash
LINEAR_API_KEY=<your-key> npm run linear:setup
```

This creates:
- **Projects:** Infrastructure Backlog, E3, E4
- **Labels:** chore, experiment, documentation, automation
- **Sample Issues:** Test coverage, CI/CD automation, etc.

### 2. Create Issues

```bash
LINEAR_API_KEY=<your-key> npm run linear:issue -- \
  --title "Issue title" \
  --description "Issue description" \
  [--project "Infrastructure Backlog"] \
  [--priority medium] \
  [--label chore]
```

**Example:**
```bash
LINEAR_API_KEY=<your-key> npm run linear:issue -- \
  --title "Add integration tests for API routes" \
  --description "Create comprehensive integration tests for all API endpoints" \
  --priority high \
  --label chore \
  --label automation
```

## Options

### Priority Levels
- `urgent` (1) - Critical, blocking issues
- `high` (2) - Important, should be done soon
- `medium` (3) - **Default** - Normal priority
- `low` (4) - Nice to have
- `none` (0) - Backlog

### Available Labels
- `chore` - Technical tasks, refactoring, tests
- `experiment` - Experiment implementation
- `documentation` - Documentation updates
- `automation` - Deployment, CI/CD improvements
- `Bug` - Built-in Linear label

### Available Projects
- **Infrastructure Backlog** (default) - Technical chores and improvements
- **E3: Proactive Gap-Based Questioning** - Future experiment
- **E4: LLM-as-Judge Training** - Future experiment

## API Key

Your Linear API key is stored in `.env.local`:

```
LINEAR_API_KEY=lin_api_...
```

Create a new API key at: https://linear.app/settings/api

## Integration with GitHub

Linear integrates with GitHub automatically:
- **Branch names:** Use Linear issue IDs in branch names (e.g., `feature/HUM-8-test-issue`)
- **Commits:** Reference issues in commits (e.g., `feat: add tests HUM-8`)
- **PRs:** Linear issues update when PRs are merged

## Workflow

### For Technical Chores

1. **Create issue** for the chore
2. **Assign to yourself** in Linear
3. **Create branch:** `chore/HUM-X-description`
4. **Implement and test**
5. **PR with reference:** PR description mentions `HUM-X`
6. **Linear updates** automatically when PR merges

### For Experiments

1. **Create project** for the experiment (e.g., E5)
2. **Break down** into issues (design, implementation, testing, documentation)
3. **Execute in order** using standard workflow
4. **Track progress** in Linear project view

## Scripts

- `npm run linear:setup` - Initial workspace setup
- `npm run linear:issue` - Create new issue

All scripts are in `scripts/`:
- `linear-setup.ts` - Workspace configuration
- `linear-create-issue.ts` - Issue creation helper

## Resources

- **Linear Workspace:** https://linear.app/humventures
- **Linear Docs:** https://linear.app/docs
- **Linear API:** https://developers.linear.app/docs/graphql/working-with-the-graphql-api
