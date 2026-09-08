# Editkub Phase 1 & 2 Monetization Validation & Measurement Plan

This document outlines the measurement tools, telemetry definitions, cooldown rules, decision gates, and evaluation procedures for Phase 1 (Donation Validation) and Phase 2 (Caption Feasibility & Benchmarking).

---

## 1. Product Events & Privacy Guarantees

All telemetry events are dispatched to a self-hosted Tianji instance (`https://tianji.9tee.dev`) using fire-and-forget delivery (`window.tianji?.track`). Telemetry errors never throw, block UI flows, or disrupt exports, captions, or downloads.

### Strict Privacy Allowlist

Editkub uses a strict, hardcoded property allowlist (`ALLOWED_PROPERTIES`). Any property key outside this allowlist is stripped before transmission.

We **strictly never collect, store, or transmit**:
- Audio, video, images, or raw file blobs.
- Filenames, project names, or generated media identifiers.
- Captions, transcripts, user prompts, or search queries.
- Media URLs or storage paths.
- Provider API keys, tokens, authorization headers, or provider raw payloads.
- Personal identifying information (PII), email addresses, or unredacted feedback content.

All durations and processing times are coerced into coarse buckets prior to delivery.

---

## 2. Event Specification & Allowlisted Properties

### Allowlisted Property Keys

Only the following 10 property keys are permitted across all custom product events:

```typescript
const ALLOWED_PROPERTIES = new Set([
  "format",
  "quality",
  "surface",
  "mode",
  "provider",
  "duration_bucket",
  "processing_time_bucket",
  "error_category",
  "category",
  "placement",
]);
```

### Event Definitions

| Event Name | Exact Trigger Point | Sent Properties | Allowed Values |
|---|---|---|---|
| `export_completed` | Desktop download initiated or mobile share sheet completed successfully | `format`, `quality`, `surface`, `duration_bucket`, `processing_time_bucket` | `format`: `mp4`, `webm`<br>`quality`: `low`, `medium`, `high`, `very_high`<br>`surface`: `desktop`, `mobile`<br>`duration_bucket`: `under_1m`, `1_to_5m`, `5_to_15m`, `over_15m`<br>`processing_time_bucket`: `under_30s`, `30s_to_2m`, `2_to_5m`, `over_5m` |
| `export_failed` | Renderer or encoder threw an exception or returned `success: false` | `format`, `quality`, `surface`, `duration_bucket`, `processing_time_bucket`, `error_category` | `error_category`: `network`, `unsupported`, `provider`, `render`, `permission`, `unknown`<br>*(other properties match `export_completed`)* |
| `export_cancelled` | User clicked Cancel during render, or dismissed native mobile share sheet (`AbortError`) | `format`, `quality`, `surface`, `duration_bucket` | *(Same formats, surfaces, and duration buckets)* |
| `caption_completed` | Transcript generated and caption track elements successfully built | `mode`, `provider`, `duration_bucket`, `processing_time_bucket` | `mode`: `local`, `remote`<br>`provider`: identifier (e.g. `local`, `groq`, `openai`, `openrouter`)<br>`duration_bucket`: coarse bucket<br>`processing_time_bucket`: coarse bucket |
| `caption_failed` | Audio extraction, worker init, or provider call failed (excluding user cancel) | `mode`, `provider`, `duration_bucket`, `processing_time_bucket`, `error_category` | *(Same categories and buckets)* |
| `caption_cancelled` | User cancelled operation or worker returned cancel | `mode`, `provider`, `duration_bucket` | *(Same modes and providers)* |
| `caption_feedback` | User selected a feedback chip in the caption panel | `category`, `mode`, `provider` | `category`: `good`, `words`, `timing`, `slow`<br>`mode`: `local`, `remote`<br>`provider`: identifier |
| `support_prompt_shown` | Post-export donation toast displayed (after 7-day and 30-day cooldown checks pass) | `surface` | `surface`: `desktop`, `mobile` |
| `support_clicked` | User clicked support link/button across any valid placement | `surface` (optional), `placement` | `surface`: `desktop`, `mobile`<br>`placement`: `post_export`, `editor_menu`, `footer` |

---

## 3. Donation Placements & Cooldown Architecture

Donations are voluntary via Buy Me a Coffee (`https://buymeacoffee.com/9teeedev`). Editkub implements strict cooldown logic in `apps/web/src/lib/donation.ts` to respect user focus.

### Surfaces & Placements

1. **`post_export` (Active notification)**:
   - Surface: Desktop and Mobile.
   - UI: Non-modal toast notification (`sonner`) shown following an export completion.
   - Behavior: If allowed by cooldowns, shows a toast with a "Support Editkub" action. If suppressed by cooldown, shows a quiet "Export complete" toast without donation copy.
2. **`editor_menu` (Passive entry point)**:
   - Surface: Desktop (Project dropdown in `editor-header.tsx`) and Mobile (Overflow menu in `mobile-header.tsx`).
   - UI: Menu item with Buy Me a Coffee icon (`Support Editkub`).
   - Dispatches: `support_clicked` with `placement: "editor_menu"` and appropriate `surface`.
3. **`footer` (Passive entry point)**:
   - Surface: Marketing site footer (`footer.tsx`).
   - UI: Inline icon link (`Support Editkub`).
   - Dispatches: `support_clicked` with `placement: "footer"`.

### Cooldown Rules

- **7-day prompt cooldown (`SUPPORT_PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000`)**:
  - Storage key: `editkub:support-prompt-last-shown`
  - The post-export prompt is shown at most once every rolling 7 days on the same browser.
