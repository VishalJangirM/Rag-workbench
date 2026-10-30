# RAG Insights Platform

# Build RAGBench — RAG Evaluation & Benchmarking Platform

Build a polished, production-style frontend for an AI engineering platform called **RAGBench**.

RAGBench is a platform for building, testing, evaluating, comparing, and optimizing Retrieval-Augmented Generation (RAG) pipelines.

The frontend must look like a serious **AI/ML developer tool / enterprise analytics platform**, not a student project, generic chatbot, or SaaS landing page.

## Core principle

This is a **frontend application only**.

Do NOT implement fake AI logic, fake evaluation calculations, fake API responses, or hardcoded functionality that pretends to be real.

Create clean API/service abstractions so a separate Python FastAPI backend can later provide:

* RAG responses
* document processing
* retrieval results
* evaluation metrics
* experiment results
* model information
* latency
* token usage
* cost
* failure analysis

For now, use realistic mock data only where necessary to demonstrate the UI, but clearly structure the code so it can be replaced with API calls.

---

# 1. Overall Application

Create an authenticated-style dashboard application with a left sidebar navigation.

Application name:

**RAGBench**

Tagline:

**Evaluate. Benchmark. Optimize.**

Use a clean dark-first developer-tool aesthetic.

Avoid excessive gradients, excessive glassmorphism, cartoon illustrations, unnecessary animations, and generic AI imagery.

The interface should feel inspired by modern developer platforms and observability tools.

---

# 2. Main Navigation

Create a fixed left sidebar containing:

* Overview
* Documents
* RAG Playground
* Evaluations
* Experiments
* Failure Analysis
* Models
* Datasets
* Settings

At the bottom of the sidebar:

* User profile
* Workspace name
* API/backend connection status

Sidebar should be collapsible.

---

# 3. Top Navigation

Every major page should have a consistent top bar.

Include:

* Current page title
* Breadcrumb where appropriate
* Backend/API connection indicator
* Notification icon
* User avatar
* Workspace selector

Example:

RAGBench / Evaluations

Status:

● Backend Connected

---

# 4. Overview Dashboard

Create a professional analytics dashboard.

Header:

**RAG Evaluation Overview**

Subtitle:

Monitor retrieval quality, generation quality, performance, and experiment results.

Display KPI cards:

### Overall Quality

93.7%

### Retrieval Recall

95.2%

### Answer Correctness

92.4%

### Faithfulness

96.1%

### Hallucination Rate

3.9%

### Average Latency

1.72s

### Cost / Query

$0.002

### Evaluated Queries

2,500

Each KPI should show:

* Current value
* Small trend indicator
* Change compared with previous evaluation

Example:

+4.8% vs previous run

Do NOT overuse colors.

Use semantic colors only where appropriate:

* Green = good
* Red = poor
* Amber = warning
* Neutral = informational

---

# 5. Dashboard Charts

Add high-quality interactive charts.

### Chart 1 — Evaluation Score Trend

Line chart showing:

* Overall score
* Retrieval score
* Generation score
* Faithfulness

Across evaluation runs.

### Chart 2 — Experiment Comparison

Bar chart comparing:

* RAG v1
* RAG v2
* RAG v3
* RAG v4

Metric selector:

* Overall Score
* Accuracy
* Faithfulness
* Retrieval Recall
* Latency
* Cost

### Chart 3 — Accuracy vs Latency

Scatter plot showing different experiments.

X axis:

Latency

Y axis:

Accuracy

This should help users identify high-quality but slow configurations.

### Chart 4 — Failure Distribution

Donut or bar visualization:

* Retrieval Failure
* Generation Failure
* Hallucination
* Context Irrelevance
* Citation Error
* Other

---

# 6. Documents Page

Create a document management interface.

Header:

**Knowledge Base**

Allow users to:

* Upload PDF
* Upload DOCX
* Upload TXT
* Drag and drop files

Display uploaded documents in a table.

Columns:

* Document
* Type
* Size
* Chunks
* Status
* Indexed At
* Actions

Example:

Document:
company_handbook.pdf

Status:
Indexed

Chunks:
842

Actions:

* View
* Re-index
* Delete

Show processing states:

* Uploading
* Processing
* Chunking
* Embedding
* Indexed
* Failed

Include a document details drawer showing:

* File metadata
* Number of pages
* Number of chunks
* Embedding model
* Index status
* Last updated
* Processing time

---

# 7. RAG Playground

Create the main RAG testing interface.

Layout:

Left/center:

Large chat interface.

Right:

Configuration panel.

Chat interface should support:

* User question
* AI answer
* Loading state
* Sources/citations
* Retrieved chunks
* Confidence/evaluation indicators

Example question:

"What is the employee notice period?"

Answer:

