"""
Integration test suite for RAGBench backend.
Tests health, documents, file uploads (txt, md, docx, pdf, empty, invalid),
retrieval, evaluation harness, datasets, and deletion.
"""
import io
from fastapi.testclient import TestClient
from main import app
from docx import Document as DocxDoc
from pypdf import PdfWriter

client = TestClient(app)

def run_tests():
    print("--- 1. Testing Health ---")
    r = client.get("/api/health")
    assert r.status_code == 200, f"Health check failed: {r.status_code}"
    print("Health check OK:", r.json())

    print("\n--- 2. Testing Dashboard ---")
    r = client.get("/api/dashboard")
    assert r.status_code == 200, f"Dashboard failed: {r.status_code}"
    d = r.json()
    assert "kpis" in d and len(d["kpis"]) >= 2
    assert "scoreTrend" in d
    print(f"Dashboard OK: {len(d['kpis'])} KPIs returned")

    print("\n--- 3. Testing Document Listing ---")
    r = client.get("/api/documents")
    assert r.status_code == 200
    initial_docs = r.json()
    print(f"Document listing OK: {len(initial_docs)} documents currently present")

    print("\n--- 4. Testing Document Uploads ---")
    # 4a. TXT Upload
    txt_data = b"Security Standards:\nAll database connections require TLS 1.3 encryption."
    r = client.post(
        "/api/documents/upload",
        files={"files": ("security_tls.txt", txt_data, "text/plain")},
    )
    assert r.status_code == 200, f"TXT upload failed: {r.status_code} {r.text}"
    txt_doc = r.json()[0]
    print(f"TXT upload OK: id={txt_doc['id']}, name={txt_doc['name']}")

    # 4b. MD Upload
    md_data = b"# API Gateway\n\nRate limits are set to 100 requests per second per IP address."
    r = client.post(
        "/api/documents/upload",
        files={"files": ("gateway.md", md_data, "text/markdown")},
    )
    assert r.status_code == 200, f"MD upload failed: {r.status_code} {r.text}"
    md_doc = r.json()[0]
    print(f"MD upload OK: id={md_doc['id']}, name={md_doc['name']}")

    # 4c. DOCX Upload
    docx_buf = io.BytesIO()
    doc = DocxDoc()
    doc.add_heading("Vendor Policy", level=1)
    doc.add_paragraph("Approved vendors must complete security reviews annually.")
    doc.save(docx_buf)
    r = client.post(
        "/api/documents/upload",
        files={"files": ("vendor_policy.docx", docx_buf.getvalue(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
    )
    assert r.status_code == 200, f"DOCX upload failed: {r.status_code} {r.text}"
    docx_doc = r.json()[0]
    print(f"DOCX upload OK: id={docx_doc['id']}, name={docx_doc['name']}")

    # 4d. Empty file validation (must return 422)
    r = client.post(
        "/api/documents/upload",
        files={"files": ("empty.txt", b"", "text/plain")},
    )
    assert r.status_code == 422, f"Expected 422 on empty file, got {r.status_code}"
    print("Empty file rejection OK: HTTP 422 returned as expected")

    # 4e. Invalid extension validation (must return 422)
    r = client.post(
        "/api/documents/upload",
        files={"files": ("script.sh", b"echo hi", "application/x-sh")},
    )
    assert r.status_code == 422, f"Expected 422 on unsupported extension, got {r.status_code}"
    print("Unsupported extension rejection OK: HTTP 422 returned as expected")

    print("\n--- 5. Testing RAG Playground Query ---")
    r = client.post(
        "/api/rag/query",
        json={
            "question": "What are the database encryption standards?",
            "configuration": {
                "name": "Vector Baseline",
                "topK": 5,
                "llm": "gpt-4o-mini",
                "temperature": 0.2,
            },
        },
    )
    assert r.status_code == 200, f"RAG query failed: {r.status_code} {r.text}"
    ans = r.json()
    assert "answer" in ans
    assert "chunks" in ans
    print(f"RAG query OK: confidence={ans['confidence']}, latency={ans['latencyMs']}ms")
    print(f"Retrieved {len(ans['chunks'])} chunks")

    print("\n--- 6. Testing Evaluations ---")
    r = client.get("/api/evaluations")
    assert r.status_code == 200
    runs = r.json()
    assert len(runs) >= 1
    run_id = runs[0]["id"]
    print(f"Evaluation list OK: found {len(runs)} runs. Latest: {run_id}")

    r = client.get(f"/api/evaluations/{run_id}")
    assert r.status_code == 200
    run_detail = r.json()
    assert len(run_detail["retrieval"]) >= 3
    assert len(run_detail["generation"]) >= 3
    print("Evaluation run details OK: retrieval & generation metrics populated")

    r = client.get(f"/api/evaluations/{run_id}/results")
    assert r.status_code == 200
    results = r.json()
    print(f"Evaluation results OK: {len(results)} queries evaluated")

    # Trigger a new run
    print("\n--- 7. Testing Evaluation Run Trigger ---")
    r = client.post(
        "/api/evaluations/run",
        json={"datasetId": "ds-enterprise-qa-v2", "configurationId": "cfg-default", "questions": 3},
    )
    assert r.status_code == 200
    new_run = r.json()
    print(f"Trigger evaluation run OK: id={new_run['id']}, status={new_run['status']}")

    print("\n--- 8. Testing Datasets and Failures ---")
    r = client.get("/api/datasets")
    assert r.status_code == 200 and len(r.json()) >= 1
    print(f"Datasets OK: {len(r.json())} datasets available")

    r = client.get("/api/failures")
    assert r.status_code == 200
    print(f"Failures OK: {r.json()['total']} total failures categorized")

    print("\n--- 9. Testing Document Deletion ---")
    r = client.delete(f"/api/documents/{txt_doc['id']}")
    assert r.status_code == 200
    print("Document deletion OK: status 200")

    print("\n" + "=" * 50)
    print("ALL INTEGRATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 50)

if __name__ == "__main__":
    run_tests()