- **30-day support intent cooldown (`SUPPORT_CLICKED_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000`)**:
  - Storage key: `editkub:support-clicked-last-shown`
  - When a user clicks *any* support link (`post_export`, `editor_menu`, or `footer`), the post-export prompt is suppressed for 30 days. Users who already expressed intent to support are not prompted again.
- **Fail-closed storage safety**:
  - If `localStorage` is blocked, restricted, or throws (e.g. in private browsing or embedded WebViews), `shouldShowSupportPrompt()` safely returns `false`, preventing prompt loops.

---

## 4. Core Validation Metrics

### 1. Export Completion Rate
$$\text{Export Completion Rate} = \frac{\text{count}(export\_completed)}{\text{count}(export\_completed) + \text{count}(export\_failed)}$$
*Cancellations (`export_cancelled`) are excluded from the denominator to measure technical reliability rather than user change of mind.*

### 2. Caption Completion Rate
$$\text{Caption Completion Rate} = \frac{\text{count}(caption\_completed)}{\text{count}(caption\_completed) + \text{count}(caption\_failed)}$$
*Tracked separately for `mode: local` vs `mode: remote` to evaluate third-party provider failure rates.*

### 3. Caption Feedback Distribution
$$\text{Category Share} = \frac{\text{count}(caption\_feedback \text{ with category } C)}{\text{total count}(caption\_feedback)}$$
*Identifies whether errors are driven by accuracy (`words`), synchronization (`timing`), or latency (`slow`).*

### 4. Donation Prompt Click-Through Rate (CTR)
$$\text{Donation Prompt CTR} = \frac{\text{count}(support\_clicked \text{ where } placement = \text{"post\_export"})}{\text{count}(support\_prompt\_shown)}$$
*Monitors user willingness to support the project voluntarily without paywalls or feature locking.*

### 5. Returning User Retention
Measured using aggregate Tianji visitor metrics (unique daily/weekly active visitors and return visitor ratio), without tracking individual identities or projects.

---

## 5. Developer-Only Thai Caption Benchmark Procedure

A repository-native CLI script is provided to evaluate transcription accuracy, latency, and costs locally:

```bash
bun scripts/benchmark-captions.ts [path-to-benchmark-fixture.json]
```

### Metrics Calculated:
1. **Thai Character Error Rate (CER)**: Levenshtein distance on non-whitespace normalized Thai characters divided by reference character count. Primary accuracy metric for non-segmented script.
2. **Word Error Rate (WER)**: Tokenizes Thai phrases into words using native `Intl.Segmenter("th", { granularity: "word" })` and computes word-level Levenshtein distance.
3. **Processing Latency**: Median and P95 latency (in seconds).
4. **Real-Time Factor (RTF)**: $\frac{\text{Processing Latency}}{\text{Audio Duration}}$. An RTF $< 1.0$ indicates faster-than-real-time transcription.
5. **Failure Rate**: Percentage of runs resulting in errors or blank transcripts.
6. **Cost Per Audio Minute**: $\frac{\text{Measured Provider Cost}}{\text{Audio Minutes}}$ based on actual token/minute rates.

### Pilot Evaluation Matrix

Future evaluation requires collecting consented test audio samples across:
- **Category 1**: Clear single-speaker Thai (studio/quiet environment).
- **Category 2**: Background noise (traffic, cafe, ambient music).
- **Category 3**: Multiple speakers (conversational overlapping speech).
- **Category 4**: Thai-English code switching (technical terms, loanwords).
- **Category 5**: Numbers, names, and proper nouns (phone numbers, addresses, personal names).
- **Category 6**: Long-form speech (continuous 5–15 minute recording).

---

## 6. Decision Gates for Future Cloud Caption Service

These gates are **hypotheses to test with real data**, not marketing claims:

1. **Accuracy Advantage**: Cloud median Thai Character Error Rate must be at least **20% lower** than the local in-browser Whisper baseline.
2. **Reliability**: Caption completion rate must reach at least **95%**.
3. **Speed**: Median Real-Time Factor (RTF) must be acceptable for web user workflows ($< 0.3\times$).
4. **Economic Viability**: Measured raw API cost must permit at least a **60% gross margin** after factoring in transaction fees, retries, and hosting costs.
5. **User Demand**: Real user feedback repeatedly demonstrates that accuracy, timing, or local hardware constraints are genuine friction points.

---

## 7. Status of Validation

- [x] **Phase 1 Telemetry & Shared Wrappers**: Completed & tested (`apps/web/src/lib/analytics.ts`).
- [x] **Phase 1 Post-Export Donation Notification & 7-day Cooldown**: Completed & tested (`apps/web/src/lib/donation.ts`).
- [x] **Phase 1 Passive Donation Entry Points & 30-day Intent Cooldown**: Completed & tested (`editor_menu`, `footer`).
- [x] **Phase 2 Contextual Caption Feedback UI**: Completed & tested (`caption-feedback-strip.tsx`).
- [x] **Phase 2 Benchmark CLI & Synthetic Fixture**: Completed & tested (`scripts/benchmark-captions.ts`).
- [ ] **2–4 Week Production Observation Window**: *Pending deployment and real visitor traffic.*
- [ ] **Consented Real Thai Audio Pilot Evaluation**: *Pending consented benchmark data collection.*

> **Important**: Benchmark infrastructure and synthetic test fixtures are operational. Real Phase 2 decision gating requires evaluating consented Thai speech material across the pilot evaluation matrix. Real Phase 2 results must not be fabricated or assumed before real benchmark data is collected.
