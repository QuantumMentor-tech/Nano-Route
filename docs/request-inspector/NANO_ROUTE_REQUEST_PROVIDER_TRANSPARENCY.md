# Nano Route — Request Provider Transparency

## 1. Truthful Routing Disclosure
The Request Inspector provides honest, transparent information regarding provider and model routing:
- **Manual Mode:** Explicitly displays the chosen provider and model selected by the user, alongside capability validation.
- **Automatic Mode:** Shows the active default or currently resolved route without claiming predictive certainty when dynamic SLM classification will execute at send time.

## 2. Modality Compatibility Checks
The inspector cross-references active attachments against the target model's capability profile:
- If image attachments are present, the inspector verifies multimodal support.
- If an incompatible model (e.g. text-only local SLM) is selected, a blocking warning is raised before network transmission.

