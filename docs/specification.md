# HandyGo AI Phone Agent — Specification

**Version:** 1.0
**Last updated:** 18 April 2026
**Owner:** Hisham Marouf
**Status:** Phase A build (Receptionist + Zoho Scribe)

---

## 1. Company Overview

**Legal name:** HandyGo Services W.L.L. (هاندي جو سيرفيسيس ذ.م.م.)
**Trading name:** HandyGo / HandyGo Services
**Tagline:** *Reliable. Sustainable. Compliant. Performance-Driven.*

**Contact:**
- Phone: +974 4411 3995
- Email: info@handygo.qa
- Website: handy.qa
- Office: Al Muntazah, Zone 24, St. 840, Bld 34, 4th Floor, Office 403
- P.O. Box: 64074, Doha, Qatar

**Business model:** B2B and B2C — electromechanical and facility management services for residential, commercial, and public properties.

**Core services:**
- HVAC maintenance, AC cleaning, gas refill
- Electrical maintenance (panels, UPS, generators, lighting)
- Plumbing and drainage
- Fire safety and life-safety systems
- BMS, controls, elevator coordination
- Civil maintenance (gypsum, painting, tiling, façades)
- Planned preventive maintenance
- Reactive repair callouts (24/7)
- Civil Defence handover and inspection support

**Signature offer:**
- AC gas refill + full cleaning = **80 QAR per unit**
- **5 or more AC units → 1 unit free**
- Testaheel cardholders → **20% discount on total bill**

**Sectors served:** Residential buildings and compounds, commercial offices, retail, healthcare clinics, educational buildings, industrial sites, public buildings.

**Team:**
- 10 HVAC technicians split into 2 teams
- 1 supervisor overseeing both teams
- Specialised engineers, general supervisor, foremen
- Electricians, plumbing technicians, civil maintenance staff

**Working hours:**
- Saturday–Thursday: 7:00 AM – 8:00 PM
- Friday: 4:00 PM – 8:00 PM
- **Emergencies: 24/7 all services**

**Languages:** English and Arabic (Modern Standard Arabic / Gulf dialect).

---

## 2. What We're Building

### Phase A — Currently in scope

**Agent 1: Receptionist**
- Answers the HandyGo landline 24/7
- Has full bilingual (English/Arabic) conversations with callers
- Handles calls end-to-end without human transfer
- Books jobs, captures all needed info, logs everything in Zoho FSM
- Greets callers with a call recording disclaimer
- Quotes the 80 QAR AC deal and Testaheel discount where applicable
- Never quotes prices for other services — defers to "a technician will assess"
- Works during regular hours and for emergencies

**Agent 2: Zoho Scribe**
- Handles all communication with Zoho FSM
- Creates customers, work orders, looks up existing records
- Used as a shared service by all other agents
- Not user-facing — purely a backend integration

### Phase B — Documented for later (not built yet)

**Agent 3: Post-Job Handler**
- Triggered by Zoho FSM webhook when a work order is marked "Completed"
- Fetches the invoice PDF and job sheet PDF from Zoho
- Sends both to the customer via WhatsApp Business
- Adds a polite thank-you message and follow-up request

Dependencies that block Phase B:
- HandyGo's WhatsApp Business verification (currently pending with Meta)
- Approved WhatsApp message templates (24–48 hr approval per template)
- Zoho FSM webhooks configured for the "Completed" event
- Invoice + job sheet PDF generation confirmed in Zoho FSM workflow

### Phase C — Future (not scoped)

- Agent 4: Prospector (lead finder — scans web for potential B2B customers)
- Agent 5: Outreach (sends cold B2B emails to qualified leads)
- Email agent for quotes, confirmations, reminders

---

## 3. Receptionist Agent — Detailed Spec

### 3.1 Call opening

Every call opens with:

**English:**
> "Thank you for calling HandyGo Services. This call may be recorded for quality and service purposes. How may I help you today?"

