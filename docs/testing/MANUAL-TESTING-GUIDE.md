# Manual Testing Guide - Adaptive Conversation Flow

**Purpose:** This guide provides step-by-step instructions for manually testing the adaptive conversation flow end-to-end.

**Prerequisites:**
- Dev server running: `npm run dev`
- Database running and migrated: `npm run prisma:push`
- Browser open to: http://localhost:3000

---

## Quick Test Checklist

Use this checklist to track your manual testing progress:

- [ ] **Test 1:** INITIAL → LENS_SELECTION transition
- [ ] **Test 2:** Lens A (Customer) questioning flow
- [ ] **Test 3:** Lens C (Industry) questioning flow
- [ ] **Test 4:** Confidence assessment and early exit offer
- [ ] **Test 5:** Accept early exit (type "B")
- [ ] **Test 6:** Reject early exit (type "A")
- [ ] **Test 7:** Extraction with enrichment display
- [ ] **Test 8:** Exploration resume (click "Explore further")
- [ ] **Test 9:** Max 10 questions auto-extraction
- [ ] **Test 10:** Invalid lens input handling
- [ ] **Test 11:** Database verification via Prisma Studio

---

## Test 1: INITIAL → LENS_SELECTION Flow

**What you're testing:** The first phase transition

**Steps:**
1. Open http://localhost:3000
2. Click "Start New Conversation"
3. Type: "We build AI-powered tools for content creators to automate their video editing workflow"
4. Press Enter or click Submit

**What to verify:**
- ✓ Your message appears in the chat
- ✓ Assistant responds with an acknowledgment that references your input
- ✓ Lens selection options appear (A through E)
- ✓ Input placeholder changes to "Type A, B, C, D, or E..."
- ✓ No errors in browser console

**Expected acknowledgment example:**
> "Thanks for sharing that. It sounds like you're helping creators save time on a really time-intensive part of their workflow."

**Expected lens options:**
```
What do you know the most about?

A) Your customers
B) Your domain/operations
C) Your industry/market
D) Your product/technology
E) Let AI guide me

Type the letter of your choice (A, B, C, D, or E):
```

---

## Test 2: Lens A (Customer) Questioning Flow

**What you're testing:** Customer-lens framed questioning

**Steps:**
1. Continue from Test 1
2. Type: "A"
3. Press Enter

**What to verify:**
- ✓ First question is: "What problem do you solve, or opportunity do you create for customers?"
- ✓ Question feels conversational
- ✓ Input placeholder returns to "Type your response..."

**Continue the conversation:**
4. Answer the question with: "We solve the problem of YouTubers spending 4-6 hours editing each video when they could be creating more content"
5. Observe the next question

**What to verify:**
- ✓ Next question references your previous answer
- ✓ Question maintains customer-centric framing
- ✓ Examples: asks about customer segments, pain points, value they get

---

## Test 3: Lens C (Industry) Questioning Flow

**What you're testing:** Industry-lens framed questioning

**Steps:**
1. Start a NEW conversation (refresh page or create new)
2. Give initial description
3. When prompted for lens, type: "C"
4. Press Enter

**What to verify:**
- ✓ First question is: "What makes your product different and better than others?"
- ✓ Question feels conversational

**Continue the conversation:**
5. Answer with competitive/market context
6. Observe next question

**What to verify:**
- ✓ Next question references competitive positioning
- ✓ Question maintains industry/market framing
- ✓ Examples: asks about competitors, differentiation, market dynamics

---

## Test 4: Confidence Assessment & Early Exit Offer

**What you're testing:** Confidence scoring and early exit logic

**Steps:**
1. Start a NEW conversation
2. Select any lens (A recommended)
3. Answer THREE questions with DETAILED, SPECIFIC responses

**Sample detailed responses:**
- Q1: "Our target customers are mid-tier YouTubers with 10k-100k subscribers who post weekly video content"
- Q2: "They spend 4-6 hours per video on editing - cutting, adding captions, creating thumbnails - which prevents them from scaling their content output"
- Q3: "We're unique because our AI learns each creator's specific editing style from their past videos, so edits feel authentic to their brand rather than generic"

