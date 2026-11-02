# AtlasVerify Competitive Product Roadmap

Status: authoritative competitive target
Current product: AtlasVerify
Naming: public rename still pending

## Product goal

Build a consumer and investigator-grade lawful people-search and public-records platform that can compete with BeenVerified, Whitepages, InfoTracer, Intelius, TruthFinder, Instant Checkmate, Spokeo, PeopleFinders and adjacent services while differentiating on evidence quality, source transparency, confidence scoring, privacy controls and clear legal-use boundaries.

## Competitive baseline

The product must support, where lawful and supported by licensed/public data sources:

### Search entry points
- full name + city/state
- phone number
- email address
- street address
- username/handle
- known associate/relative
- vehicle/VIN only when sourced lawfully and licensed
- business/entity lookup where public/licensed records permit it

### Identity resolution
- aliases / alternate names
- approximate age / DOB range when lawfully available
- current and prior addresses
- phone history
- email history
- relatives
- household members
- associates
- address co-occupancy history
- confidence score per identity match
- conflict detection between sources
- duplicate-person merge review

### Public-record categories
- property ownership and deed references where available
- business/entity affiliations
- liens/judgments/bankruptcies where lawfully available
- court docket references
- criminal/court records only with strong source labeling and matching safeguards
- sex-offender registry references from official sources
- professional licenses
- voter/public civic records only where lawful
- vehicle history through licensed/authorized providers
- social/profile links from public web evidence
- domain/business ownership where public
- public sanctions/watchlist checks where applicable

### Reverse lookup
- reverse phone
- reverse email
- reverse address
- username discovery
- public web/profile correlation
- optional reverse image only through lawful providers with clear provenance

## Better-than-competitor differentiators

### Evidence-first reports
Every finding should show:
- source name
- source type: official public record, licensed provider, public web, user supplied
- retrieval timestamp
- source URL or record locator when permitted
- exact fields that supported the match
- match confidence
- stale-data warning
- conflicting-source warning
- whether the finding was independently corroborated

No red-flag/criminal label may be elevated without strong identity-match evidence.

### Confidence engine
Score matches using:
- name similarity
- DOB/age compatibility
- address overlap
- phone overlap
- email overlap
- relative/associate overlap
- timeline consistency
- source reliability
- recency
- contradiction penalties

Show the score and reasons, not a black box.

### Case graph
Visualize:
- person
- addresses
- phones
- emails
- relatives
- associates
- properties
- businesses
- vehicles
- court/public-record nodes
- source records

Every edge must retain provenance.

### Timeline
Build a chronological timeline from:
- addresses
- phones
- emails
- property events
- business filings
- court events
- public-record events
- user-added verified facts

### Report quality
- quick summary
- full report
- raw evidence table
- source-by-source appendix
- confidence/conflict section
- PDF/JSON/CSV export
- shareable case package with expiring access
- immutable audit receipt

### Saved monitoring
For user-owned cases only:
- notify when a linked public/licensed source changes
- re-run stale findings
- highlight only changed facts
- never silently overwrite previous evidence

## Search UX

### Quick Search
One box that accepts:
- name
- phone
- email
- address
- username

Auto-detect query type and offer refinements.

### Progressive disclosure
1. candidate matches
2. identity summary
3. expanded report
4. evidence/source detail

Avoid fake loading theatrics or misleading teaser counts.

### Mobile-first
- PWA/native shell
- saved searches
- case bookmarks
- report export
- notifications
- one-handed navigation

## Privacy and user rights

- visible opt-out/suppression process
- identity verification for suppression requests
- deletion/request history
- correction/dispute workflow
- data-source transparency page
- suppression propagation into AtlasVerify's own index/caches
- no dark patterns for removal requests
- no republishing suppressed AtlasVerify profile data unless legally required or newly sourced under a permitted basis

## Legal boundary

AtlasVerify is not to be marketed or used as an FCRA consumer reporting agency unless a separate, fully compliant FCRA product and compliance program is created.

Prohibited without a dedicated FCRA-compliant product:
- employment screening
- tenant screening
- credit eligibility
- insurance eligibility
- other FCRA-covered eligibility decisions

The UI must state this at search, report and export surfaces.

## Abuse prevention

- rate limits
- authenticated accounts for deeper reports
- abuse monitoring
- prohibited-use attestations
- stalking/harassment safeguards
- sensitive-person handling
- access logging
- query anomaly detection
- opt-out enforcement
- blocked bulk enumeration patterns
- human review for abuse escalations

## Data-provider architecture

Provider adapters should be modular:
- public-record adapters
- licensed enrichment adapters
- phone/carrier adapters
- property adapters
- court/public-record adapters
- public-web adapters
- identity-resolution engine

Every provider response must normalize into a common EvidenceFact schema with provenance and timestamp.

## EvidenceFact minimum schema

- fact_id
- subject_id
- category
- value
- normalized_value
- source_name
- source_type
- source_locator
- retrieved_at
- observed_at when known
- confidence
- corroboration_count
- conflicts[]
- raw_record_hash
- legal_basis / provider terms reference when applicable

## Competitive release sequence

### Wave 1 — Search parity
- name search
- phone search
- email search
- address search
- candidate matching
- relatives/associates
- address history
- evidence attribution
- report export

### Wave 2 — Depth
- property
- businesses
- court/public records
- licenses
- social/profile correlation
- timeline
- case graph
- confidence engine

### Wave 3 — Trust advantage
- disputes/corrections
- consumer opt-out
- source transparency
- report change tracking
- saved monitoring
- stale/conflict warnings
- audit receipts

### Wave 4 — Premium intelligence
- licensed vehicle/VIN data
- licensed phone/email enrichment
- organization/entity relationship graph
- advanced cross-source resolution
- team/case collaboration
- API access with strict policy controls

## Release gate

A feature is not "supported" until:
- source/provider is actually connected
- test fixtures pass
- identity-resolution false-positive tests pass
- data provenance is visible
- opt-out impact is verified
- abuse controls are active
- legal-use copy is present
- production query returns real, not simulated, data
