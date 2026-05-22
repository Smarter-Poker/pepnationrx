# Certification Readiness Review

An engineering self-assessment of how PepNationRX maps to the LegitScript
Healthcare Merchant Certification requirements and to the HIPAA Privacy and
Security Rules. It records what the build delivers, what is still outstanding,
and what must be completed before a production launch.

This document is an internal engineering review. It is not a legal opinion and
it is not certification. Certification and a final HIPAA determination must be
made by qualified legal and compliance counsel and by LegitScript itself.

## 1. Scope

PepNationRX is a technology platform and management services organization
(MSO). It is the designated billing agent between three independent parties:
the patient, an independent licensed medical group, and a licensed 503A
compounding pharmacy. PepNationRX does not provide medical care and does not
dispense medication. This MSO posture shapes every item below.

## 2. LegitScript Healthcare Merchant Certification

LegitScript certification is the practical gate for card processing and
advertising in regulated healthcare. The key requirements and how the build
addresses them:

- Transparent identity and role. The MSO disclosure is fixed text in
  `config/constants.js` (`MSO_DISCLOSURE`), shown in the application shell
  footer and presented as a mandatory checkout consent. It states plainly that
  PepNationRX does not provide care and acts solely as the billing agent.
- Licensed providers. Clinical review is performed only by the independent
  medical network (Wheel / SteadyMD). The `providers` table records each
  prescriber by NPI and licensed states; PepNationRX employs no providers.
- Licensed pharmacy fulfillment. Compounded medications route only to a
  licensed 503A pharmacy through the pharmacy integration; the `pharmacies`
  table records license number and states served.
- Valid prescription before dispensing. The flow is enforced structurally: a
  `pharmacy_orders` row can only be created from an approved `prescriptions`
  row, which is created only from a signed prescription delivered by the
  verified medical-network webhook.
- Clinical screening. The branching triage questionnaire screens every
  patient, derives a `clinical_risk_level`, and halts on any disqualifying
  answer rather than routing the patient to treatment.
- Truthful claims. The catalog records each treatment's `compound` status
  (branded, compounded, or over-the-counter) and `availability`, so the
  storefront cannot misrepresent what is offered.
- Complete records. Every clinical and financial action is written to
  `audit_log`.

Outstanding for certification: the LegitScript application itself, merchant
underwriting, advertising-policy review, and confirmation that each partner
(medical group, pharmacy, processor) holds current licensure.

## 3. HIPAA Posture

PepNationRX handles protected health information (PHI) and is a covered
entity's business associate within the MSO arrangement.

### Security Rule alignment

- Encryption in transit. The load balancer terminates TLS 1.2 or higher and
  routes only to private subnets.
- Encryption at rest. RDS encryption at rest is enabled; in addition, PHI
  fields are encrypted at the application layer with AES-256-GCM
  (`encryption.service.js`) before they reach the database. The `_encrypted`
  BYTEA columns never hold plaintext.
- Access control. Every API route is behind JWT authentication; role-based
  authorization is enforced by `middleware/authorize.js`. Refresh tokens are
  stored only as SHA-256 hashes and support revocation and reuse detection.
- Audit controls. All authentication events and all PHI access are written to
  the append-only `audit_log` table. `middleware/audit.middleware.js` records
  PHI access declaratively; controllers also record PHI access explicitly.
- Integrity. Inbound webhooks are HMAC-verified against the raw request body
  and de-duplicated through `webhook_events`, so a replayed or forged event
  cannot alter clinical or financial state.
- Transmission security. PHI sent to the medical network travels only over
  the authenticated TLS client; PHI is never written to application logs.

### Privacy Rule alignment

- Minimum necessary. Non-identifying clinical metadata is stored in typed
  columns for triage logic; the full identifying answer set is encrypted.
- Consent. The `consents` table records each mandatory acknowledgment
  (MSO billing agent, telehealth informed consent, HIPAA authorization, terms,
  privacy policy) with the document version, IP address, and timestamp.
- Accounting of disclosures. The `audit_log` table is the basis for an
  accounting of PHI disclosures.

### Outstanding for HIPAA

- A signed Business Associate Agreement with every vendor that touches PHI:
  the cloud provider, the medical network, the pharmacies, and the email/SMS
  provider.
- A completed Security Risk Assessment.
- Documented administrative safeguards: workforce training, an incident
  response plan, a breach notification procedure, and a sanction policy.
- A penetration test and a dependency vulnerability review before launch.
- Confirmation of audit log retention and tamper-evidence in the production
  environment.

## 4. Audit Trail

The `audit_log` table is append-only and high-volume (BIGSERIAL key). It
captures the actor, the actor's role, the action, the entity type and id,
whether PHI was accessed, the request IP and user agent, and a timestamp.
Scheduled jobs also write a run record to `audit_log`, so the operational
history is auditable alongside user activity.

## 5. Launch Gate

Before production launch, the following must be true:

1. LegitScript Healthcare Merchant Certification is granted.
2. A HIPAA Security Risk Assessment is complete and findings are remediated.
3. Business Associate Agreements are signed with every PHI vendor.
4. Legal and compliance counsel has reviewed the consent flow, the MSO
   disclosure, and state-by-state telemedicine requirements.
5. A penetration test has been completed and findings remediated.
6. Production secrets are managed in AWS Secrets Manager / KMS, not in files.

Until every item above is satisfied, PepNationRX must not process live
patients or payments.
