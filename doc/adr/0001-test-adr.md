# ADR-0001: Record Architecture Decisions

Date: 2026-06-04

## Status

Pending

## Context

The reasoning behind significant decisions becomes invisible over time, leaving future contributors unable to understand why things were built the way they were.

## Decision

We will use Architecture Decision Records (ADRs) as described by Michael Nygard to capture decisions that affect structure, non-functional requirements, dependencies, interfaces, or construction techniques. ADRs are stored in `doc/adr/`, numbered sequentially, zero-padded to four digits. Numbers are never reused; superseded ADRs are retained and cross-referenced.

## Consequences

The motivation behind significant decisions is visible to everyone, present and future. Implementation details and decisions obvious from the code itself do not need an ADR.

For background, see Michael Nygard's original [article](http://thinkrelevance.com/blog/2011/11/15/documenting-architecture-decisions).
