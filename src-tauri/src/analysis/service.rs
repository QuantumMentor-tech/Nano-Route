// ============================================================================
// Nano Route - Task Analysis Service
// File: src-tauri/src/analysis/service.rs
// ============================================================================
// Central orchestration service combining intent classification, workload
// complexity estimation, multi-domain taxonomy mapping, and capability requirements.
// Completely provider-neutral; contains zero cloud provider targets or pricing.
// ============================================================================

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, RwLock};
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use tokio_util::sync::CancellationToken;

use crate::analysis::capabilities::analyze_task_capabilities;
use crate::analysis::complexity::analyze_task_complexity;
use crate::analysis::conflict::detect_and_resolve_conflicts;
use crate::analysis::domain::analyze_task_domains;
use crate::analysis::errors::{AnalysisError, AnalysisErrorKind, AnalysisStage};
use crate::analysis::policy::TaskAnalysisPolicy;
use crate::analysis::types::{
    AnalysisAmbiguity, AnalysisCompleteness, AnalysisEvidence, ComplexityAnalysis,
    DomainCandidate, IntentSummary, RequirementStrength, TaskAnalysisRequest,
    TaskAnalysisResult, TaskAnalyzerStatus, TaskCapabilityAssessment, TaskCapabilityRequirement,
    TaskComplexity, TaskDomain, DEFAULT_ANALYSIS_SCHEMA_VERSION,
};
use crate::classification::service::IntentClassifier;
use crate::classification::types::{ClassifierAvailability, IntentClassificationRequest, UserIntent};
use crate::domain::telemetry::{TelemetryEventType, TelemetryOutcome};
use crate::inference::service::LocalSlmService;
use crate::services::telemetry::{RecordTelemetryInput, TelemetryService};

fn current_epoch_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Central Task Analyzer service coordinating multidimensional workload assessment.
pub struct TaskAnalyzer {
    intent_classifier: Arc<IntentClassifier>,
    local_slm_service: Arc<LocalSlmService>,
    telemetry_service: Option<Arc<TelemetryService>>,
    policy: TaskAnalysisPolicy,
    last_latency_ms: RwLock<Option<u64>>,
    last_error: RwLock<Option<String>>,
    request_counter: AtomicU64,
}

impl TaskAnalyzer {
    /// Creates a new TaskAnalyzer instance.
    pub fn new(
        intent_classifier: Arc<IntentClassifier>,
        local_slm_service: Arc<LocalSlmService>,
        telemetry_service: Option<Arc<TelemetryService>>,
    ) -> Self {
        Self {
            intent_classifier,
            local_slm_service,
            telemetry_service,
            policy: TaskAnalysisPolicy::default(),
            last_latency_ms: RwLock::new(None),
            last_error: RwLock::new(None),
            request_counter: AtomicU64::new(1),
        }
    }

    /// Builder allowing custom analysis policy injection.
    pub fn with_policy(mut self, policy: TaskAnalysisPolicy) -> Self {
        self.policy = policy;
        self
    }

