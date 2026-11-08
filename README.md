# Lindström Customer Value Reviews

Upload Excel or text-based PDF customer data, create a stakeholder avatar, research country rules, and generate a personalized dashboard and PDF/PowerPoint review.

- The app starts empty and uses operator uploads only. Required tables are validated; missing tables are not filled from previous files.
- Uploaded data, avatars, preferences and research remain in the current browser. There is no shared account storage.
- Company logos use Logo.dev and explicit website/domain fields; company website and colour can also be set through the company appearance control.
- Calculated allocations, assumptions and estimates remain labelled. Uploading does not establish audit assurance. Regulatory research is sourced context, not legal or tax advice.
- Bundled workbook data is retained only as automated-test fixtures, never activated or offered by the app.

## Verification

`bunx vitest run src/lib`