**Arabic:**
> "شكراً لاتصالكم بهاندي جو سيرفيسيس. قد يتم تسجيل هذه المكالمة لأغراض الجودة والخدمة. كيف يمكنني مساعدتكم اليوم؟"

**Language detection:** The agent listens to the caller's first response and continues in whichever language they used. If the caller switches languages mid-call, the agent switches too — same voice throughout.

### 3.2 Call types the agent must handle

1. **New job booking** — caller wants a technician dispatched (most common)
2. **AC cleaning enquiry** — caller asking about the 80 QAR offer
3. **Testaheel discount enquiry** — caller mentioning the partnership
4. **Emergency callout** — burst pipe, electrical fault, AC failure in peak heat
5. **Existing customer follow-up** — "I had a technician last week, still having issues"
6. **Quote enquiry** — "how much for X service?" (answer: technician will quote)
7. **General information** — services offered, areas covered, working hours
8. **Wrong number / not relevant** — polite wrap-up
9. **Complaint** — capture details, log in Zoho, reassure callback

### 3.3 Information the agent must capture (every call)

**Mandatory fields for Zoho Work Order creation:**
- Full name
- Phone number (caller's number, confirmed)
- Service type (HVAC / Electrical / Plumbing / Civil / Fire Safety / Other)
- Specific issue description
- Building type (Villa / Apartment / Commercial / Industrial / Other)
- Urgency (Emergency / Today / This week / Flexible)
- Preferred date/time window (if not emergency)
- Location (verbal address for now — WhatsApp location in Phase B)

**Optional but valuable:**
- Testaheel card status (yes/no)
- Number of AC units (if AC cleaning enquiry — affects pricing)
- Email address (for Phase B invoice/report delivery)
- How they heard about HandyGo

### 3.4 Pricing rules

The agent may quote:
- **AC gas + full cleaning:** 80 QAR per unit
- **5+ AC units:** 1 free (so 5 units = 4 × 80 = 320 QAR, 6 units = 5 × 80 = 400 QAR, etc.)
- **Testaheel discount:** 20% off the total bill, applies to any service

The agent must NOT quote prices for:
- Electrical work
- Plumbing
- Fire safety
- Civil/finishing
- BMS/elevators
- Any other service

For any non-AC quote request, respond:
> "For this service, one of our technicians will assess on-site and provide you with an accurate quote. There's no charge for the assessment."

### 3.5 Scheduling rules

**Regular jobs** can be booked during working hours:
- Sat–Thu: 7:00 AM – 8:00 PM
- Fri: 4:00 PM – 8:00 PM

**Emergencies** are accepted 24/7 for all services. Definition of emergency:
- No cooling in summer (interior temp becomes unsafe)
- Major water leak or burst pipe
- Electrical fault causing outage or fire risk
- Fire safety system failure
- Lift trapped/stuck
- Anything the caller describes as urgent and is a genuine safety/property risk

For emergencies, the agent acknowledges urgency immediately and promises a technician within [TBD — Hisham to decide SLA: 1 hour? 2 hours?].

### 3.6 Handoff policy

**No live human transfer.** The AI handles the full call. The only exception is if the caller explicitly asks for a human, in which case the agent offers to take their number and arrange a callback.

### 3.7 Location capture

**Current (Phase A):** Verbal address only. Agent asks for:
- Area/district (Al Muntazah, Lusail, Al Gharafa, etc.)
- Street / Zone / Building number
- Nearest landmark (optional but helps)

**Future (Phase B, pending WhatsApp verification):** Agent asks caller to share WhatsApp location pin to the HandyGo WhatsApp Business number. A separate WhatsApp agent receives the location and attaches it to the Zoho work order.

### 3.8 Call closing

Every call ends with:
1. A summary readback: *"So to confirm — [name], you'd like [service] at [address] on [date/time], correct?"*
2. An expectation: *"A technician will call you before arriving."* / *"For emergencies, a technician will be on the way within [SLA]."*
3. A polite close: *"Thank you for choosing HandyGo. Have a good day."* / *"شكراً لاختياركم هاندي جو. نهاركم سعيد."*

---

## 4. Zoho Scribe Agent — Detailed Spec

### 4.1 Responsibilities

- Authenticate with Zoho FSM via OAuth 2.0 (self-client flow)
- Refresh access tokens automatically when they expire
- Expose the following operations to other agents:
  - `lookup_customer_by_phone(phone)` → returns customer record or null
  - `create_customer(name, phone, email, address)` → returns customer ID
  - `create_work_order(customer_id, service_type, description, urgency, scheduled_time, location)` → returns work order ID
  - `update_work_order(id, fields)` → for later additions
  - `list_services()` → returns available service types from Zoho
  - `list_technicians()` → future use

### 4.2 Zoho FSM data region

- Region: US (api-console.zoho.**com**)
- All API calls go to `https://www.zohoapis.com/fsm/v1/...`

### 4.3 Credentials

Stored in `.env`:
- `ZOHO_CLIENT_ID`
- `ZOHO_CLIENT_SECRET`
- `ZOHO_REFRESH_TOKEN` (obtained via one-time OAuth grant in Phase 3)
- `ZOHO_REGION=com`

### 4.4 Error handling

- Retry failed API calls up to 3 times with exponential backoff
- On persistent failure: log the full context, queue the job locally, alert Hisham
- Never drop a call's data silently — if Zoho is unreachable, the work order goes into a retry queue

---

## 5. Technology Stack

| Layer | Choice | Why |
|---|---|---|
| Phone | Twilio | Most flexible, industry standard |
| Speech-to-Text | Deepgram (multilingual, nova-3) | Real-time, handles English + Arabic |
| LLM / Brain | Anthropic Claude (Sonnet 4.5 tier) | Best reasoning for multi-turn calls |
| Text-to-Speech | ElevenLabs (multilingual v2) | Highest voice quality, same voice for both languages |
| CRM | Zoho FSM | Already in use by HandyGo |
| Runtime | Node.js 24 LTS | Modern, well-supported |
| Hosting | Railway | Simplest for Node.js apps |
| Version control | GitHub (private repo) | Standard |

---

## 6. Non-Functional Requirements

- **Latency:** AI reply should begin playing within 1.5 seconds of caller finishing speaking
- **Uptime:** 99%+ (Railway's standard)
- **Privacy:** Call transcripts stored encrypted, retained 90 days by default
- **Compliance:** Call recording disclaimer announced on every call
- **Cost ceiling:** Target under 200 QAR/month API costs at current call volume (TBD — awaiting baseline)

---

## 7. Success Criteria (for Phase A launch)

The receptionist is considered production-ready when:

1. 10 test calls complete successfully end-to-end, in both English and Arabic
2. 10 test work orders appear correctly in Zoho FSM with all mandatory fields populated
3. Latency consistently under 1.5s per turn
4. Agent correctly quotes 80 QAR AC deal and Testaheel discount
5. Agent correctly declines to quote non-AC prices
6. Agent correctly identifies emergencies and adjusts SLA messaging
7. At least one live call from a real customer (not a test) completes successfully

---

## 8. Open Questions / TBD

- Emergency SLA: how fast should the agent promise for emergencies? (Suggest 1–2 hours in Doha)
- Callback policy for non-emergencies: same day? next business day?
- How to handle callers outside Qatar (wrong number vs. sales enquiry)?
- What to say if a caller asks about services HandyGo doesn't offer (pest control, cleaning, landscaping)?
- Should the agent remember returning callers and greet them by name? (Requires customer lookup by phone before greeting.)

---

## 9. Change log

- **v1.0 (18 Apr 2026):** Initial spec. Receptionist + Zoho Scribe in scope. Post-job handler and WhatsApp deferred to Phase B. Prospector and outreach deferred to Phase C.
