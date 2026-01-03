# Linear + GitHub Integration Setup

This guide walks through configuring Linear's GitHub integration for automatic PR/issue syncing and workflow automation.

## Current Status

✅ **Connected:** Linear is already connected to GitHub for your workspace.

Now we need to configure:
1. PR automation rules
2. Branch name patterns
3. Commit reference patterns
4. Status syncing

---

## 1. Configure Team Workflow Settings

### In Linear (https://linear.app/humventures):

1. **Go to Team Settings:**
   - Click workspace name (top left)
   - Settings → Teams → Humventures → Workflows

2. **Configure Pull Request Automations:**

   Scroll to "Pull request automations" section. Your settings are already configured:

   - **On draft PR open, move to...** → No action
   - **On PR open, move to...** → **In Progress** ✅
   - **On PR review request or activity, move to...** → **In Review** ✅
   - **On PR ready for merge, move to...** → No action
   - **On PR merge, move to...** → **Done** ✅

   **✅ These settings are perfect! No changes needed.**

3. **Branch-Specific Rules (Optional):**

   You can click "Add branch" to set different rules for specific target branches.

   Example use case: When PR merges to `main` → Move to "Released" instead of "Done"

   This is optional - the default rules above work great for most workflows.

---

## 2. Configure Personal Git Settings

### In Linear (Settings → Account → Preferences):

Scroll to "Automations and workflows" section:

1. **Auto-assign to self** (optional)
   - Toggle ON if you want new issues auto-assigned to you
   - Recommended: Leave OFF for team visibility

2. **Git attachment format**
   - Set to: **"Title"** ✅ (you already have this)
   - This shows branch/PR titles in Linear issues

3. **On git branch copy, move issue to started status** (recommended)
   - Toggle ON: ✅
   - When you copy a branch name from Linear, it auto-moves issue to "In Progress"
   - Saves a manual step when starting work

4. **On move to started status, assign to yourself** (recommended)
   - Toggle ON: ✅
   - Auto-assigns when you start working
   - Good for team visibility of who's working on what

---

## 3. Workflow Example

### Creating a New Feature

1. **Create Linear Issue:**
   ```bash
   npm run linear:issue -- \
     --title "Add user authentication" \
     --description "Implement user auth with NextAuth" \
     --priority high \
     --label chore
   ```

   This creates issue `HUM-9`

2. **Start Work (Automatic):**
   - In Linear, click "Start working" on issue
   - Linear suggests branch name: `HUM-9-add-user-authentication`
   - Copy the branch name

3. **Create Branch:**
   ```bash
   git checkout -b HUM-9-add-user-authentication
   ```

4. **Make Commits:**
   ```bash
   git commit -m "feat: add NextAuth configuration HUM-9"
   git commit -m "test: add auth tests HUM-9"
   ```

   Linear automatically links these commits to the issue.

5. **Create PR:**
   ```bash
   gh pr create --title "Add user authentication" --body "Implements HUM-9"
   ```

   Linear automatically:
   - Links PR to issue
   - Updates issue status to "In Progress"
   - Shows PR status in issue

6. **Merge PR:**
   - When PR merges, Linear automatically:
     - Moves issue to "Done"
     - Marks issue as completed
     - Adds completion timestamp

---

## 4. Commit Message Patterns

Linear recognizes these patterns in commits:

**Standard Reference:**
```
feat: add feature HUM-123
```

**Closing Issues:**
```
fix: resolve bug (fixes HUM-123)
feat: implement feature (closes HUM-123)
```

**Multiple Issues:**
```
refactor: update components HUM-123 HUM-124
```

---

## 5. Testing the Integration

### Test 1: Branch Name Automation

1. Create a Linear issue (or use existing)
2. Create branch with pattern `HUM-X-description`
3. Verify in Linear that issue shows branch badge

**Test command:**
```bash
# Create test issue
npm run linear:issue -- --title "Test GitHub integration" --description "Testing branch linking"

# Create branch (use issue ID from output)
git checkout -b HUM-X-test-github-integration

# Push branch
git push -u origin HUM-X-test-github-integration
```

**Expected:** Issue HUM-X shows branch badge in Linear.

### Test 2: Commit Linking

1. Make a commit referencing the issue
2. Push to GitHub
3. Verify commit appears in Linear issue activity

**Test command:**
```bash
# Make a change
echo "# Test" >> README.md
git add README.md
git commit -m "docs: test Linear integration HUM-X"
git push
```

**Expected:** Commit appears in Linear issue's activity feed.

### Test 3: PR Status Sync

1. Create PR from your test branch
2. Verify Linear issue updates to "In Progress"
3. Merge PR
4. Verify Linear issue moves to "Done" and closes

**Test command:**
```bash
gh pr create --title "Test: GitHub integration" --body "Testing Linear sync for HUM-X"
```

**Expected:**
- PR created → Issue moves to "In Progress"
- PR merged → Issue moves to "Done" and closes

---

## 6. Import Project History

To see past PRs in Linear:

```bash
# Dry run to preview
LINEAR_API_KEY=<key> npx tsx scripts/linear-import-history.ts --dry-run

# Actually import (creates "Project History" project)
LINEAR_API_KEY=<key> npm run linear:import
```

This imports the last 20 merged PRs as completed issues in a "Project History" project.

---

## 7. GitHub → Linear Sync Features

Once configured, Linear automatically:

### From GitHub to Linear:
- **PR opened** → Issue status updated
- **PR merged** → Issue completed
- **PR closed** → Issue status reverted
- **Commits pushed** → Linked to issues
- **Branch created** → Linked to issue

### From Linear to GitHub:
- **Issue assigned** → PR assignee synced
- **Issue status changed** → Visible in PR
- **Issue closed** → PR can auto-close

---

## 8. Best Practices

### Branch Naming
- ✅ `HUM-123-feature-name` (automated)
- ✅ `feature/HUM-123-description`
- ❌ `feature/add-thing` (won't auto-link)

### Commit Messages
- ✅ Include issue ID for auto-linking
- ✅ Use conventional commits format
- ✅ Reference multiple issues if needed

### PR Workflow
- ✅ Create PR from Linear (click "Create branch")
- ✅ Reference issue ID in PR description
- ✅ Let Linear manage status transitions
- ❌ Don't manually update Linear status if PR is open

---

## 9. Troubleshooting

**Issue not linking to PR:**
- Check branch name includes issue identifier (HUM-X)
- Verify PR is on connected repository
- Check team workflow settings enabled

**Commits not showing in Linear:**
- Verify commit message includes issue identifier
- Check personal git preferences enabled
- Push commits to GitHub (Linear reads from GitHub, not local)

**Status not syncing:**
- Verify team workflow automation enabled
- Check issue is in correct team
- Ensure PR is in connected repository

---

## Resources

- **Linear Workspace:** https://linear.app/humventures
- **GitHub Integration Docs:** https://linear.app/docs/github-integration
- **Team Settings:** https://linear.app/humventures/settings/teams

---

**Next Steps:**
1. Configure team workflow settings (section 1)
2. Configure personal git settings (section 2)
3. Run integration test (section 5)
4. Import project history (section 6)
