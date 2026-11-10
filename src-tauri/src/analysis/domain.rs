// ============================================================================
// Nano Route - Domain Analyzer
// File: src-tauri/src/analysis/domain.rs
// ============================================================================
// Analyzes primary and secondary operational domains for user requests.
// Distinct from Intent: Intent is WHAT is requested; Domain is the WORK AREA.
// ============================================================================

use crate::analysis::policy::TaskAnalysisPolicy;
use crate::analysis::types::{AnalysisSource, DomainCandidate, TaskAnalysisRequest, TaskDomain};
use crate::classification::types::{IntentClassificationResult, UserIntent};

/// Evaluates the primary domain and ranked secondary domain candidates.
pub fn analyze_task_domains(
    request: &TaskAnalysisRequest,
    intent_result: &IntentClassificationResult,
    policy: &TaskAnalysisPolicy,
) -> (DomainCandidate, Vec<DomainCandidate>) {
    let lower = request.text.to_lowercase();
    let mut candidates: Vec<DomainCandidate> = Vec::new();

    // 1. Primary domain candidate mapping directly from Step 27 Intent
    let (base_domain, base_conf) = match intent_result.primary_intent {
        UserIntent::SoftwareEngineering | UserIntent::CodeDebugging => {
            (TaskDomain::SoftwareEngineering, (intent_result.confidence * 0.95).max(0.60))
        }
        UserIntent::ReasoningMath => {
            (TaskDomain::Mathematics, (intent_result.confidence * 0.95).max(0.60))
        }
        UserIntent::ResearchRetrieval => {
            (TaskDomain::Research, (intent_result.confidence * 0.90).max(0.60))
        }
        UserIntent::Writing => {
            (TaskDomain::LongFormWriting, (intent_result.confidence * 0.90).max(0.60))
        }
        UserIntent::DataAnalysis => {
            (TaskDomain::DataAnalysis, (intent_result.confidence * 0.90).max(0.60))
        }
        UserIntent::Translation => {
            (TaskDomain::Translation, (intent_result.confidence * 0.95).max(0.65))
        }
        UserIntent::Summarization => {
            // Summarization can span research, business, or general
            if lower.contains("financial") || lower.contains("earnings") || lower.contains("sales") || lower.contains("executive") {
                (TaskDomain::Business, 0.70)
            } else if lower.contains("paper") || lower.contains("study") || lower.contains("research") {
                (TaskDomain::Research, 0.70)
            } else {
                (TaskDomain::General, 0.60)
            }
        }
        UserIntent::CreativeGeneration => {
            (TaskDomain::Creative, (intent_result.confidence * 0.90).max(0.60))
        }
        UserIntent::GeneralConversation => {
            (TaskDomain::General, (intent_result.confidence * 0.90).max(0.70))
        }
        UserIntent::Other => (TaskDomain::Other, 0.50),
        UserIntent::Unknown => (TaskDomain::Unknown, 0.20),
    };

    candidates.push(DomainCandidate {
        domain: base_domain,
        confidence: base_conf,
        source: AnalysisSource::Derived,
    });

    // 2. Secondary domain signals from structural cues & vocabulary
    // Software / Systems
    if (lower.contains("code") || lower.contains("rust") || lower.contains("python") || lower.contains("react") || lower.contains("sql"))
        && base_domain != TaskDomain::SoftwareEngineering
    {
        candidates.push(DomainCandidate {
            domain: TaskDomain::SoftwareEngineering,
            confidence: 0.65,
            source: AnalysisSource::StrongStructuralSignal,
        });
    }

    // Business / Finance
    if (lower.contains("csv") || lower.contains("revenue") || lower.contains("sales") || lower.contains("business") || lower.contains("quarterly") || lower.contains("roi"))
        && base_domain != TaskDomain::Business
    {
        candidates.push(DomainCandidate {
            domain: TaskDomain::Business,
            confidence: 0.55,
            source: AnalysisSource::Heuristic,
        });
    }

    // Data Analysis
    if (lower.contains("csv") || lower.contains("dataset") || lower.contains("table") || lower.contains("outliers") || lower.contains("correlation"))
        && base_domain != TaskDomain::DataAnalysis
    {
        candidates.push(DomainCandidate {
            domain: TaskDomain::DataAnalysis,
            confidence: 0.65,
            source: AnalysisSource::StrongStructuralSignal,
        });
    }

    // Technical Documentation
    if (lower.contains("documentation") || lower.contains("readme") || lower.contains("api docs") || lower.contains("specification"))
        && base_domain != TaskDomain::TechnicalDocumentation
    {
        candidates.push(DomainCandidate {
            domain: TaskDomain::TechnicalDocumentation,
            confidence: 0.60,
            source: AnalysisSource::Heuristic,
        });
    }

    // Planning / Strategy
    if (lower.contains("roadmap") || lower.contains("migration plan") || lower.contains("phases") || lower.contains("schedule"))
        && base_domain != TaskDomain::Planning
    {
        candidates.push(DomainCandidate {
            domain: TaskDomain::Planning,
            confidence: 0.60,
            source: AnalysisSource::Heuristic,
        });
    }

    // Sort deterministically using policy
    policy.sort_domains(&mut candidates);

    // Dedup by domain enum
    let mut unique_domains: Vec<DomainCandidate> = Vec::new();
    for cand in candidates {
        if !unique_domains.iter().any(|d| d.domain == cand.domain) {
            unique_domains.push(cand);
        }
    }

    let primary = unique_domains.remove(0);
    let secondary: Vec<DomainCandidate> = unique_domains
        .into_iter()
        .filter(|d| d.confidence >= policy.domain_threshold && d.domain != TaskDomain::Unknown)
        .take(policy.max_domains.saturating_sub(1))
        .collect();

    (primary, secondary)
}

