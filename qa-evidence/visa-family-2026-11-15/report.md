# Family visa QA — 15 November 2026

QA only. Final deployed main: 6930ff89061d29c5716fe912b31748805e4bc871. Migration 20261115000001 applied to QA project uvmxxtdneryuuiqcwegx. No production changes.

## Synthetic records

- Demo customer family application STS-VISA-2026-000027: 7355d9b6-d834-45d8-a64a-994d608da2b4.
- Turkey order STS-2026-000074: faa04784-1597-473c-ad75-cdb8bcc863db. Three synthetic travellers, USD 180 total.
- Simulated office payment only; no money transferred. Invoice INV-2026-000029. All files prominently marked QA ONLY; these are not valid travel documents.
- Family case left Ready for submission, 6/6 verified. No visa office contacted; no email sent and no actual visa lodged.
- Separate two-person QA group draft 82e64a73-8fec-4fbc-a805-57acbe98e138 left at Documents with one test upload. No second order submitted.

## Browser results

1. Family form saved two children and the primary traveller.
2. Document step repeated passport and photo under all three names.
3. Only primary applicant files uploaded: Review blocked and named all four missing child files.
4. Six files uploaded; review showed six correct owner/file pairs and 3 x USD 60.
5. Submitted family application; office payment remained pending, with no invoice and blocked Start review.
6. Admin Orders sorted new order first and linked the complete visa application.
7. Simulated QA cash confirmation generated the invoice and paid customer booking/voucher.
8. Admin started review only after confirmation.
9. Rejected only Child One passport; customer saw only that file requiring replacement.
10. Cancelled a preparing replacement; retry completed, case returned to Document review. Other five files preserved.
11. Admin saw Child One v2 and retained v1 history. Acceptance disabled until all checklist decisions completed.
12. Simulated acceptance of all six files produced 6/6 verified. Mark ready succeeded.
13. Found and fixed a circular email-pack blocker requiring prior lodgement. Final preparation page opened with all six verified owner-labelled attachments and all three applicants in the generated Gmail message.
14. Pack request completed in the UI and unlocked Open Gmail draft. Browser download-event capture timed out; downloaded ZIP bytes were not independently inspected in this browser run. Automated route/ZIP tests passed.
15. Group member with blank expiry could not save (native required validation). Group document checklist repeated per person.
16. After fixing stale upload display, group passport showed Uploaded without manual reload.

## Fixes discovered during browser testing

- Refresh once the upload batch drains, avoiding overlapping stale checklist refreshes; retain inline failures.
- Identify traveller in the top replacement action notice.
- Exclude lodgement itself from prerequisites for preparing a submission pack; retain payment, document and applicable appointment checks.

## Automated validation

Web/API TypeScript checks and touched-source ESLint passed. Eight targeted Node test files passed covering family ownership, validation, upload queue/transfer, payment guards/review, admin queue and submission packet. Additional family replacement-notice and lodgement regression tests passed. Actual migration functions were exercised against isolated PostgreSQL fixtures, including missing child uploads, wrong member ownership, draft replacement rollback, custom file scopes and family submission pricing. Lifecycle helpers are stubbed in those fixtures, so this is not full backend integration coverage.

## Limits

This establishes the family booking, manual office payment simulation and per-person document/replacement flow. It does not establish every possible edge case. Mixed-nationality eligibility per traveller, real gateway settlement, real email delivery, concurrent-tab edits during deployment, PDF invoice rendering, all appointment/passport workflows and large-file production network conditions remain outside this run. A QA deployment interrupted an unsaved group form; reload recovered the page and the test fields were re-entered. The top replacement-name correction has automated coverage but was not separately browser-rejected again after deployment.

Temporary browser tab closed. Isolated PostgreSQL stopped. No local development servers started.