"Employees are required to provide 60 days notice before resignation."

Under the answer:

Sources:

company_handbook.pdf — Page 18

Clicking the source should open a source panel.

---

# 8. Retrieved Context Viewer

When the user expands "Retrieved Context", show retrieved chunks.

Example:

Retrieved Context

1. company_handbook.pdf
   Page 18
   Similarity: 0.91

   "Employees are required to provide..."

2. hr_policy.pdf
   Page 7
   Similarity: 0.84

Use cards with:

* Document name
* Page
* Chunk ID
* Similarity score
* Text preview

This is important because RAGBench should allow developers to inspect WHY the RAG system generated an answer.

---

# 9. RAG Configuration Panel

Create a configuration sidebar.

Sections:

### Embedding Model

Dropdown:

* BGE
* E5
* MiniLM
* Custom

### Retrieval Strategy

Options:

* Vector Search
* BM25
* Hybrid Search

### Top K

Slider/input.

### Chunk Size

Options:

* 250
* 500
* 750
* 1000

### Chunk Overlap

Numeric input.

### Reranker

Options:

* Disabled
* Cross Encoder
* Custom

### LLM

Dropdown.

### Temperature

Slider.

Add:

**Save Configuration**

and

**Run Evaluation**

buttons.

---

# 10. Evaluations Page

This is one of the most important pages.

Header:

**Evaluation Harness**

Subtitle:

Run automated evaluation suites against your RAG pipeline.

Top controls:

* Dataset selector
* RAG configuration selector
* Number of questions
* Run Evaluation button

Show evaluation progress:

Preparing dataset...

Running 143 / 500 queries

Progress bar.

After completion show:

### Retrieval Metrics

* Recall@1
* Recall@3
* Recall@5
* Precision@5
* MRR
* NDCG

### Generation Metrics

* Answer Correctness
* Faithfulness
* Context Relevance
* Answer Relevance
* Citation Correctness
* Hallucination Rate

### Performance Metrics

* Average Latency
* P50 Latency
* P95 Latency
* Average Tokens
* Cost / Query
* Total Evaluation Cost

---

# 11. Evaluation Run Details

Clicking an evaluation run should open a detailed page.

Show:

Evaluation Run #RAG-042

Status:

Completed

Dataset:

Enterprise QA v2

Questions:

500

Configuration:

Hybrid Retrieval + Reranker

Then show metric cards.

Below that create a query-level results table:

Columns:

* Question
* Expected Answer
* Generated Answer
* Retrieval Score
* Correctness
* Faithfulness
* Latency
* Status

Statuses:

PASS

WARN

FAIL

Allow filtering by:

* Failed
* Passed
* Hallucination
* Retrieval failure
* Low faithfulness
* Slow queries

---

# 12. Query Inspection

When a failed query is clicked, open a detailed inspection page/drawer.

Display:

### Question

"What is the employee leave carry-forward policy?"

### Expected Answer

"Employees can carry forward up to 15 days."

### Generated Answer

"Employees can carry forward 30 days."

Then show:

### Retrieved Context

Display retrieved chunks.

### Evaluation

Retrieval:
PASS

Context Relevance:
PASS

Faithfulness:
FAIL

Answer Correctness:
FAIL

### Failure Diagnosis

Show:

"Retrieved context contains the relevant policy, but the generated answer contradicts the source."

This page is extremely important.

The UI should communicate that RAGBench helps developers understand WHY their system fails.

---

# 13. Experiments Page

Create an experiment tracking interface.

Header:

**Experiments**

Button:

* New Experiment

Experiment table:

Columns:

* Experiment
* Model
* Embedding
* Retrieval
* Reranker
* Accuracy
* Faithfulness
* Recall
* Latency
* Cost
* Status

Example:

RAG-001
Vector
81.2%

RAG-002
Vector + Reranker
88.7%

RAG-003
Hybrid + Reranker
94.6%

Highlight the current best experiment with a subtle "BEST" badge.

---

# 14. Experiment Comparison

Allow selecting multiple experiments.

Create a comparison page.

Example:

| Metric | RAG-001 | RAG-002 | RAG-003 |
| Overall Score | 81.2% | 88.7% | 94.6% |
| Recall@5 | 84.1% | 90.3% | 95.8% |
| Faithfulness | 87.4% | 92.3% | 96.2% |
| Latency | 1.2s | 1.7s | 1.8s |
| Cost | $0.001 | $0.0015 | $0.002 |

Use visual highlighting to make the best metric clear.

Add charts for comparison.

---

# 15. Failure Analysis Page

Create a dedicated page for diagnosing RAG failures.

Header:

**Failure Analysis**

Show:

Total Failures

137

Failure categories:

* Retrieval Failure — 43%
* Hallucination — 27%
* Context Irrelevance — 15%
* Citation Error — 9%
* Other — 6%

