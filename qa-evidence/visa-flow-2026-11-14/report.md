# Visa operations QA — 14 November 2026

Environment: QA only, http://54.74.179.142:3000. Deployed commit b68ab03.
Synthetic data and images marked TEST ONLY were used. No money was transferred and no visa was filed with an issuing authority.

## Test records

- Product: QA ONLY Kenya visa flow 14 Nov (eeef521c-0b64-4c26-b994-089201dc2f30)
- Application: STS-VISA-2026-000024 (51d06486-f037-49a3-8e21-3f46166a8e31)
- Order: STS-2026-000069 (8bb6e0ba-9281-4891-829a-8f01e4e6060b)
- Invoice: INV-2026-000027
- Final observed case state: Visa issued; Paid; 1/1 documents verified. Submission and approval were explicitly labelled QA simulations.
- Test records remain labelled in QA for review; existing customer applications were not edited.

## Browser checks completed

1. Admin created and published the isolated product with USD 10 price, validity, stay limit, processing times, mandatory passport document, and per-traveller passport questions.
2. Customer saw the configured product and its document requirements.
3. Empty required personal information blocked Continue with native validation.
4. Admin-configured Date of issue appeared on the customer form and blocked Continue when unanswered.
5. Completed answers appeared correctly in customer review.
6. Missing mandatory passport upload blocked Review and named the missing document.
7. Unsupported .txt upload was rejected.
8. PNG uploaded and persisted. Defect: the completed upload was not reflected until reload.
9. Application submitted; full USD 10 due, without a visa deposit option.
10. Office payment selection remained pending; admin saw Pending payment approval and no invoice.
11. Simulated QA staff approval settled the order and created invoice INV-2026-000027.
12. Admin saw the application as Paid and started document review.
13. Accept document was disabled before checklist decisions.
14. Admin rejected v1 using a failed check and an applicant note; case changed to Action required.
15. Customer saw the same reason and replacement control.
16. Customer uploaded v2; case returned to Under Review and timeline recorded replacement.
17. Admin saw v2 Awaiting review, with v1 retained as earlier history.
18. Acceptance remained disabled until all checklist items were marked pass for this simulated QA acceptance.
19. Admin accepted v2; 1/1 verified; submission readiness unlocked.
20. Mark ready persisted Ready for submission. Defect: UI remained Working until reload.
21. Recorded a simulated submission with reference QA-SIMULATED-24 and QA image evidence; case entered Submitted / processing.
22. Recorded simulated approval with reference QA-APPROVAL-SIMULATION-24; case entered Approved.
23. Attached synthetic result image; case entered Visa issued. No authority was contacted.
24. Later lifecycle forms also required reload to display persisted results. Added a shared local handler that reloads after success and reports transport failures.
25. Customer saw Visa Issued, all six tracking steps done, the passport document Verified, and Download / Download visa controls.
26. Customer protected document URL resolved to the actual synthetic replacement image. The browser navigation helper timed out because it was an image response, but a screenshot positively verified the image was displayed. See customer-document.png.

## Local fixes prepared, not deployed

- Explicit refresh after successful queued uploads.
- Explicit pending/error handling and refresh for admin stage actions; shared success-reload/error handler for submission, decision, result-upload and related lifecycle forms.
- Detect primary traveller, application and per-traveller answer save failures; do not advance when a save fails.
- Advance travel-step progress only after answers have saved.
- Read the actual snake_case visa travel dates in admin orders, retaining legacy camelCase compatibility.
- Replace the contradictory visa checkout non-refundable statement with the existing pre-filing refund rule.
- Earlier local mandatory-answer fixes remain included: trim whitespace-only text, explicit required Yes/No selection and at least one required multiple-choice selection.

## Automated checks

Web TypeScript and ESLint passed. Twelve targeted tests passed: four visa validation/persistence/date regression tests, two upload queue tests, and six manual payment tests. Database failures are simulated in regression tests; these are not full database concurrency tests.

## Not yet established

The local fixes have not been deployed or browser-retested. The browser run exercised the deployed version and established the defects above. No claim is made that every visa edge case is covered.

Online mobile/card settlement is untested: this QA checkout offered only Bank Transfer and Pay at Office. Bank-transfer receipt verification was not separately exercised in the browser. Additional-document requests (distinct from replacement), family/group ownership and per-member uploads, concurrent-tab edits, cancellation/refund races, outbound email delivery, PDF receipt rendering, appointment/passport workflows, and real authority integration remain separate scenarios to verify. Manual submission/decision/issuance were tested only as QA simulations.
