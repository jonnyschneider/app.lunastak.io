---
Last edited time: 2025-03-13T19:21
Archive: false
Date: 2025-02-27
Favourite: false
Projects:
  - "[[Notes-archive/Notion-2022-2025/Second Brain/Projects/Decision Stack AI Prototype\\|Decision Stack AI Prototype]]"
Status: Draft
---
## Purpose and intent

### For users

It’s an amuse buche for strategy development. A way to ‘warm up’, and get started on strategic thinking.

### For Humble Ventures

**Primary**

It’s a lead magnet. Something that delivers enough value to capture an email and start a conversation.

**Secondary**

- A consulting tool. e.g. a takeaway activity before/after strategy facilitation.
- Teaching. e.g. teaching Decision Stack workshops

### For Martin

Anything to add?

### What it isn’t

- ‘Automated Strategy’
- Deep dive into specific details
- …

## The Basic UX

1. Ask initial open-ended questions—just as we do with founders to understand their business.
    
    1. Scraping existing assets like the website, strategy deck, etc? [ME]
    2. Play “Principles Game” - choosing a series of trade-offs? [ME]
    
    ![[image 25.png|image 25.png]]
    
    1. Interactive, snappy example, based on real or fictious. Warm up. No effort to user.
2. Ask clarifying, probing questions to get the keystone details.
    1. Use either the Kernel or Playing to Win Cascade to structure strategic challenge? [ME]
3. Present a Visual model of the Decision stack, with some parts completed.
4. Show the thinking, provide a critique, and suggest other lines of questioning if they user wants to iterate.

  

## Inspiration and reference

[https://www.gumloop.com/](https://www.gumloop.com/)

  

### Use Cases

- **Top Down**
    1. **Vision** → **Strategy** → **Objectives**
    2. Then take it to your teams to elaborate on the Initiatives
- **Bottom Up**
    1. Summarise all the **Initiatives** that are WIP in the company.
        1. What’s the work, outcome, for who, why.
        2. A few basic firmographics to define the company
    2. Then generate Vision, Strategy, and Objectives to see if the actual work aligns to goals that matter

## Technology

### Stack

- Anthropic API Claude 3.7
- Perplexity to search/scrape existing content? [ME]
- Python and Jupyter Notebook for prompt engineering in `dev` environment
- Github for source control and deployment automation
- Vercent for `prod` environment
- Node.js
- Tailwind CSS

### Tech Approach

- Build out a set of keystone inputs needed to generate a minimum meaningful Decision Stack
- Ask initial questions one at a time, using the response to inform the next (prompt chaining)
- Take the outputs from questions into prompt with context training that generates the the component parts for a decision stack
- Use Node to present the data in the visual structure of The Decision Stack