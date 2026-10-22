# Week 4 security checklist

- [ ] HTTPS only in staging/production
- [ ] Meta webhook signature verified before parse
- [ ] Paystack signature verified; IP allowlist on in production
- [ ] No secrets in client bundle (R-5 / gitleaks CI)
- [ ] RLS enabled; browser uses anon key only for auth + realtime
- [ ] Service role used only after `requireRole`
- [ ] `sends.paused` kill switch tested
- [ ] Media bucket private; signed URLs only
- [ ] Automation settings all default off
