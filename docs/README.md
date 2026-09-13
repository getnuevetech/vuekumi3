# Vuekumi — planning documents

Read in order:

1. **[00-CODE-REVIEW.md](./00-CODE-REVIEW.md)** — what the static template contains today: a
   route-by-route inventory of the public, contributor, and admin sections with every element
   listed, the 22 concrete defects found in the current code, and what is worth keeping.
2. **[01-IMPLEMENTATION-PLAN.md](./01-IMPLEMENTATION-PLAN.md)** — the proposed stack, target
   repository layout, full domain model, API surface, and an eleven-phase execution plan from
   frontend hardening through backend build to go-live, plus cross-cutting security,
   performance, and testing requirements.
3. **[02-DEPLOYMENT-LIGHTSAIL-DOCKER.md](./02-DEPLOYMENT-LIGHTSAIL-DOCKER.md)** —
   Docker-based local development and the AWS Lightsail deployment plan: a single Compose
   instance for MVP, Lightsail container services with managed data stores for scale, CI/CD,
   configuration, operations, and indicative cost.

Nothing in these documents has been implemented. The repository code is unchanged apart from
this `docs/` directory.
