# NANO ROUTE — DOMAIN TAXONOMY SPECIFICATION
## Multi-Domain Classification, Canonical Categories & Boundaries (Step 28 of 90)

---

## 1. Executive Summary

This specification defines the 14 operational domain categories used by Nano Route's on-device Task Analysis Engine.

**Domain vs. Intent:**
- **Intent (Step 27):** What the user wants done (e.g. `summarization`, `software_engineering`).
- **Domain (Step 28):** The subject matter knowledge area involved (e.g. `business`, `research`, `mathematics`).

Nano Route supports multi-domain requests, identifying a `primary_domain` alongside ranked `secondary_domains`.

---

## 2. Canonical Domain Specifications

| Canonical ID | Display Name | Definition & Work Area | Typical Vocabulary |
|---|---|---|---|
| `software_engineering` | Software Engineering | Programming, systems architecture, debugging | `code`, `rust`, `python`, `react`, `fn`, `struct`, `api` |
| `mathematics` | Mathematics & Logic | Pure & applied mathematics, logic proofs | `proof`, `theorem`, `eigenvalue`, `matrix`, `derivative` |
| `research` | Research & Academia | Academic exploration, literature review | `survey`, `literature review`, `paper`, `comparative study` |
| `long_form_writing` | Long-Form Writing | Professional or literary prose | `essay`, `cover letter`, `proposal`, `formal article` |
| `business` | Business & Finance | Commercial operations, strategy, finance | `revenue`, `sales`, `quarterly`, `roi`, `executive`, `market` |
| `data_analysis` | Data Analysis | Tabular datasets, statistics, metrics | `csv`, `table`, `metrics`, `trend`, `correlation`, `outlier` |
| `education` | Education & Tutoring | Teaching, beginner explanations, pedagogy | `explain for beginner`, `tutorial`, `teach me`, `basics` |
| `translation` | Translation | Linguistic translation between languages | `translate`, `in French`, `to Urdu`, `spanish`, `tarjuma` |
| `planning` | Planning & Strategy | Roadmaps, schedules, project breakdowns | `roadmap`, `migration plan`, `timeline`, `phases`, `milestones` |
| `technical_documentation` | Technical Documentation | Specs, READMEs, API documentation | `readme`, `api docs`, `specification`, `architecture guide` |
| `creative` | Creative Writing | Fiction, poetry, worldbuilding, scripts | `story`, `poem`, `cyberpunk`, `character`, `dialogue` |
| `general` | General Knowledge | Everyday chit-chat, greetings, trivia | `hello`, `how are you`, `fun fact`, `daily tips` |
| `other` | Other Domain | Tasks outside the primary 12 areas | Cooking recipes, fitness plans, gardening |
| `unknown` | Unknown Domain | Undecidable or under-specified prompts | `help`, `do something`, vague inquiries |

---

## 3. Multi-Domain Workload Examples

1. *"Build a financial forecasting dashboard in Python and calculate quarterly ROI."*
   - **Primary Domain:** `software_engineering`
   - **Secondary Domains:** `[business, data_analysis]`
2. *"Summarize this research paper on quantum error correction for high school students."*
   - **Primary Domain:** `research`
   - **Secondary Domains:** `[education]`
3. *"Draft an executive migration roadmap for our microservices architecture."*
   - **Primary Domain:** `planning`
   - **Secondary Domains:** `[software_engineering, business]`

