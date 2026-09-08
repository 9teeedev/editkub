# Editkub Phase 1 & 2 Monetization Validation & Measurement Plan

This document outlines the measurement tools, telemetry definitions, decision gates, and evaluation procedures for Phase 1 (Donation Validation) and Phase 2 (Caption Feasibility & Benchmarking).

---

## 1. Product Events & Privacy Guarantees

All events are collected via self-hosted Tianji (`https://tianji.9tee.dev`) using fire-and-forget delivery. Telemetry errors never block user actions.

### Privacy Confirmation

We **strictly never collect, store, or transmit**:
- Audio, video, images, or raw file blobs.
- Filenames, project names, or generated media identifiers.
- Captions, transcripts, user prompts, or search queries.
- Media URLs or storage paths.
- Provider API keys, tokens, authorization headers, or provider raw payloads.
- Personal identifying information (PII), email addresses, or unredacted feedback content.

All numeric values are coerced into coarse buckets before transmission.

---

## 2. Event Specification

| Event Name | Exact Trigger Point | Sent Properties | Allowed Values |
|---|---|---|---|
| `export_completed` | Desktop download triggered or mobile share sheet completed successfully | `format`, `quality`, `surface`, `duration_bucket`, `processing_time_bucket` | `format`: `mp4`, `webm`<br>`quality`: `low`, `medium`, `high`, `very_high`<br>`surface`: `desktop`, `mobile`<br>`duration_bucket`: `under_1m`, `1_to_5m`, `5_to_15m`, `over_15m`<br>`processing_time_bucket`: `under_30s`, `30s_to_2m`, `2_to_5m`, `over_5m` |
| `export_failed` | Renderer/encoder threw an exception or returned `success: false` | `format`, `quality`, `surface`, `duration_bucket`, `processing_time_bucket`, `error_category` | `error_category`: `network`, `unsupported`, `provider`, `render`, `permission`, `unknown` |
| `export_cancelled` | User clicked Cancel during render, or dismissed native mobile share sheet (`AbortError`) | `format`, `quality`, `surface`, `duration_bucket` | *(Same formats and duration buckets as above)* |
| `caption_completed` | Transcript generated and caption track elements successfully built | `mode`, `provider`, `duration_bucket`, `processing_time_bucket` | `mode`: `local`, `remote`<br>`provider`: identifier (e.g. `local`, `groq`, `openai`, `openrouter`) |
| `caption_failed` | Audio extraction, worker init, or provider call failed (excluding user cancel) | `mode`, `provider`, `duration_bucket`, `processing_time_bucket`, `error_category` | *(Same categories as above)* |
| `caption_cancelled` | User cancelled operation or worker returned cancel | `mode`, `provider`, `duration_bucket` | *(Same modes and providers as above)* |
| `caption_feedback` | User selected a feedback chip in the caption panel | `category`, `mode`, `provider` | `category`: `good`, `words`, `timing`, `slow` |
| `support_prompt_shown` | Post-export donation toast displayed (after 7-day cooldown check passed) | `surface` | `surface`: `desktop`, `mobile` |
| `support_clicked` | User clicked "Support Editkub" action button on donation notification | `surface` | `surface`: `desktop`, `mobile` |

---

## 3. Core Validation Metrics

### 1. Export Completion Rate
$$\text{Export Completion Rate} = \frac{\text{count}(export\_completed)}{\text{count}(export\_completed) + \text{count}(export\_failed)}$$
*Note: Cancellations (`export_cancelled`) are excluded from the denominator to measure technical reliability rather than user change of mind.*

### 2. Caption Completion Rate
$$\text{Caption Completion Rate} = \frac{\text{count}(caption\_completed)}{\text{count}(caption\_completed) + \text{count}(caption\_failed)}$$
*Tracked separately for `mode: local` vs `mode: remote`.*

### 3. Caption Feedback Distribution
$$\text{Category Share} = \frac{\text{count}(caption\_feedback \text{ with category } C)}{\text{total count}(caption\_feedback)}$$
*Identifies whether errors are driven by accuracy (`words`), synchronization (`timing`), or latency (`slow`).*

### 4. Donation Prompt Click-Through Rate (CTR)
$$\text{Donation Prompt CTR} = \frac{\text{count}(support\_clicked)}{\text{count}(support\_prompt_shown)}$$
*Monitors user willingness to support the project voluntarily without paywalls or feature locking.*

### 5. Returning User Retention
Measured using existing aggregate Tianji visitor metrics (unique daily/weekly active visitors and return visitor ratio), without tracking user identities or projects.

---

## 4. Developer-Only Thai Caption Benchmark Procedure

A repository-native CLI script is provided to evaluate transcription accuracy and latency locally:

```bash
bun scripts/benchmark-captions.ts [path-to-benchmark-fixture.json]
```

### Metrics Calculated:
1. **Thai Character Error Rate (CER)**: Levenshtein distance on non-whitespace normalized Thai characters divided by reference character count. Primary accuracy metric for non-segmented script.
2. **Word Error Rate (WER)**: Tokenizes Thai phrases into words using native `Intl.Segmenter("th", { granularity: "word" })` and computes word-level Levenshtein distance.
3. **Processing Latency**: Median and P95 latency (in seconds).
4. **Real-Time Factor (RTF)**: $\frac{\text{Processing Latency}}{\text{Audio Duration}}$. An RTF $< 1.0$ indicates faster-than-real-time transcription.
5. **Failure Rate**: Percentage of runs resulting in errors or blank transcripts.
6. **Cost Per Audio Minute**: $\frac{\text{Measured Provider Cost}}{\text{Audio Minutes}}$ based on actual provided cost.

### Pilot Evaluation Matrix

Future evaluation requires collecting consented test audio samples across:
- **Category 1**: Clear single-speaker Thai (studio/quiet environment).
- **Category 2**: Background noise (traffic, cafe, ambient music).
- **Category 3**: Multiple speakers (conversational overlapping speech).
- **Category 4**: Thai-English code switching (technical terms, loanwords).
- **Category 5**: Numbers, names, and proper nouns (phone numbers, addresses, personal names).
- **Category 6**: Long-form speech (continuous 5–15 minute recording).

---

## 5. Decision Gates for Future Cloud Caption Service

These gates are **hypotheses to test**, not guaranteed claims:

1. **Accuracy Advantage**: Cloud median Thai Character Error Rate must be at least **20% lower** than the local in-browser Whisper baseline.
2. **Reliability**: Caption completion rate must reach at least **95%**.
3. **Speed**: Median Real-Time Factor (RTF) must be acceptable for web user workflows ($< 0.3\times$).
4. **Economic Viability**: Measured raw API cost must permit at least a **60% gross margin** after factoring in transaction fees, retries, and hosting costs.
5. **User Demand**: Real user feedback repeatedly demonstrates that accuracy, timing, or local hardware constraints are genuine friction points.

*Under Vercel Hobby constraints and our privacy principles, no paid service or subscription backend will be built until these gates are verified with real data.*

---

## 6. Status of Validation

- [x] **Phase 1 Telemetry & Shared Wrappers**: Completed & tested.
- [x] **Phase 1 Post-Export Donation Notification & 7-day Cooldown**: Completed & tested.
- [x] **Phase 2 Contextual Caption Feedback UI**: Completed & tested.
- [x] **Phase 2 Benchmark CLI & Synthetic Fixture**: Completed & tested.
- [ ] **2–4 Week Production Observation Window**: *Pending deployment and real visitor traffic.*
- [ ] **Consented Real Thai Audio Pilot Evaluation**: *Pending consented benchmark data collection.*