    /// Returns the operational status and supported taxonomies of the task analyzer.
    pub fn get_status(&self) -> TaskAnalyzerStatus {
        let cls_status = self.intent_classifier.get_status();
        let is_available = cls_status.availability == ClassifierAvailability::Available;

        TaskAnalyzerStatus {
            is_available,
            model_id: cls_status.model_id,
            model_version: cls_status.model_version,
            schema_version: DEFAULT_ANALYSIS_SCHEMA_VERSION.to_string(),
            supported_domains: vec![
                TaskDomain::SoftwareEngineering,
                TaskDomain::Mathematics,
                TaskDomain::Research,
                TaskDomain::LongFormWriting,
                TaskDomain::Business,
                TaskDomain::DataAnalysis,
                TaskDomain::Education,
                TaskDomain::Translation,
                TaskDomain::Planning,
                TaskDomain::TechnicalDocumentation,
                TaskDomain::Creative,
                TaskDomain::General,
                TaskDomain::Other,
                TaskDomain::Unknown,
            ],
            supported_capabilities: vec![
                TaskCapabilityRequirement::TextGeneration,
                TaskCapabilityRequirement::LongContext,
                TaskCapabilityRequirement::MultiTurnContext,
                TaskCapabilityRequirement::CodeUnderstanding,
                TaskCapabilityRequirement::CodeGeneration,
                TaskCapabilityRequirement::MathematicalReasoning,
                TaskCapabilityRequirement::DeepReasoning,
                TaskCapabilityRequirement::StructuredOutput,
                TaskCapabilityRequirement::DocumentAnalysis,
                TaskCapabilityRequirement::LargeDocumentIngestion,
                TaskCapabilityRequirement::WebRetrieval,
                TaskCapabilityRequirement::ImageInput,
                TaskCapabilityRequirement::AudioInput,
                TaskCapabilityRequirement::VideoInput,
                TaskCapabilityRequirement::ToolCalling,
                TaskCapabilityRequirement::FileHandling,
                TaskCapabilityRequirement::CitationSupport,
                TaskCapabilityRequirement::SearchGrounding,
                TaskCapabilityRequirement::Translation,
                TaskCapabilityRequirement::Summarization,
            ],
            last_latency_ms: self.last_latency_ms.read().ok().and_then(|g| *g),
            last_error: self.last_error.read().ok().and_then(|g| g.clone()),
        }
    }

