# Development Workflow

This document outlines the development workflow and best practices for this project.

## Git Workflow

### Branch Strategy

- **`main`** - Production branch. Auto-deploys to production on Vercel.
- **`development`** - Staging branch. Use this for all development work.

### Important: Never Push Directly to Main

**⚠️ CRITICAL:** The `main` branch auto-deploys to production. **Always use the `development` branch for development work.**

```bash
# Switch to development branch
git checkout development

# Make your changes
# ... work on features ...

# Commit your changes
git add .
git commit -m "feat: your feature description"

# Push to development
git push origin development
```

### When to Merge to Main

Only merge `development` to `main` when:
1. Features have been tested on the development deployment
2. All tests pass
3. Code has been reviewed (if applicable)
4. You're ready to deploy to production

```bash
# Merge development into main (for production deployment)
git checkout main
git merge development
git push origin main
```

## Deployment

### Automatic Deployments

- **Production**: Pushes to `main` → Deploys to production on Vercel
- **Preview**: Pushes to `development` → Can be enabled for preview deployments (see `vercel.json`)

### Manual Testing Before Production

Before merging to `main`, test your changes:

1. Push to `development`
2. Test on the development/preview deployment (if enabled)
3. Verify all functionality works as expected
4. Only then merge to `main`

## Development Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Type check
npm run type-check

# Build for production
npm run build

# Start production server
npm start
```

## Code Review Checklist

Before pushing to `development`:

- [ ] Code compiles without errors (`npm run type-check`)
- [ ] Build succeeds (`npm run build`)
- [ ] Manually tested locally
- [ ] Commit messages follow convention (feat:, fix:, docs:, chore:, etc.)

Before merging to `main`:

- [ ] All checks above passed
- [ ] Tested on development/preview environment
- [ ] No console errors or warnings
- [ ] Ready for production deployment

## Common Mistakes to Avoid

1. ❌ **Don't push directly to `main`** - Always use `development` first
2. ❌ **Don't skip testing** - Always test before deploying to production
3. ❌ **Don't commit secrets** - Never commit .env files or API keys
4. ❌ **Don't force push to `main`** - This can break production

## For AI Assistants

When executing plans or making changes:

1. **Always work on the `development` branch**
2. Push completed work to `development`, not `main`
3. Let the human decide when to merge to production
4. Update this file if you discover new workflow patterns
