# BookNest Marketplace — Production Rollback Runbook

## 1. Fast Application Rollback
If an application defect is discovered in production:
```bash
# Rollback Docker containers to previous verified tag
docker compose pull booknest_backend:previous_stable_tag
docker compose up -d --no-deps backend
```

## 2. Database Migration Rollback Strategy
- **Forward-Recovery Policy**: In a relational marketplace handling active financial ledgers, backward-destructive rollbacks (`DROP TABLE`) are prohibited.
- Fix bugs forward via targeted corrective migrations (`migrate_phaseX_patch.js`).
- If data corruption occurs, restore the latest verified snapshot using `docs/DISASTER_RECOVERY.md`.

## 3. Cache Invalidation
```bash
# Clear Redis cache post-rollback
redis-cli -h $REDIS_HOST FLUSHDB
```
