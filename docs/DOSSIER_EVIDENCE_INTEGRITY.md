# Dossier evidence integrity

Candidate fixes the freshness ledger to distinguish observation age from acquisition time. Missing, invalid, future and inconsistent observation timestamps do not establish current facts. Existing age bands remain heuristic, not proof of present validity. Latest observation and latest retrieval are separately reported; the twelve-item display remains bounded. Existing API fields and stored records remain intact.

The owner-scoped profile endpoint checks approved suppression before constructing the primary dossier and excludes suppressed sibling records before existing duplicate review. Successful dossier responses are private/no-store. UI no longer displays duplicate, resolution or mean provider confidence percentages in these panels; existing backend heuristics are unchanged and not statistically calibrated. No new identity correlation, external search, personal-data collection, or automated merging. Existing source records and reports remain untouched.

Tests use synthetic evidence records and source wiring assertions. They do not establish database integration, runtime authorization behavior, race-free suppression, whole-app type checking, or browser correctness. Those remain release blockers. No deployment or merge authorized.
