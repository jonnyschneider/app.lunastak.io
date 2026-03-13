# Lunastak Intelligence Pipeline

Two diagrams describing how Lunastak transforms unstructured conversation into strategy artefacts.

1. **Blueprint** — User journey + system architecture (what happens, in what order)
2. **Data Architecture** — Entity relationships (what data exists, how it connects)

---

## 1. Blueprint: User Journey + Intelligence Pipeline

```mermaid
graph LR
    classDef user fill:#fffde7,stroke:#f9a825,color:#333
    classDef llm fill:#e3f2fd,stroke:#1565c0,color:#333
    classDef data fill:#f3e5f5,stroke:#7b1fa2,color:#333
    classDef output fill:#e8f5e9,stroke:#2e7d32,color:#333
    classDef invisible fill:none,stroke:none

    %% ─── USER ACTIONS ───
    subgraph USER ["What the User Does"]
        direction LR
        U1[Start Conversation]:::user
        U2[Upload Document]:::user
        U3[Fill Template]:::user
        U4[View Strategy]:::user
        U5[Have Follow-up\nConversation]:::user
        U6[Refresh Strategy]:::user
    end

    %% ─── STRUCTURING ───
    subgraph STRUCTURE ["Layer 1 · Structuring — conversation → structured data"]
        direction LR
        S1["◆ Extract Themes\n/api/extract\n(3–7 themes per conversation)"]:::llm
        S2["◆ Extract from Document\nprocessDocument()\n(3–10 themes per doc)"]:::llm
        S3["□ Save Directly\n/api/template-entry\n(no LLM needed)"]:::data
        S4["□ Create Fragments\n+ Tag with Dimensions\n(1 fragment per theme,\n1–3 dimension tags each)"]:::data
    end

    %% ─── MEANING-MAKING ───
    subgraph MEANING ["Layer 2 · Meaning-Making — structured data → understanding"]
        direction LR
        M1["◆ Dimensional Synthesis\nupdateAllSyntheses()\n× up to 11 dimensions\n\nsummary · key themes · gaps\ncontradictions · confidence"]:::llm
        M2["◆ Knowledge Summary\ngenerateKnowledgeSummary()\n\nnarrative summary\nsuggested questions\ndimension gap questions"]:::llm
    end

    %% ─── OUTPUT ───
    subgraph OUTPUT ["Layer 3 · Output — understanding → strategy artefacts"]
        direction LR
        O1["◆ Generate Strategy\n(initial, via extract pipeline)\n\nInput: fragments from DB\n(created earlier in pipeline)\n\n→ Vision, Strategy,\n   Objectives"]:::llm
        O2["◆ Refresh Strategy\n/api/refresh-strategy\n\nInput: previous strategy\n+ dimensional syntheses\n+ new/archived fragments\n\n→ Updated Decision Stack"]:::llm
    end

    %% ─── FLOW ───
    U1 --> S1
    U2 --> S2
    U3 --> S3
    S1 --> S4
    S2 --> S4

    S4 -->|"full extraction\n(initial chat, doc upload)"| M1
    S4 -.->|"lightweight\n(side chat)"| SKIP["Fragments stored.\nNo synthesis triggered."]:::invisible
    M1 --> M2

    S4 -->|"fragments read\nfrom DB"| O1
    M1 -->|"dimensional summaries\nfed to prompt"| O2
    M2 -->|"knowledgeUpdatedAt\nreset only"| O2
    S3 --> O1

    U5 --> S1
    U6 --> O2

    O1 --> U4
    O2 --> U4
```

---

## 2. Data Architecture: Entity Relationships

