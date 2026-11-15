# Nano Route Help Center — Connectivity, Offline Mode & Network Health

## What is the Connectivity Center?
The Connectivity Center gives you real-time visibility into your network connection and the reachability of configured AI providers (such as OpenAI, Anthropic, Gemini, DeepSeek, Groq, and Mistral).

## Understanding Connectivity States
- **Online**: Your computer has an active internet connection. Requests to remote AI providers are permitted.
- **Offline**: Your network adapter is disconnected or internet access is lost. Remote requests are paused to prevent failures.
- **Degraded**: Your network is connected, but one or more AI providers are experiencing outages, rate limits, or authentication issues.

## Offline Mode & Local SLM
**Nano Route never shuts down completely when offline.**
Because Nano Route includes an on-device Small Language Model (SLM) runtime, you can continue working uninterrupted:
- Chat with your **Local SLM** with zero internet connection.
- Review past conversations, bookmarks, and saved notes.
- Prepare attachments, edit prompt templates, and organize context packs.
- Your drafts and staged files are always preserved safely.

## Troubleshooting Provider Issues
- **Auth Required**: Your internet connection is working, but the AI provider rejected your API key. Open **Settings → Providers** to verify or update your key.
- **Rate Limited**: You have reached the provider's request or token throughput limit. Wait a few moments or switch to another provider.
- **Unreachable**: Nano Route cannot establish a connection to the provider's servers. Check your Wi-Fi/Ethernet or verify if corporate firewall/VPN software is blocking traffic.

