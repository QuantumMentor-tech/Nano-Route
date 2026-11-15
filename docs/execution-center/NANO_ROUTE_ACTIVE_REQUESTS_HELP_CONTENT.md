# Nano Route Help Center — Active Request Center

## What is the Active Request Center?
The Active Request Center gives you live visibility into what Nano Route is doing right now. Whether you are generating responses, ingesting files, or running maintenance tasks, the Active Request Center displays current progress, connection status, and token counts.

## How to Open the Active Request Center
- Click the **Activity** icon in the top header bar next to the Command Palette and Notifications.
- The button badge shows how many requests are currently in progress.
- You can also press `Ctrl+Shift+R` (or open it from the Command Palette).

## Understanding Task States
- **Starting / Preparing**: Nano Route is parsing your prompt, checking context window limits, and validating your token budget.
- **Routing**: The local SLM is evaluating the optimal AI provider and model for your request.
- **Connecting**: A secure connection is being established with the selected AI provider.
- **Streaming**: Tokens are being generated and streamed back to your chat window.
- **Completed**: The request finished successfully.
- **Cancelled**: You stopped the request before it finished.
- **Interrupted**: The application closed or restarted while the request was in flight. You can click **Retry** to resubmit.

## Cancelling a Request
You can safely stop an active request at any time:
1. Open the Active Request Center.
2. Locate the active task.
3. Click **Cancel**.
Nano Route immediately instructs the provider to abort the generation, saving cost and preserving all tokens received up to that point.