**What to verify:**
- ✓ After answering 3rd question, system may offer early exit (if confidence is HIGH)
- ✓ Early exit message: "I think I have what I need to create your strategy. Would you like to: A) Continue exploring B) Generate strategy"

**Note:** If you don't get early exit after question 3:
- This means confidence was MEDIUM or LOW
- Continue answering with MORE detail
- You should eventually get the offer (or hit the max of 10 questions)

---

## Test 5: Accept Early Exit

**What you're testing:** Early exit acceptance flow

**Steps:**
1. Continue from Test 4 (when early exit is offered)
2. Type: "B"
3. Press Enter

**What to verify:**
- ✓ Transition message appears: "We've covered a lot of ground. Let me show you what I've captured..."
- ✓ Extraction confirmation screen loads
- ✓ See "Core Fields" section
- ✓ See "Additional Context" section (if applicable)
- ✓ See "Reflection" section with blue background
- ✓ Two buttons: "Generate my strategy" and "Explore further"

---

## Test 6: Reject Early Exit (Continue Exploring)

**What you're testing:** Continuing after early exit offer

**Steps:**
1. Start a NEW conversation
2. Answer questions until early exit offered
3. Type: "A" (Continue exploring)
4. Press Enter

**What to verify:**
- ✓ System asks another question
- ✓ Conversation continues naturally
- ✓ Can answer more questions
- ✓ May be offered early exit again later

---

## Test 7: Extraction with Enrichment Display

**What you're testing:** Enrichment and reflective summary display

**Steps:**
1. Continue from Test 5 or complete a conversation to extraction
2. Carefully review the extraction screen

**What to verify in Core Fields:**
- ✓ Industry (specific, not "technology" or "software")
- ✓ Target Market (specific customer segment)
- ✓ Unique Value (clear differentiator)
- ✓ Values accurately reflect conversation

**What to verify in Additional Context:**
- ✓ Section appears IF you discussed competitive/operational/technical details
- ✓ Fields like:
  - Competitive Context
  - Customer Segments (if multiple mentioned)
  - Operational Capabilities
  - Technical Advantages
- ✓ Values make sense based on conversation

**What to verify in Reflection section:**
- ✓ Blue background styling
- ✓ "What's Clear" - lists 2-3 strong points
- ✓ "What's Emerging" - lists 1-2 areas with some clarity
- ✓ "What's Unexplored" - lists 1-2 gaps or opportunities
- ✓ Optional thought prompt (blue-bordered box)
- ✓ Content feels insightful, not generic

---

## Test 8: Exploration Resume

**What you're testing:** Returning to questioning from extraction

**Steps:**
1. Continue from Test 7
2. Click "Explore further" button

