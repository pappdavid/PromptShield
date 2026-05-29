# AgentSec Threat Model

## Overview
This document outlines the security posture and known gaps of the AgentSec platform.

## Assets
- Approval/Audit database
- Policies
- Runtime API endpoints

## Trust Boundaries
- Public Internet -> API
- API -> Database
- Admin -> UI

## Attack Surface
- Runtime API
- Polling API
- Public Demo Routes

## Current Controls
- Basic input validation
- Prisma ORM against SQLi
- Next.js route protection

## Known Security Gaps (The Backlog)
- Lack of API authentication
- Un-authenticated runtime endpoints
- Lack of rate limiting
- Tamper-able audit logs
