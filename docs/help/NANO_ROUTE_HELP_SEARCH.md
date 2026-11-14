# NANO ROUTE — HELP SEARCH SPECIFICATION
## Step 63 Offline Lexical Search Engine & Relevance Ranking

---

## 1. DESIGN OBJECTIVE

The search system is engineered for local-first desktop environments:
- **Zero latency**: Sub-millisecond synchronous evaluation across bundled articles.
- **Zero network**: Never transmits user search queries across the internet.
- **Deterministic**: Produces identical results and ordering across runs.
- **Zero Hallucination**: Only surfaces factual, verified articles bundled with the application.

---

## 2. RELEVANCE SCORING FORMULA

Given a user query string $Q$, the query is normalized to lowercase alphanumeric tokens $T = \{t_1, t_2, \dots, t_n\}$.

Each candidate article $A$ receives a cumulative score $S(A)$ calculated as:

$$\begin{aligned}
S(A) &= 100 \cdot \mathbb{I}(\text{title} = Q) \\
     &+ 40 \cdot \mathbb{I}(Q \subset \text{title}) \\
     &+ 20 \cdot \sum_{t \in T} \mathbb{I}(t \subset \text{title}) \\
     &+ 25 \cdot \sum_{k \in \text{keywords}} \mathbb{I}(Q = k \lor Q \subset k) \\
     &+ 15 \cdot \sum_{t \in T} \sum_{k \in \text{keywords}} \mathbb{I}(t \subset k) \\
     &+ 8 \cdot \sum_{t \in T} \mathbb{I}(t \subset \text{summary}) \\
     &+ 3 \cdot \sum_{t \in T} \mathbb{I}(t \subset \text{body})
\end{aligned}$$

---

## 3. TIE-BREAKING & EMPTY STATES

- Matches are sorted in descending order of score ($S(A)$).
- Equal scores tie-break alphabetically by article title.
- If $Q$ produces zero matches ($S(A) = 0$ for all $A$), the UI displays an empty state providing keyword suggestions and a direct action button to launch the **Diagnostics Center**.

