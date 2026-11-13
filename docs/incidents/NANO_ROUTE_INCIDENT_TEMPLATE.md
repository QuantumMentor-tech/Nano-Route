# Nano Route Post-Mortem & Incident Record Template

## 1. Incident Overview
- **Incident Identifier:** `INC-YYYYMMDD-XXX` (e.g. `INC-20261113-001`)
- **Category:** `[ CAT_A | CAT_B | CAT_C | CAT_D | CAT_E | CAT_F | CAT_G | CAT_H | CAT_I | CAT_J | CAT_K | CAT_L | CAT_M ]`
- **Severity Level:** `[ SEV-1 | SEV-2 | SEV-3 | SEV-4 ]`
- **Incident Date/Time:** `YYYY-MM-DD HH:MM UTC`
- **Resolution Date/Time:** `YYYY-MM-DD HH:MM UTC`
- **Incident Lead:** `[Lead Engineer Name]`
- **Impact Summary:** `[1-2 sentence executive summary of user impact]`

---

## 2. Timeline of Events
All timestamps in UTC.

| Timestamp | Actor / System | Action / Event Description |
|:---|:---|:---|
| `YYYY-MM-DD 00:00` | User / Support | Initial issue reported with diagnostic bundle |
| `YYYY-MM-DD 00:15` | Engineering Lead | Incident declared SEV-X; containment initiated |
| `YYYY-MM-DD 00:45` | Rust Engineer | Reproduction confirmed in local test environment |
| `YYYY-MM-DD 01:30` | Maintenance Team | Containment mitigation deployed / fallback verified |
| `YYYY-MM-DD 03:00` | QA / DevSecOps | Automated regression test authored and verified in CI |
| `YYYY-MM-DD 04:00` | Release Lead | Hotfix binary built, signed, and published |

---

## 3. Technical Root-Cause Analysis (5-Whys Methodology)
1. **Why did the failure occur?**
   - *Answer:* ...
2. **Why did that underlying condition occur?**
   - *Answer:* ...
3. **Why was that condition permitted in production?**
   - *Answer:* ...
4. **Why did automated testing not detect it beforehand?**
   - *Answer:* ...
5. **Why was the failure not caught at compile or lint stage?**
   - *Answer:* ...

---

## 4. Root Cause Summary & Contributing Factors
- **Primary Technical Root Cause:** `[Detailed explanation of the flaw, race condition, schema mismatch, or API change]`
- **Contributing Factors:**
  - Inadequate mock contract fidelity
  - Missing boundary validation on upstream payload
  - Edge-case operating system environment

---

## 5. Corrective & Preventative Actions (CAPA)

| Action ID | Description | Owner | Target Date | Status |
|:---|:---|:---|:---|:---|
| **CAPA-01** | Direct code remediation in hotfix branch | Domain Eng | YYYY-MM-DD | COMPLETED |
| **CAPA-02** | Author automated CI regression test in `__tests__/` | QA Eng | YYYY-MM-DD | COMPLETED |
| **CAPA-03** | Update provider schema contract / documentation | API Eng | YYYY-MM-DD | PLANNED |
| **CAPA-04** | Hardening build gate / lint rule | DevSecOps | YYYY-MM-DD | PLANNED |

---

## 6. Diagnostic Verification & Sign-Off
- [ ] Safe Support Evidence bundle inspected (zero plaintext credentials, paths sanitized)
- [ ] Automated regression test added to CI test suite
- [ ] Regression passed across all target Windows versions
- [ ] Sign-off approved by Lead Security and Release Engineers

