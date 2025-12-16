# E1a Testing Plan

## Manual Testing Checklist

### Local Development Testing

1. **Statsig Configuration**
   - [ ] Set STATSIG_SERVER_SECRET_KEY in .env.local
   - [ ] Create feature gate 'emergent_extraction_e1a' in Statsig dashboard
   - [ ] Set gate to 0% rollout initially

2. **Baseline-v1 Flow (Control)**
   - [ ] Start new conversation with gate OFF
   - [ ] Verify conversation tagged with 'baseline-v1'
   - [ ] Complete 3-5 question flow
   - [ ] Verify extraction shows prescriptive fields (industry, target_market, unique_value)
   - [ ] Verify generation produces Vision/Mission/Objectives
   - [ ] Verify UI displays prescriptive schema correctly

3. **Emergent-e1a Flow (Variant)**
   - [ ] Enable feature gate for test user
   - [ ] Start new conversation
   - [ ] Verify conversation tagged with 'emergent-extraction-e1a'
   - [ ] Complete 3-5 question flow
   - [ ] Verify extraction shows emergent themes (3-7 themes with custom names)
   - [ ] Verify generation uses emergent themes
   - [ ] Verify UI displays themes in card format
   - [ ] Verify reflective summary appears in both variants

4. **Edge Cases**
   - [ ] Test very short conversation (2 questions) - both variants
   - [ ] Test long conversation (8-10 questions) - both variants
   - [ ] Test conversation with very specific business vs. vague business
   - [ ] Verify graceful fallback if Statsig unavailable

### Database Verification

- [ ] Check Conversation.experimentVariant is set correctly
- [ ] Check Trace.extractedContext has correct schema
- [ ] Verify both schemas can be stored in JSON field
- [ ] Query traces by experiment variant

### API Contract Testing

- [ ] `/api/conversation/start` returns correct variant
- [ ] `/api/extract` returns appropriate schema based on variant
- [ ] `/api/generate` accepts both schema types
- [ ] `/api/conversation/assess-confidence` works with both variants

## Integration Test Cases

### Test 1: Baseline-v1 End-to-End

```typescript
// Pseudo-test
// 1. Mock Statsig to return false for emergent gate
// 2. Start conversation
// 3. Assert experimentVariant === 'baseline-v1'
// 4. Continue conversation
// 5. Extract context
// 6. Assert extraction has core.industry, core.target_market, core.unique_value
// 7. Generate strategy
// 8. Assert output has vision, mission, objectives
```

### Test 2: Emergent-e1a End-to-End

```typescript
// Pseudo-test
// 1. Mock Statsig to return true for emergent gate
// 2. Start conversation
// 3. Assert experimentVariant === 'emergent-extraction-e1a'
// 4. Continue conversation
// 5. Extract context
// 6. Assert extraction has themes[] array
// 7. Assert themes have theme_name and content
// 8. Generate strategy
// 9. Assert output has vision, mission, objectives
```

## Pre-Deployment Checklist

- [ ] Type check passes: `npm run type-check`
- [ ] Build succeeds: `npm run build`
- [ ] Manual testing complete (all checkboxes above)
- [ ] Statsig dashboard configured correctly
- [ ] Feature gate set to 0% rollout
- [ ] Environment variables documented
- [ ] Experiment register updated