**What to verify:**
- ✓ Returns to chat interface
- ✓ Input field becomes active
- ✓ Can type and submit responses
- ✓ System may ask a new question OR use the thought prompt from reflection
- ✓ Question count continues (doesn't reset)

**Continue:**
3. Answer 1-2 more questions
4. Return to extraction

**What to verify:**
- ✓ Extraction updates with new information
- ✓ Reflective summary may change
- ✓ Can toggle between exploring and extracting

---

## Test 9: Maximum 10 Questions

**What you're testing:** Automatic extraction at question limit

**Steps:**
1. Start a NEW conversation
2. Select any lens
3. Answer questions with MODERATE detail (not too detailed, to avoid early exit)
4. Keep answering until you hit question 10

**Strategy to avoid early exit:**
- Give answers that are somewhat specific but leave room for more detail
- Example: "We target YouTubers" (not as detailed as "10k-100k subscriber YouTubers who post weekly")

**What to verify:**
- ✓ After answering question 10, automatic transition to extraction
- ✓ Message: "We've covered a lot of ground. Let me show you what I've captured..."
- ✓ NO early exit offer on question 10 (should go straight to extraction)
- ✓ Extraction screen loads with all 10 questions worth of context

**Note:** This may take 10-15 minutes. You can use simple responses to speed it up.

---

## Test 10: Invalid Lens Input Handling

**What you're testing:** Input validation for lens selection

**Steps:**
1. Start a NEW conversation
2. Give initial response
3. When prompted for lens, type: "X"
4. Press Enter

**What to verify:**
- ✓ Error message: "Please type A, B, C, D, or E to select your lens."
- ✓ Stays in lens selection (doesn't break)
- ✓ Can try again

**Try valid input:**
5. Type: "a" (lowercase)
6. Press Enter

**What to verify:**
- ✓ Accepts lowercase letter (case-insensitive)
- ✓ Proceeds to questioning phase

---

## Test 11: Database Verification via Prisma Studio

**What you're testing:** Data persistence in database

**Steps:**
1. Complete at least one full conversation (Tests 1-5)
2. Open a new terminal
3. Run: `npm run prisma:studio`
4. Browser opens to Prisma Studio (usually http://localhost:5555)

**In Conversation table:**
5. Find your test conversation
6. Click to view details

**What to verify:**
- ✓ `currentPhase` field shows "EXTRACTION" (if completed) or current phase
- ✓ `selectedLens` field shows your chosen lens (A, B, C, D, or E)
- ✓ `questionCount` field shows correct number of questions asked
- ✓ `status` field shows "in_progress" or "completed"

**In Message table:**
7. Filter by your conversation ID
8. Review messages

**What to verify:**
- ✓ All user and assistant messages saved
- ✓ `stepNumber` increments correctly
- ✓ User messages during QUESTIONING phase have:
  - `confidenceScore` (HIGH, MEDIUM, or LOW)
  - `confidenceReasoning` (text explanation)
- ✓ Assistant messages do NOT have confidence scores (should be null)
- ✓ Messages are in correct chronological order

---

## Common Issues & Troubleshooting

### Issue: Dev server not starting
**Fix:** Check if port 3000 is already in use. Kill existing process or use different port.

### Issue: Database connection error
**Fix:** Verify `.env.local` has `DATABASE_URL` set correctly. Run `npm run prisma:push`.

### Issue: "TypeError: Cannot read property..."
**Fix:** Hard refresh browser (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows). Clear Next.js cache: `rm -rf .next && npm run dev`.

### Issue: Confidence assessment taking too long
**Expected:** 1-3 seconds per assessment. If longer, check Claude API status and rate limits.

### Issue: Extraction not showing enrichment
**Expected behavior:** Enrichment only shows if you discussed those specific topics. Try mentioning competitors explicitly.

### Issue: No early exit offered even with detailed answers
**Expected behavior:** System requires minimum 3 questions. After that, it depends on confidence assessment. Some conversations naturally need more context.

### Issue: Prisma Studio shows old data
**Fix:** Refresh the page in Prisma Studio. Data updates in real-time but may need manual refresh.

---

## Testing Tips

1. **Use realistic inputs:** The better your test inputs mimic real users, the better you'll evaluate the system.

2. **Test edge cases:** Try very short answers, very long answers, off-topic answers.

3. **Test different lenses:** Each lens should feel different. If they all feel the same, that's a bug.

4. **Monitor console:** Keep browser console open. Note any warnings or errors.

5. **Test on different browsers:** Try Chrome, Firefox, Safari if possible.

6. **Time the interactions:** Note if anything feels slow. Aim for <3s response times.

---

## After Testing

Once you've completed manual testing:

1. Update `2025-12-08-adaptive-flow-test-results.md` with:
   - Test statuses (change ⚠️ to ✅ or ❌)
   - Issues found
   - Screenshots if helpful

2. Create GitHub issues for any bugs found

3. Update this guide if you found better test scenarios

4. Share feedback on UX improvements

---

**Happy Testing!**
