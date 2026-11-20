# BookNest Marketplace — Staging Deployment Guide

## Overview
Staging is an exact mirror of production architecture used for end-to-end regression validation, sandbox payments testing, and pre-release verification.

## Deployment Steps
1. Deploy using `docker-compose.staging.yml`.
2. Configure sandbox Razorpay test credentials.
3. Run `node server/test_production_smoke.js`.