Create a failure trend chart.

Then show a table:

Question | Failure Type | Severity | Experiment | Action

Allow filtering.

---

# 16. Automatic Recommendations

Create a recommendation panel.

Example:

### Optimization Recommendation

Your retrieval recall is significantly lower than generation faithfulness.

Potential bottleneck:

**Retrieval**

Suggested experiments:

1. Increase Top-K from 5 → 8
2. Enable Hybrid Search
3. Add reranking
4. Test smaller chunk size

Button:

**Create Experiment**

This should visually communicate that RAGBench is not only an evaluation tool but also an optimization platform.

---

# 17. Models Page

Create a model registry.

Display:

* Model name
* Provider
* Type
* Context window
* Average latency
* Cost
* Benchmark score

Allow users to add/configure models.

Categories:

* LLM
* Embedding
* Reranker

---

# 18. Datasets Page

Create evaluation dataset management.

Allow:

* Upload dataset
* Create dataset
* Import questions
* Export dataset

Dataset fields:

* Question
* Expected Answer
* Source
* Evidence
* Difficulty
* Category

Show dataset statistics:

Total Questions

500

Easy

180

Medium

220

Hard

100

---

# 19. Settings

Create settings sections:

### Workspace

Workspace name

### API

Backend URL

Connection status

### Models

Default LLM

Default embedding model

### Evaluation

Default metrics

### Appearance

Theme selector

---

# 20. Visual Design

Use a professional dark developer-tool theme.

Primary characteristics:

* Dark background
* Clean cards
* Subtle borders
* High information density
* Excellent typography
* Consistent spacing
* Rounded corners but not excessive
* Minimal animations
* Responsive design
* Desktop-first
* Mobile-friendly where practical

Avoid:

* Huge hero sections
* Stock AI images
* Cartoon robots
* Excessive gradients
* Excessive glassmorphism
* Neon cyberpunk aesthetics
* Fake terminal effects
* Unnecessary animations

The visual identity should communicate:

**AI Infrastructure + Developer Tools + Analytics**

rather than:

**AI Chatbot + Marketing Website**

---

# 21. Important UX Requirements

The user should always understand:

1. What RAG configuration is currently active.
2. What dataset is being evaluated.
3. What evaluation run is being viewed.
4. Which metrics are good/bad.
5. Why a query failed.
6. Which experiment performs best.
7. What configuration produced that result.

Use tooltips to explain technical metrics.

For example:

Recall@K tooltip:

"Percentage of questions for which the relevant document appears within the top K retrieved results."

Faithfulness tooltip:

"Measures whether the generated answer is supported by the retrieved context."

---

# 22. API Architecture

Create a clean service layer so the frontend can later connect to a FastAPI backend.

Use placeholder API services such as:

GET /api/dashboard

GET /api/documents

POST /api/documents/upload

GET /api/rag/configurations

POST /api/rag/query

GET /api/evaluations

POST /api/evaluations/run

GET /api/evaluations/:id

GET /api/experiments

POST /api/experiments

GET /api/experiments/compare

GET /api/failures

GET /api/datasets

GET /api/models

Do not hardcode these URLs throughout components.

Create a centralized API client/service layer.

---

# 23. Technical Frontend Requirements

Use:

* React
* TypeScript
* Tailwind CSS
* Modern component architecture
* Reusable UI components
* React Query or equivalent for API state
* Proper loading states
* Proper error states
* Empty states
* Skeleton loaders
* Toast notifications
* Form validation

Charts should use a reliable charting library.

Keep components modular.

Suggested structure:

src/

components/

pages/

layouts/

services/

api/

hooks/

types/

utils/

---

# 24. Important Data Types

Create TypeScript interfaces for:

Document

RAGConfiguration

EvaluationDataset

EvaluationRun

EvaluationResult

Experiment

Model

Metric

Failure

Recommendation

Keep these types separate from UI components.

---

# 25. Mock Data

Until the backend exists, provide realistic mock data.

Do NOT use random numbers every time the page loads.

Use consistent sample data so the dashboard feels like a real system.

Clearly isolate mock data inside something like:

src/mock/

so it can later be replaced with API responses.

---

# 26. Final requirement

The finished frontend should feel like a **real internal AI platform used by ML engineers to evaluate production RAG systems**.

It should be impressive enough to demonstrate in an MCA placement interview.

The core story of the UI should be:

**Build a RAG pipeline → Run evaluation → Inspect failures → Compare experiments → Identify the best configuration → Optimize the RAG system.**

Do not build a generic AI chatbot.

Build **RAGBench: an AI quality, evaluation, and benchmarking platform.**

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/babca8f8-7516-414b-ae9c-d5b7bc371428).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