    /// Performs complete, multi-dimensional task analysis over a user request.
    /// Strictly on-device; provider-neutral.
    pub async fn analyze(
        &self,
        request: TaskAnalysisRequest,
        cancel_token: Option<CancellationToken>,
    ) -> Result<TaskAnalysisResult, AnalysisError> {
        let start_time = Instant::now();

        // 1. Validation (Section 37, 64)
        if request.text.trim().is_empty() {
            let err = AnalysisError::input_invalid("Task prompt cannot be empty or whitespace only");
            self.record_failure(&err.to_string());
            return Err(err);
        }

        // Check cancellation before invoking runtime
        if let Some(ref token) = cancel_token {
            if token.is_cancelled() {
                return Err(AnalysisError::cancelled());
            }
        }

        // 2. Consume Step 27 Intent Classifier (Section 8)
        let intent_req = IntentClassificationRequest {
            request_id: request.request_id.clone(),
            text: request.text.clone(),
            conversation_context: request.conversation_context.clone(),
            language_hint: request.language_hint.clone(),
        };

        let intent_result = match self.intent_classifier.classify(intent_req, cancel_token.clone()).await {
            Ok(res) => res,
            Err(e) => {
                let err = AnalysisError::from(e);
                self.record_failure(&err.to_string());
                return Err(err);
            }
        };

        let intent_summary = IntentSummary {
            primary_intent: intent_result.primary_intent,
            confidence: intent_result.confidence,
            ambiguity: intent_result.ambiguity,
            secondary_intents: intent_result.alternatives.iter().map(|c| c.intent).collect(),
        };

        // 3. Analyze Task Complexity (Section 9-16)
        let (complexity, comp_evidence) =
            analyze_task_complexity(&request, &intent_result, &self.policy);

        // 4. Analyze Task Domains (Section 18-23)
        let (primary_domain, secondary_domains) =
            analyze_task_domains(&request, &intent_result, &self.policy);

        // 5. Analyze Capability Requirements (Section 24-49)
        let (capabilities, cap_evidence) =
            analyze_task_capabilities(&request, &intent_result, &self.policy);

        // 6. Aggregate Evidence
        let mut evidence = comp_evidence;
        evidence.extend(cap_evidence);
        self.policy.sort_evidence(&mut evidence);

        // 7. Detect and Resolve Conflicts (Section 58, 59)
        let conflicts = detect_and_resolve_conflicts(
            &intent_result,
            &complexity,
            primary_domain.domain,
            &capabilities,
        );

        // 8. Overall Ambiguity and Completeness
        let ambiguity = if intent_result.primary_intent == UserIntent::Unknown
            || complexity.level == TaskComplexity::Unknown
        {
            AnalysisAmbiguity::High
        } else if !conflicts.is_empty() {
            AnalysisAmbiguity::Medium
        } else {
            AnalysisAmbiguity::Low
        };

        let completeness = if intent_result.primary_intent == UserIntent::Unknown {
            AnalysisCompleteness::Uncertain
        } else if primary_domain.domain == TaskDomain::Unknown || complexity.level == TaskComplexity::Unknown {
            AnalysisCompleteness::Partial
        } else {
            AnalysisCompleteness::Complete
        };

        let total_latency_ms = start_time.elapsed().as_millis().max(1) as u64;

        if let Ok(mut l_lock) = self.last_latency_ms.write() {
            *l_lock = Some(total_latency_ms);
        }

        let req_id = request.request_id.unwrap_or_else(|| {
            let count = self.request_counter.fetch_add(1, Ordering::Relaxed);
            format!("req_an_{}_{}", current_epoch_ms(), count)
        });

        // 9. Feature-based explanation (Section 108)
        let required_caps_str: Vec<&str> = capabilities
            .iter()
            .filter(|c| c.strength == RequirementStrength::Required)
            .map(|c| c.capability.as_str())
            .collect();

        let explanation = format!(
            "Intent '{}' ({:.2}), Complexity '{}' ({:.2}), Domain '{}' ({:.2}). Required capabilities: [{}].",
            intent_summary.primary_intent.as_str(),
            intent_summary.confidence,
            complexity.level.as_str(),
            complexity.score,
            primary_domain.domain.as_str(),
            primary_domain.confidence,
            required_caps_str.join(", ")
        );

        // 10. Safe Telemetry (Section 90) - zero prompt text stored
        self.record_safe_telemetry(
            &req_id,
            &intent_result.classifier_model_id,
            intent_summary.primary_intent.as_str(),
            complexity.level.as_str(),
            primary_domain.domain.as_str(),
            required_caps_str.len(),
            total_latency_ms,
        );

        Ok(TaskAnalysisResult {
            request_id: req_id,
            intent: intent_summary,
            complexity,
            primary_domain,
            secondary_domains,
            capabilities,
            evidence,
            conflicts,
            ambiguity,
            completeness,
            analyzer_model_id: intent_result.classifier_model_id,
            analyzer_model_version: intent_result.classifier_model_version,
            analysis_schema_version: DEFAULT_ANALYSIS_SCHEMA_VERSION.to_string(),
            inference_latency_ms: intent_result.inference_latency_ms,
            total_latency_ms,
            explanation,
        })
    }

    fn record_failure(&self, msg: &str) {
        if let Ok(mut lock) = self.last_error.write() {
            *lock = Some(msg.to_string());
        }
    }

    fn record_safe_telemetry(
        &self,
        request_id: &str,
        model_id: &str,
        intent_str: &str,
        complexity_str: &str,
        domain_str: &str,
        required_cap_count: usize,
        latency_ms: u64,
    ) {
        if let Some(ref telem) = self.telemetry_service {
            let input = RecordTelemetryInput {
                event_type: Some(TelemetryEventType::Routing),
                task_id: Some(request_id.to_string()),
                provider_id: Some("local".to_string()),
                model_id: Some(model_id.to_string()),
                outcome: Some(TelemetryOutcome::Success),
                error_code: None,
                latency_ms: Some(latency_ms),
                prompt_tokens: None,
                completion_tokens: None,
                cost_usd: None,
                confidence: None,
                routing_reason: Some(format!(
                    "analysis:intent={}:comp={}:dom={}:caps={}",
                    intent_str, complexity_str, domain_str, required_cap_count
                )),
                session_id: None,
                message_id: None,
                stream_id: None,
            };
            telem.record(input);
        }
    }
}

