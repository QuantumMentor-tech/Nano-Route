# Nano Route Help Center — Provider & Model Compatibility Center

## What is the Compatibility Center?
The Provider & Model Compatibility Center allows you to inspect all configured AI providers, discover registered models, verify current readiness, check supported modalities (such as image vision and streaming), and understand why a model is eligible or ineligible for your request.

## How to Access the Compatibility Center
- Click the **Models** button in the top Dashboard header.
- In the **Request Inspector**, click the **Models** button to evaluate your current prompt and attachments.
- Open the **Command Palette** (`Ctrl+K`) and type `Open Provider & Model Compatibility Center`.

## Understanding Readiness Badges
- **Ready**: Credentials, network connection, runtime health, and model registry are verified.
- **Ready (Limitations)**: The model is usable, but approaching rate limits or context boundaries.
- **No API Key**: The provider requires an API key in **Settings → Providers**.
- **Auth Required**: The provider rejected your API key. Please update your key.
- **Offline**: Your network adapter is disconnected or the remote provider endpoint is unreachable.
- **Incompatible**: The model cannot process your current request (e.g. requires image input, but the model is text-only).
- **Deprecated**: The model has been superseded by newer alternatives.

## Side-by-Side Model Comparison
Check the box next to any model in the **Model Catalog** tab to add it to the **Compare** tab. You can compare context limits, max output tokens, vision capabilities, streaming support, and cost estimates for up to 4 models at once.

