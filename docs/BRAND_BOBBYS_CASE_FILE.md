# Bobby's Case File — Brand and Release Contract

## Public product name
**Bobby's Case File**

Internal package names, schemas, API contracts, database identifiers, service-worker cache keys, provider user agents, report schema versions, and repository paths remain **AtlasVerify** until a separately tested compatibility migration exists.

## Public positioning
People Search • Public Records • Evidence Intelligence

The product is a lawful public-record research and evidence workspace. Every search lane should expose source, retrieval time, confidence, corroboration, conflicts, and stale-data warnings where available.

## Store copy
**Short description:** Search public records, connect evidence, and build traceable case files.

**Long description:** Bobby's Case File brings people search, reverse lookups, public records, property, businesses, professional licenses, sanctions, court references, vehicles, timelines, relationships, and evidence provenance into one case workspace. Results are treated as leads, not identity proof, and the product is designed to surface source quality, uncertainty, and corrections instead of hiding them.

## Safety / compliance boundary
Do not market the standard product for employment, housing, credit, insurance, tenant screening, or other eligibility decisions that require a regulated consumer report. Maintain opt-out/suppression, correction, audit, and provenance workflows.

## Icon master
- Folder/case-file silhouette.
- Fingerprint inside a magnifying lens.
- Small verification check integrated into the evidence mark.
- Readable at 32 px; no tiny text.

## Splash master
- Closed case folder opens into a structured relationship/evidence graph.
- Wordmark: **Bobby's Case File**.
- Secondary line: **Evidence before assumptions.**

## Required exports
- 1024×1024 store/PWA icon master
- 512/192/64/32 web exports
- 180 Apple touch icon
- 2732×2732 launch master
- 1920×1080 marketing banner
- screenshots for Search, Case, Subject, Evidence, Timeline, Connections, Report, Opt-Out

## Compatibility rule
Do not rename:
- `atlasverify` package/internal identifiers
- `atlasverify.*` report/schema versions
- provider User-Agent identifiers
- API routes
- DB/migration history
- service-worker cache keys
- persisted case IDs
- repository URLs

inside a display-brand PR.
