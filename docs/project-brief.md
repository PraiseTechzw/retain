# CUT Employee Lifecycle & Asset Management System (CUT-ELAMS)

**Prepared by:** Ruth Makanaka Shawatu
**Source:** Project brief supplied by the product owner on 2026-10-11.

## Executive summary

CUT-ELAMS is a proposed talent-intelligence and employee-lifecycle system for Chinhoyi University of Technology. It aims to replace manual HR records and circulating clearance forms with structured digital employee, leave, asset, knowledge-handover, exit, and reporting workflows. It also proposes rule-based early-warning analytics to support human retention conversations.

## Problem and current process

The brief identifies fragmented paper processes for clearance, leave, equipment movement, and employee records. Physical clearance forms can delay approvals and asset return. Paper-bound exit data also makes it difficult to analyze turnover patterns or preserve institutional knowledge.

## Scope

The system is intended to support employee records and recruitment mapping through digital exit, self-service leave and balance tracking, asset assignment and daily monitoring, ICT/Library verification, knowledge handover, role-based access for employees/Attachés/Support Staff, quarterly turnover analysis, aggregate commute groupings, HR support follow-ups, and management reporting. A validated employee attrition prediction is not implemented.

Payroll processing, student management, and daily attendance are explicitly excluded. The brief also describes a final-salary clearance gate. In this repository, the digital exit gate does not itself instruct, block, or release payroll; that requires an approved payroll integration and is documented as a scope boundary rather than a delivered payment control.

## Objectives from the brief

| Objective | Target in brief | Measurement or acceptance boundary |
| --- | --- | --- |
| Analyze attrition | Quarterly turnover-driver reports within 90 days of deployment. | Validate reporting logic and compare snapshots with approved HR data; code alone does not demonstrate the institutional outcome. |
| Predict flight risk | Early-warning engine within nine months. | Not implemented. A production prediction requires institution-approved outcome data, validation, fairness/privacy review, and governance. The current page is a support-action workspace and must not rank employees. |
| Digitize clearance | Convert 100% of manual clearance forms within six months. | The app provides an exit/clearance workflow; the percentage converted is an adoption measure. |
| Secure assets daily | 100% real-time visibility/accountability and clearance verification before final salary disbursement. | App supports assignment, logging, receipt, verification, and blocks digital exit finalization. Physical inventory coverage and payroll integration remain outside code validation. |
| Streamline leave | Reduce application processing and approval turnaround by 35% within six months of daily usage. | The app records requests/reviews and can calculate elapsed turnaround; baseline and after-period measurements are required. |
| Prevent knowledge loss | Require technical handover before account deactivation. | App finalization checks approved applicable handover; technical requirements must be configured, tested, and maintained. |

## Implementation traceability

See [Requirements audit](requirements-audit.md) for each objective's implementation evidence, known gaps, acceptance scenarios, and deployment status. See [How the system works](system-overview.md) for architecture and workflow diagrams. Do not describe a target as achieved until it has been measured in the operational environment.
