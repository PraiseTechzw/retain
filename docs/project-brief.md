# CUT Employee Lifecycle & Asset Management System (CUT-ELAMS)

**Prepared by:** Ruth Makanaka Shawatu
**Source:** Project brief supplied by the product owner on 2026-10-11.

## Executive summary

CUT-ELAMS is a proposed talent-intelligence and employee-lifecycle system for Chinhoyi University of Technology. It aims to replace manual HR records and circulating clearance forms with structured digital employee, leave, asset, knowledge-handover, exit, and reporting workflows. It also proposes rule-based early-warning analytics to support human retention conversations.

## Problem and current process

The brief identifies fragmented paper processes for clearance, leave, equipment movement, and employee records. Physical clearance forms can delay approvals and asset return. Paper-bound exit data also makes it difficult to analyze turnover patterns or preserve institutional knowledge.

## Governing scope

The latest product-owner objectives are the governing product scope. CUT-ELAMS should deliver the six outcomes below and the workflows necessary to achieve them. Features outside those outcomes are not automatically in scope merely because they exist in the current implementation; see the [requirements audit](requirements-audit.md) for implementation gaps and additional modules.

The current app can block digital exit finalization when clearance requirements are incomplete, but it does not instruct, block, or release a salary payment. Payroll control is not one of the latest six objectives; if it is reinstated, it requires an institutional payroll owner and approved integration.

## Governing objectives supplied by the product owner

| Objective | Target | Measurement or acceptance boundary |
| --- | --- | --- |
| Analyze attrition | Generate automated quarterly turnover reports within 90 days to analyze attrition drivers. | Validate reporting logic, schedule, access, and snapshots against approved HR data; source code alone does not demonstrate the operational target. |
| Predict flight risk | Deploy an Early Warning Engine within nine months to predict staff flight risk. | No predictive model is currently implemented. Any model requires institution-approved outcome data, prospective validation, privacy/fairness review, human oversight, and governance before operational use. |
| Digitize clearance | Convert 100% of manual clearance forms into a digital workflow within six months. | The app provides digital exit and clearance workflows; the percentage converted is an adoption measure. |
| Secure assets | Achieve 100% real-time asset tracking through daily logging and automated exit checks. | The app records daily logs and scan/manual/GPS-MDM events and refreshes asset status live. Physical coverage depends on staff check-ins or a connected GPS/MDM provider; coverage must be measured operationally. |
| Streamline leave | Cut leave processing times by 35% within six months of platform deployment. | The app compares a recorded pre-deployment baseline with requests reviewed during the six-month window started by saving that baseline. The baseline must be entered and the target must be validated against operational records. |
| Prevent knowledge loss | Require documentation upload by all technical staff before account deactivation. | The app supports required technical handover checks before digital exit completion and authorized deactivation; applicability and completion must be validated operationally. |

The original project proposal also described recruitment and other functions. Those are not among these six governing objectives and require an explicit decision before they are treated as in-scope product requirements.

## Implementation traceability

See [Requirements audit](requirements-audit.md) for each objective's implementation evidence, known gaps, acceptance scenarios, and deployment status. See [How the system works](system-overview.md) for architecture and workflow diagrams. Do not describe a target as achieved until it has been measured in the operational environment.