```mermaid
erDiagram
    PROJECT ||--o{ CONVERSATION : has
    PROJECT ||--o{ DOCUMENT : has
    PROJECT ||--o{ FRAGMENT : accumulates
    PROJECT ||--|{ DIMENSIONAL_SYNTHESIS : "has × 11"
    PROJECT {
        string knowledgeSummary "narrative summary (LLM-generated)"
        json suggestedQuestions "provocations from gaps"
        datetime knowledgeUpdatedAt "reset by full extract or refresh"
    }

    CONVERSATION ||--o{ MESSAGE : contains
    CONVERSATION ||--o{ FRAGMENT : "extracted into"
    CONVERSATION ||--o| TRACE : "produces (via generate)"

    DOCUMENT ||--o{ FRAGMENT : "extracted into"

    FRAGMENT ||--|{ DIMENSION_TAG : "tagged with 1–3"
    FRAGMENT {
        string content "theme name + summary text"
        string contentType "theme | insight | quote"
        string confidence "HIGH | MEDIUM | LOW"
        string status "active | archived | soft_deleted"
    }

    DIMENSION_TAG {
        string dimension "one of 11 strategic dimensions"
        string confidence "HIGH | MEDIUM | LOW"
    }

    DIMENSIONAL_SYNTHESIS {
        string dimension "CUSTOMER_MARKET etc."
        string summary "LLM narrative per dimension"
        string[] keyThemes "main ideas"
        string[] keyQuotes "verbatim quotes"
        json gaps "what is missing"
        string[] contradictions "tensions"
        string confidence "HIGH | MEDIUM | LOW"
        int fragmentCount "how many fragments contribute"
    }

    TRACE ||--|| GENERATED_OUTPUT : "stored alongside"
    TRACE {
        json extractedContext "fragment metadata (source, count, content)"
        json output "vision + strategy + objectives"
        string claudeThoughts "LLM reasoning (shown in UI)"
    }

    GENERATED_OUTPUT ||--o{ STRATEGY_VERSION : "seeds per-component"
    GENERATED_OUTPUT {
        json content "full StrategyStatements"
        int version "increments on refresh"
        string status "generating | complete | failed"
        string previousOutputId "version chain for refresh"
        string changeSummary "what changed and why"
    }

    STRATEGY_VERSION {
        string componentType "vision | strategy | objective"
        string componentId "for objectives only"
        json content "component-specific content"
        string createdBy "ai | user"
        string sourceType "generation | template | edit"
    }
```

---

## 3. What the User Sees vs What's Hidden

```mermaid
graph TD
    classDef visible fill:#e8f5e9,stroke:#2e7d32,color:#333
    classDef hidden fill:#ffebee,stroke:#c62828,color:#333
    classDef source fill:#fff,stroke:#999,color:#333

    subgraph VISIBLE ["Visible to User"]
        V1["Knowledge Summary\n(Project Page)"]:::visible
        V2["Suggested Questions\n(Project Page)"]:::visible
        V3["'N new insights' badge\n(Project Page)"]:::visible
        V4["Vision / Strategy / Objectives\n(Strategy Page)"]:::visible
        V5["Luna's Reasoning\n(Strategy Page)"]:::visible
        V6["Key Themes\n(Strategy Page)"]:::visible
    end

    subgraph HIDDEN ["Hidden from User — consumed only by LLM"]
        H1["Dimensional Synthesis × 11\nsummary · gaps · contradictions\nconfidence"]:::hidden
        H2["Fragment Dimension Tags\nused for bucketing only"]:::hidden
        H3["Confidence Scores\nHIGH / MEDIUM / LOW"]:::hidden
    end

    %% Sources
    KS[Project.knowledgeSummary]:::source --> V1
    SQ[Project.suggestedQuestions]:::source --> V2
    FN["Fragments since\nknowledgeUpdatedAt"]:::source --> V3
    GO[GeneratedOutput.content]:::source --> V4
    CT[Trace.claudeThoughts]:::source --> V5
    EC[Trace.extractedContext.themes]:::source --> V6

    DS[DimensionalSynthesis]:::source --> H1
    DT[FragmentDimensionTag]:::source --> H2
    CF["Fragment.confidence +\nDimensionalSynthesis.confidence"]:::source --> H3

    H1 -->|"fed to /refresh-strategy\nprompt as context"| RS["Refresh Strategy\n(only consumer)"]:::source
```

---

## Key

| Symbol | Meaning |
|--------|---------|
| ◆ | LLM call (non-deterministic) |
| □ | Deterministic operation |
| → solid arrow | Always happens |
| ⇢ dashed arrow | Conditional / skipped |

### LLM Calls in the Pipeline (ordered)

| Step | Prompt | Input | Output |
|------|--------|-------|--------|
| Extract | `EMERGENT_EXTRACTION_PROMPT` | Conversation text | 3–7 themes with dimension tags |
| Synthesis | `FULL_SYNTHESIS_PROMPT` × 11 | Fragments per dimension | Summary, themes, gaps, confidence |
| Knowledge Summary | `KNOWLEDGE_SUMMARY_PROMPT` | Up to 50 fragments | Narrative + suggested questions |
| Generate (initial) | Generation prompt (versioned) | Active fragments from DB (created earlier in pipeline) | Vision, Strategy, Objectives |
| Refresh | `STRATEGY_UPDATE_PROMPT` | Previous strategy + syntheses + delta fragments | Updated Decision Stack |
