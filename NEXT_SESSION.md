# EPC2C — Next Session TODO

## 1. Deploy proxy.js to Railway.app
- Create a Railway.app account / project
- Deploy the `proxy.js` Node server from `C:\Users\Marcus\epc2c\`
- Set environment variables in Railway: `EPC_EMAIL`, `EPC_API_KEY`, `EPC_BASE`, `PROXY_PORT`
- Note the public Railway URL (e.g. `https://epc2c-proxy.up.railway.app`)

## 2. Update PROXY_BASE in both HTML files
- In `epc2c_v3.html` — find line: `const PROXY_BASE='http://localhost:3001/api/epc';`
- In `epc2e.html` — find line: `const PROXY_BASE='http://localhost:3001/api/epc';`
- Replace `http://localhost:3001` with the live Railway URL in both files
- Re-upload both files to SiteGround after change

## 3. Register epc2e.co.uk on SiteGround
- Add `epc2e.co.uk` as an addon domain or subdomain on the SiteGround account
- Upload `epc2e.html` (renamed to `index.html`) to its web root
- Confirm SSL certificate is issued

## 4. Register hello@epc2c.co.uk on new EPC API (after 30 May 2026)
- The EPC Open Data Communities API requires registration
- Register at: https://epc.opendatacommunities.org/
- Use email: hello@epc2c.co.uk
- Update `.env` with the new `EPC_EMAIL` and `EPC_API_KEY`
- Redeploy proxy.js on Railway with updated env vars

## 5. Test full journey on live SiteGround site
- Enter a postcode → properties list appears
- Select a property → free verdict, band bar, improvements panel all display
- Select measures → PDF download works
- Click £19.99 button → correct Stripe page loads
- Click £149 survey button → correct Stripe page loads
- Complete a test payment → return to site shows compliance tool (or postcode fallback banner if sessionStorage lost)
