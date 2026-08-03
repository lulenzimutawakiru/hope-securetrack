# SecureTrack ERP — Niimbot Print Agent

Enterprise Windows agent that:

1. Registers / heartbeats Niimbot printers to Supabase  
2. Pulls queued `print_jobs`  
3. Writes label payloads to `outbox/` (CSV + JSON) for factory printing  
4. Marks jobs completed and QR codes printed  

## Setup

```bash
cd print-agent
cp .env.example .env
# Edit SUPABASE_URL and AGENT_KEY
npm install
npm run dev
```

### Register agent in Supabase

Generate a key and store SHA-256 hash:

```sql
-- Replace YOUR_KEY and COMPANY_ID
INSERT INTO print_agents (company_id, name, agent_key_hash, status, is_active)
VALUES (
  'a0000000-0000-4000-8000-000000000001',
  'Factory Line 1 Agent',
  encode(digest('YOUR_KEY', 'sha256'), 'hex'),
  'offline',
  true
);
```

Set `AGENT_KEY=YOUR_KEY` in `.env`.

## Production

```bash
npm run build
npm start
```

Run as a Windows Service (Task Scheduler or `node-windows` / NSSM):

```
nssm install SecureTrackERPPrintAgent "C:\Program Files\nodejs\node.exe" "C:\path\to\print-agent\dist\index.js"
nssm set SecureTrackERPPrintAgent AppDirectory C:\path\to\print-agent
nssm start SecureTrackERPPrintAgent
```

## Niimbot hardware

- Pair the printer in Windows Bluetooth settings  
- Queue jobs from Dashboard → Labels → **Queue to Niimbot** (or Print jobs)  
- Agent writes `outbox/<jobId>/`  
- Use Niimbot software or your BLE driver to print from outbox  

Native BLE command encoding for all Niimbot models is model-specific; outbox mode is the supported enterprise path until a certified driver is attached.
