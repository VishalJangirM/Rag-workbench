# RAGBench – RAG Evaluation Workbench

**A developer-focused platform for building, testing, and evaluating Retrieval-Augmented Generation (RAG) applications.**

RAGBench is a full-stack RAG evaluation workbench designed to help developers upload documents, interact with their content through AI-powered question answering, inspect retrieved evidence, and evaluate the quality of RAG responses.

The platform brings document management, retrieval workflows, experimentation, and evaluation into one unified workspace.

---

## Overview

Large Language Models (LLMs) can generate useful responses, but they may produce inaccurate information or hallucinate when answering questions about specific documents.

RAGBench addresses this challenge through Retrieval-Augmented Generation (RAG). It retrieves relevant information from uploaded documents and uses that context to generate more grounded answers.

The project aims to make RAG workflows easier to explore, test, monitor, and improve.

## Key Features

- **Document Management:** Upload and manage documents for knowledge-base creation.
- **Document Processing:** Extract, process, and prepare document content for retrieval.
- **AI-Powered Question Answering:** Ask questions about uploaded documents using a RAG pipeline.
- **Contextual Retrieval:** Retrieve relevant document content to support generated responses.
- **Evidence Inspection:** Examine retrieved context and supporting evidence behind answers.
- **RAG Evaluation:** Evaluate response quality through dedicated evaluation workflows.
- **Experiment Tracking:** Organize experiments and compare different evaluation runs.
- **Dataset Management:** Manage datasets used for testing and evaluation.
- **Model Management:** Organize model configurations and related information.
- **Failure Analysis:** Identify and investigate unsuccessful or low-quality RAG responses.
- **Interactive Dashboard:** Monitor key metrics and project activity through a unified interface.

## Technology Stack

| Category | Technologies |
|---|---|
| Frontend | React, TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS |
| UI Components | shadcn/ui |
| Backend | Python, FastAPI |
| API Communication | REST API |
| Database | SQLite |
| AI / RAG | Retrieval-Augmented Generation |
| Package Management | npm |
| Version Control | Git, GitHub |

## System Architecture

RAGBench follows a frontend-backend architecture.

```text
             USER
               |
               v
       REACT FRONTEND
        (TypeScript)
               |
               v
          REST APIs
               |
               v
       FASTAPI BACKEND
               |
       +-------+-------+
       |       |       |
       v       v       v
   Document  RAG    Evaluation
  Processing Service  Service
       |       |       |
       v       v       v
   Extract  Retrieve  Evaluate
   Content  Context   Responses
       |       |       |
       +-------+-------+
               |
               v
          DATABASE
            SQLite
```

## RAG Workflow

The core RAG workflow consists of the following stages:

1. **Document Upload:** The user uploads a document through the frontend.
2. **Text Extraction:** The backend extracts readable content from the uploaded document.
3. **Text Processing:** Extracted content is cleaned and prepared for retrieval.
4. **Retrieval:** Relevant document content is identified based on the user's query.
5. **Context Construction:** Retrieved information is assembled into context for the language model.
6. **Response Generation:** The model generates an answer using the retrieved context.
7. **Evaluation:** The generated response can be assessed through the evaluation workflow.

## Project Structure

```text
Rag-workbench/
│
├── backend/
│   ├── routers/
│   │   ├── documents.py
│   │   ├── evaluations.py
│   │   ├── misc.py
│   │   └── rag.py
│   │
│   ├── config.py
│   ├── database.py
│   ├── document_processor.py
│   ├── evaluation_service.py
│   ├── rag_service.py
│   ├── main.py
│   └── requirements.txt
│
├── public/
│
├── src/
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   ├── routes/
│   ├── services/
│   ├── types/
│   ├── router.tsx
│   └── styles.css
│
├── package.json
├── package-lock.json
├── vite.config.ts
├── tsconfig.json
└── README.md
```

## Getting Started

Follow these instructions to run the project locally.

### Prerequisites

Make sure you have installed:

- Node.js
- npm
- Python 3.10 or later
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/VishalJangirM/Rag-workbench.git
```

```bash
cd Rag-workbench
```

### 2. Setup the Frontend

Install the required dependencies:

```bash
npm install
```

Start the frontend development server:

```bash
npm run dev
```

### 3. Setup the Backend

Open a separate terminal:

```bash
cd backend
```

Create a Python virtual environment:

```bash
python -m venv .venv
```

Activate the environment on Windows:

```powershell
.venv\Scripts\activate
```

Install the backend dependencies:

```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables

Create a `.env` file inside the backend directory using `.env.example` as a reference.

Add the API credentials and configuration required by the selected AI provider.

**Important:** Never upload API keys, passwords, or other sensitive credentials to GitHub.

### 5. Start the Backend

From the backend directory, run:

```bash
uvicorn main:app --reload --port 8081
```

The backend API will be available at:

```text
http://localhost:8081
```

FastAPI interactive API documentation:

```text
http://localhost:8081/docs
```

---

## Project Objectives

- Understand and implement Retrieval-Augmented Generation workflows.
- Explore document ingestion and information retrieval.
- Connect frontend applications with Python-based backend APIs.
- Investigate the quality and reliability of AI-generated responses.
- Build evaluation workflows for comparing RAG experiments.
- Develop practical experience with full-stack AI application development.

## Future Enhancements

- Advanced retrieval strategies and hybrid search.
- Improved chunking and embedding techniques.
- RAG evaluation metrics and detailed analytics.
- Support for additional document formats.
- Model and embedding provider comparisons.
- Persistent experiment history and reporting.
- Deployment and production scalability improvements.

## Learning Outcomes

Through this project, I am exploring:

- Retrieval-Augmented Generation (RAG).
- Large Language Model (LLM) integration.
- Document processing and information retrieval.
- REST API development using FastAPI.
- React and TypeScript application development.
- Database integration and backend architecture.
- AI response evaluation and experimentation.

## Author

**Vishal Jangir M**

MCA Student | Data Science & AI Enthusiast

- GitHub: [@VishalJangirM](https://github.com/VishalJangirM)
- LinkedIn: [Vishal Jangir](https://www.linkedin.com/in/vishaljangirm/)

---

*Built as a hands-on project to explore RAG systems, AI engineering, and evaluation workflows.*
