// ============================================================================
// Nano Route - Task Capability Requirement Analyzer
// File: src-tauri/src/analysis/capabilities.rs
// ============================================================================
// Analyzes what technical capabilities the user's task demands.
// Distinct from Step 25 ProviderCapability: describes task demand, not provider supply.
// Enforces negation handling, discussion vs execution, and attachment distinctions.
// ============================================================================

use crate::analysis::policy::TaskAnalysisPolicy;
use crate::analysis::types::{
    AnalysisEvidence, AnalysisSource, RequirementStrength, TaskAnalysisRequest,
    TaskCapabilityAssessment, TaskCapabilityRequirement,
};
use crate::classification::types::{IntentClassificationResult, UserIntent};

/// Evaluates task capability requirements with evidence and negation awareness.
pub fn analyze_task_capabilities(
    request: &TaskAnalysisRequest,
    intent_result: &IntentClassificationResult,
    policy: &TaskAnalysisPolicy,
) -> (Vec<TaskCapabilityAssessment>, Vec<AnalysisEvidence>) {
    let text = &request.text;
    let lower = text.to_lowercase();
    let mut caps: Vec<TaskCapabilityAssessment> = Vec::new();
    let mut evidence: Vec<AnalysisEvidence> = Vec::new();

    // 1. TextGeneration is a baseline requirement for all textual prompts
    caps.push(TaskCapabilityAssessment {
        capability: TaskCapabilityRequirement::TextGeneration,
        strength: RequirementStrength::Required,
        confidence: 0.99,
        source: AnalysisSource::Derived,
        reason_code: "baseline_text_generation".to_string(),
    });

    // 2. Code Understanding & Code Generation
    let has_code_syntax = text.contains("```")
        || lower.contains("fn ")
        || lower.contains("struct ")
        || lower.contains("impl ")
        || lower.contains("class ")
        || lower.contains("def ");

    let requests_code_gen = lower.contains("implement")
        || lower.contains("write a function")
        || lower.contains("write code")
        || lower.contains("refactor")
        || lower.contains("generate a script")
        || intent_result.primary_intent == UserIntent::SoftwareEngineering;

    let requests_code_debug = lower.contains("panic")
        || lower.contains("stack trace")
        || lower.contains("nullpointerexception")
        || lower.contains("fix this error")
        || lower.contains("memory leak")
        || intent_result.primary_intent == UserIntent::CodeDebugging;

    if has_code_syntax || requests_code_debug || requests_code_gen {
        caps.push(TaskCapabilityAssessment {
            capability: TaskCapabilityRequirement::CodeUnderstanding,
            strength: RequirementStrength::Required,
            confidence: 0.92,
            source: if has_code_syntax {
                AnalysisSource::StrongStructuralSignal
            } else {
                AnalysisSource::Derived
            },
            reason_code: "code_understanding_required".to_string(),
        });
    }

    if requests_code_gen {
        caps.push(TaskCapabilityAssessment {
            capability: TaskCapabilityRequirement::CodeGeneration,
            strength: RequirementStrength::Required,
            confidence: 0.90,
            source: AnalysisSource::ExplicitUserRequirement,
            reason_code: "code_generation_required".to_string(),
        });
    }

    // 3. Mathematical & Deep Reasoning
    let requests_math = lower.contains("prove")
        || lower.contains("eigenvalue")
        || lower.contains("theorem")
        || lower.contains("calculate")
        || lower.contains("matrix")
        || lower.contains("derivative")
        || intent_result.primary_intent == UserIntent::ReasoningMath;

    let requests_deep_reasoning = requests_math
        || lower.contains("contradiction")
        || lower.contains("tradeoffs between")
        || lower.contains("causal analysis")
        || lower.contains("formal proof");

    if requests_math {
        caps.push(TaskCapabilityAssessment {
            capability: TaskCapabilityRequirement::MathematicalReasoning,
            strength: RequirementStrength::Required,
            confidence: 0.90,
            source: AnalysisSource::Derived,
            reason_code: "mathematical_reasoning_required".to_string(),
        });
    }

    if requests_deep_reasoning {
        caps.push(TaskCapabilityAssessment {
            capability: TaskCapabilityRequirement::DeepReasoning,
            strength: RequirementStrength::Required,
            confidence: 0.88,
            source: AnalysisSource::Derived,
            reason_code: "deep_reasoning_required".to_string(),
        });
    }

    // 4. Structured Output
    let requests_structured_output = lower.contains("valid json")
        || lower.contains("return json")
        || lower.contains("in json format")
        || lower.contains("as json")
        || lower.contains("in csv format")
        || lower.contains("as a table")
        || lower.contains("schema-constrained");

    if requests_structured_output {
        caps.push(TaskCapabilityAssessment {
            capability: TaskCapabilityRequirement::StructuredOutput,
            strength: RequirementStrength::Required,
            confidence: 0.95,
            source: AnalysisSource::ExplicitUserRequirement,
            reason_code: "structured_output_explicitly_requested".to_string(),
        });
        evidence.push(AnalysisEvidence {
            code: "structured_output_requested".to_string(),
            description: "Explicit constraint requiring output in strict structured format (JSON/table)".to_string(),
            source: AnalysisSource::ExplicitUserRequirement,
            weight: 0.95,
        });
    }

    // 5. Web Retrieval vs Negation Handling (Section 80, 122, 126)
    let explicit_web_negation = lower.contains("do not search the web")
        || lower.contains("don't search the web")
        || lower.contains("without searching")
        || lower.contains("from general knowledge only")
        || lower.contains("no web search");

    let requests_web = lower.contains("search the web")
        || lower.contains("search online")
        || lower.contains("latest developments today")
        || lower.contains("current news")
        || lower.contains("what happened today");

    if explicit_web_negation {
        caps.push(TaskCapabilityAssessment {
            capability: TaskCapabilityRequirement::WebRetrieval,
            strength: RequirementStrength::NotRequired,
            confidence: 0.95,
            source: AnalysisSource::ExplicitUserRequirement,
            reason_code: "web_search_explicitly_negated".to_string(),
        });
        evidence.push(AnalysisEvidence {
            code: "web_search_negated".to_string(),
            description: "User explicitly negated web retrieval".to_string(),
            source: AnalysisSource::ExplicitUserRequirement,
            weight: 0.95,
        });
    } else if requests_web {
        caps.push(TaskCapabilityAssessment {
            capability: TaskCapabilityRequirement::WebRetrieval,
            strength: RequirementStrength::Required,
            confidence: 0.92,
            source: AnalysisSource::ExplicitUserRequirement,
            reason_code: "web_retrieval_explicitly_requested".to_string(),
        });
        caps.push(TaskCapabilityAssessment {
            capability: TaskCapabilityRequirement::SearchGrounding,
            strength: RequirementStrength::Required,
            confidence: 0.88,
            source: AnalysisSource::ExplicitUserRequirement,
            reason_code: "search_grounding_required".to_string(),
        });
        evidence.push(AnalysisEvidence {
            code: "explicit_web_request".to_string(),
            description: "User explicitly requested current web search or live information".to_string(),
            source: AnalysisSource::ExplicitUserRequirement,
            weight: 0.90,
        });
    }

    // 6. Citation Support
    let requests_citations = lower.contains("cite your sources")
        || lower.contains("cite sources")
        || lower.contains("with citations")
        || lower.contains("include references")
        || lower.contains("bibliography");

    if requests_citations {
        caps.push(TaskCapabilityAssessment {
            capability: TaskCapabilityRequirement::CitationSupport,
            strength: RequirementStrength::Required,
            confidence: 0.95,
            source: AnalysisSource::ExplicitUserRequirement,
            reason_code: "citations_explicitly_requested".to_string(),
        });
        evidence.push(AnalysisEvidence {
            code: "citation_support_requested".to_string(),
            description: "Explicit requirement for source citations or bibliography".to_string(),
            source: AnalysisSource::ExplicitUserRequirement,
            weight: 0.90,
        });
    }

    // 7. Image Input: Discussion vs Execution Requirement (Section 30, 124)
    let is_image_discussion = lower.contains("explain how image generation")
        || lower.contains("what is image generation")
        || lower.contains("concept of computer vision")
        || lower.contains("how do diffusion models work");

    let requests_image_input = (lower.contains("analyze the attached image")
        || lower.contains("look at this image")
        || lower.contains("in this photo")
        || lower.contains("describe defects in this picture")
        || lower.contains("analyze this picture")
        || lower.contains("what is in this image"))
        && !is_image_discussion;

    if requests_image_input {
        caps.push(TaskCapabilityAssessment {
            capability: TaskCapabilityRequirement::ImageInput,
            strength: RequirementStrength::Required,
            confidence: 0.90,
            source: AnalysisSource::ExplicitUserRequirement,
            reason_code: "image_input_inspection_required".to_string(),
        });
        evidence.push(AnalysisEvidence {
            code: "image_input_requested".to_string(),
            description: "User requested inspection of an image asset".to_string(),
            source: AnalysisSource::ExplicitUserRequirement,
            weight: 0.90,
        });
    }

    // 8. Document Analysis & Attachment Mention vs Available (Section 31, 32, 125)
    let mentions_document = lower.contains("analyze this pdf")
        || lower.contains("analyze the pdf")
        || lower.contains("in this report")
        || lower.contains("process this spreadsheet")
        || lower.contains("uploaded document");

    if mentions_document {
        caps.push(TaskCapabilityAssessment {
            capability: TaskCapabilityRequirement::DocumentAnalysis,
            strength: RequirementStrength::Required,
            confidence: 0.88,
            source: AnalysisSource::ExplicitUserRequirement,
            reason_code: "document_analysis_requested".to_string(),
        });

        // Check actual attachment availability
        let actual_attachments = request.attachment_count.unwrap_or(0);
        if actual_attachments == 0 {
            evidence.push(AnalysisEvidence {
                code: "attachment_mention_without_file".to_string(),
                description: "Prompt mentions document/file analysis, but no physical attachment was supplied".to_string(),
                source: AnalysisSource::StrongStructuralSignal,
                weight: 0.75,
            });
        } else {
            caps.push(TaskCapabilityAssessment {
                capability: TaskCapabilityRequirement::FileHandling,
                strength: RequirementStrength::Required,
                confidence: 0.95,
                source: AnalysisSource::ExplicitUserRequirement,
                reason_code: "file_attachment_active".to_string(),
            });
        }
    }

    // 9. Long Context (>16k tokens)
    let word_count = text.split_whitespace().count();
    let is_multi_document = lower.contains("across these three reports")
        || lower.contains("compare all documents")
        || lower.contains("across all 5 files");

    if word_count > 600 || is_multi_document {
        caps.push(TaskCapabilityAssessment {
            capability: TaskCapabilityRequirement::LongContext,
            strength: RequirementStrength::Required,
            confidence: 0.85,
            source: AnalysisSource::StrongStructuralSignal,
            reason_code: "large_context_payload_detected".to_string(),
        });
        evidence.push(AnalysisEvidence {
            code: "long_context_required".to_string(),
            description: "Task requires ingesting extensive cross-document context".to_string(),
            source: AnalysisSource::StrongStructuralSignal,
            weight: 0.85,
        });
    }

    // 10. Translation & Summarization derived from intent
    if intent_result.primary_intent == UserIntent::Translation || lower.contains("translate this") {
        caps.push(TaskCapabilityAssessment {
            capability: TaskCapabilityRequirement::Translation,
            strength: RequirementStrength::Required,
            confidence: 0.95,
            source: AnalysisSource::Derived,
            reason_code: "translation_task_identified".to_string(),
        });
    }

    if intent_result.primary_intent == UserIntent::Summarization || lower.contains("summarize this") {
        caps.push(TaskCapabilityAssessment {
            capability: TaskCapabilityRequirement::Summarization,
            strength: RequirementStrength::Required,
            confidence: 0.95,
            source: AnalysisSource::Derived,
            reason_code: "summarization_task_identified".to_string(),
        });
    }

    // Sort capabilities deterministically using policy
    policy.sort_capabilities(&mut caps);

    // Deduplicate capabilities
    let mut unique_caps: Vec<TaskCapabilityAssessment> = Vec::new();
    for cap in caps {
        if !unique_caps.iter().any(|c| c.capability == cap.capability) {
            unique_caps.push(cap);
            if unique_caps.len() >= policy.max_capabilities {
                break;
            }
        }
    }

    policy.sort_evidence(&mut evidence);

    (unique_caps, evidence)
}

