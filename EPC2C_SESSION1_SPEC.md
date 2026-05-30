# EPC2C Session 1 Build Spec

## Goal
Separate homepage from calculator. 
Redesign homepage as marketing/trust page.
Build /epc-c-calculator as standalone tool page.
Add trust pages.

## URL Structure
/ — homepage (marketing only)
/epc-c-calculator — full tool
/dashboard — (Session 2)
/report/[id] — (Session 2)
/dea — DEA partnership page
/agents — letting agents page
/about — about us
/privacy — privacy policy
/terms — terms of use
/methodology — methodology

## Homepage Structure (in order)

### NAV
Logo | How it works | Pricing | Sign in
No DEA link in nav — move to footer

### HERO
Headline: "Find the most practical route to EPC C compliance"
Subheadline: "Interactive property upgrade pathways, 
estimated costs, savings and MEES exemption awareness."
CTA button: "Check your property →" → /epc-c-calculator

### LIVE PREVIEW SPLIT
Left: postcode input + "Check Property" button
→ redirects to /epc-c-calculator?postcode=XX
Right: interactive mini demo (existing live preview)
- toggles, band bar moves, exemptions unlock
- visual explainer only, no payment on homepage

### HOW IT WORKS
3 steps:
1. Search your property
2. Explore upgrade pathways  
3. Get your personalised compliance report

### WHAT THE REPORT INCLUDES
6 feature cards:
- Compliance pathways
- Estimated upgrade costs
- EPC band uplift estimates
- MEES exemption awareness
- Funding opportunities
- Future property considerations

### SAMPLE REPORT PREVIEW
Blurred/mock PDF pages showing:
- Pathway section
- Exemption section
CTA: "View sample report"

### WHY EPC2C EXISTS
"EPCs tell landlords what improvements exist — 
not the most practical route to compliance.
EPC2C was built to fill that gap."

### TRUST STRIP
Logos: Elmhurst Energy | TrustMark | MCS | 
PAS 2030 | Gas Safe | NICEIC
Text: "DEA-informed | Built by retrofit installers 
| Based on official EPC data"

### MEES TIMELINE
2018 → 2020 → Now → 2028 → 2030

### FAQ
Questions:
1. Is this an official EPC?
2. Can you guarantee EPC C?
3. What if my property cannot reach EPC C?
4. Are exemptions included?
5. How accurate are the cost estimates?
6. How is this different from my EPC?

### FOR DEAs STRIP
Brief section — "Are you a DEA?" → /dea

### FINAL CTA
"Check your property →" → /epc-c-calculator

### FOOTER
How it works | Pricing | About | Contact
Privacy | Terms | Methodology | Cookies
For DEAs | For Letting Agents
© 2025 EPC2C · Powered by GoGreen Alliance Ltd

## /epc-c-calculator Page

### What it contains
Everything currently on homepage tool:
- Postcode search (receives ?postcode= from homepage)
- Property selection
- Ownership question (6 months)
- Listed/conservation question
- Free verdict + band bar
- Improvements since EPC panel
- Upgrade tiers (Free / £19.99 / £149)
- Interactive tool after payment
- PDF download

### Key behaviours
- If ?postcode= in URL auto-populate and search
- Turnstile CAPTCHA before search (Session 2)
- T&C checkbox before search (Session 2)
- Magic link auth on payment (Session 2)

## Trust Pages

### /about
Company: GoGreen Alliance Ltd
Founded: 2016
Tel: 01902 947799
Email: hello@epc2c.co.uk
Address: 4 Shaw Park Business Village, 
Shaw Road, Wolverhampton WV10 9LE
Company No: 10365619
VAT: 309154710
Data Protection: ZA324658
Gas Safe: 629994

Content:
"GoGreen Alliance has been at the forefront of 
domestic energy assessment and retrofit in the 
West Midlands since 2016. As qualified DEAs and 
retrofit coordinators, we recognised that landlords 
were receiving EPCs that told them what improvements 
existed — but not the most practical or economical 
route to compliance.

EPC2C was built to fill that gap. Developed by 
practitioners who carry out real assessments on 
real properties, it is the only MEES compliance 
planning tool built from the inside out — by the 
people who do the work.

We are the West Midlands' leading MEES compliance 
specialists."

Accreditations: TrustMark, Elmhurst Energy, 
MCS, Gas Safe (629994), NICEIC, PAS 2030

### /privacy
Standard privacy policy.
Include:
- Company details above
- Data Protection No: ZA324658
- What data collected (email, property searches)
- How used (compliance reports, account)
- Third parties (Stripe, Supabase, Vercel)
- Cookie usage
- Rights (access, deletion, portability)
- Contact: hello@epc2c.co.uk

### /terms
Standard terms of use.
Include:
- Service description
- Not an official EPC
- Not legal advice
- Estimates are indicative only
- Payment terms (Stripe)
- Refund policy
- Limitation of liability
- Governing law: England and Wales

### /methodology
Explain:
- Data source: Official EPC Register API
- Confidence levels (Low/Medium/High/Verified)
- How band uplift is estimated
- How costs are calculated
- GoGreen Alliance m² rates
- SAP sequential subtraction method
- Why not a certified RdSAP calculation
- When to get a verified survey

## Branding
Colors: Navy #0f1e33 | Teal #4ecba8 | Warm #f5f2ec
Fonts: Fraunces (headlines) | DM Sans (body)
Style: Clean, professional, trust-focused

## Company Details (use throughout)
Name: GoGreen Alliance Ltd
Address: 4 Shaw Park Business Village, 
Shaw Road, Wolverhampton WV10 9LE
Tel: 01902 947799
Email: hello@epc2c.co.uk
Company No: 10365619
VAT: 309154710
Data Protection: ZA324658
Gas Safe: 629994

## Session 2 (do not build yet)
- Supabase database setup
- Magic link authentication  
- Cloudflare Turnstile CAPTCHA
- T&C checkbox on calculator page
- Dashboard (/dashboard)
- Report history (/report/[id])
- Property persistence
- User accounts

## Notes for Claude Code
- Keep all existing tool logic intact
- Do not break EPC API integration
- Do not break Stripe payment links
- Vercel deployment — push to GitHub
- One commit at end of session
- Test locally before pushing