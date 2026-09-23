# docs/tempa — Tempa onboarding V2: shared decisions and status

This folder is the shared source of truth for the Tempa onboarding redesign
(7 sections) across Claude Code, ChatGPT and Codex. It consolidates
`Tempa_Final_Handoff_2026-09-22.zip` (produced in ChatGPT) with a read-only
audit of this repo and the live Supabase DB done on 2026-09-23.

**Tempa is the working name.** English-first product, Turkish-ready.

## Status markers used in every file

| Marker | Meaning |
|---|---|
| ✅ **APPROVED** | Explicitly approved by Doğukan. Do not reopen without a reason. |
| 🟡 **ACCEPTED (inferred)** | Came out of discussion and was accepted in flow, but there is no separate explicit approval sentence. Treat as working direction; confirm if it matters. |
| 🔵 **PROPOSED** | A suggestion (numbers, field names, taxonomies). Not a product decision. |
| 🔴 **OPEN** | Needs a decision before implementation of the affected part. |

Mockup copy, sample answers, selected states and decorations are **never**
decisions by themselves. Written specs govern copy; mockups govern visual
direction only.

## Read in this order

1. [`DECISIONS.md`](DECISIONS.md) — decision log with status.
2. [`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md) — gap analysis: what exists in code/DB today vs. the agreed flow; per-section status.
3. [`ONBOARDING_FLOW.md`](ONBOARDING_FLOW.md) — canonical flow, screens, copy, validation rules, state chain.
4. [`SCHEMA_MAPPING.md`](SCHEMA_MAPPING.md) — logical field → current DB → proposed destination.
5. [`SCORING.md`](SCORING.md) — current live scoring vs. the proposed 100-point model.
6. [`OPEN_QUESTIONS.md`](OPEN_QUESTIONS.md) — only the questions that block implementation.

## Relationship to older docs

- `docs/onboarding-v2-gap-analysis.md`, `docs/v2-schema-spec.md`,
  `docs/matching-engine-v2.md` and
  `supabase/migrations/20260921100000_v2_schema_proposed.sql` were written
  against an **earlier** master spec. Their question sets and enums are
  **superseded** by this folder. Their security architecture (table split,
  RPC-gated writes, state machine, private selfie bucket) is still the
  intended base. As of 2026-09-23 these files are local/uncommitted, so they
  may not be visible on GitHub.
- The proposed migration is **not applied** and must not be applied as-is.

## Update rule

When a decision is made in any assistant, record it in `DECISIONS.md`
(with date and source) and update `IMPLEMENTATION_STATUS.md` when work
lands. Keep changes small and dated.
