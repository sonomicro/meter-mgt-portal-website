# Architecture Change Plan: Supabase-Centric Data Flow

## Current Architecture Issues

Currently, the application has mixed data flow patterns:
- Some operations go directly to Notehub from the frontend
- Some operations go to Supabase and then sync with Notehub
- Device data comes from Notehub webhooks → Supabase
- This creates inconsistency and potential data synchronization issues

## Proposed Architecture

**All data flows through Supabase as the single source of truth:**

```
Frontend ←→ Supabase Database ←→ Supabase Edge Functions ←→ Notehub
                    ↑
                    │
             Notehub Webhooks
```

### Key Principles

1. **Frontend only communicates with Supabase** (never directly with Notehub)
2. **Supabase is the source of truth** for all application data
3. **Edge Functions act as middleware** between Supabase and Notehub
4. **Notehub webhooks push data** to Supabase automatically
5. **Database triggers and functions** handle complex logic and external API calls

## Detailed Changes

### 1. Tenant Management

**Current Flow:**
- Frontend → Supabase (create tenant)
- Frontend → Notehub (create fleet) ❌ INCONSISTENT

**New Flow:**
- Frontend → Supabase (create/update/delete tenant)
- Database trigger → Edge Function → Notehub (sync fleet)

**Implementation:**
- Create `tenant-sync` edge function that manages Notehub fleets
- Add database trigger on `tenants` table for INSERT/UPDATE/DELETE
- Trigger calls edge function to sync with Notehub
- Store Notehub fleet UID in tenants table

**Changes Required:**
- ✅ New Edge Function: `tenant-sync`
- ✅ New Migration: Add `notehub_fleet_uid` column to `tenants` table
- ✅ New Migration: Add trigger `on_tenant_change` → calls `tenant-sync` function
- ✅ Update `TenantService`: Remove direct Notehub calls
- ✅ Update `secureDatabase.ts`: Handle tenant operations through DB only

### 2. Device Management

**Current Flow:**
- Frontend → Supabase (create device)
- Frontend logic → Notehub (assign to fleet, check existence) ❌ MIXED

**New Flow:**
- Frontend → Supabase (create/update/delete device)
- Database trigger → Edge Function → Notehub (sync device)
- Device status synced via webhooks (already working ✅)

**Implementation:**
- Create `device-sync` edge function that manages Notehub devices
- Add database trigger on `devices` table for INSERT/UPDATE/DELETE
- Trigger calls edge function to:
  - Add device to Notehub project
  - Assign to tenant's fleet
  - Update device metadata
  - Remove device when deleted

**Changes Required:**
- ✅ New Edge Function: `device-sync`
- ✅ New Migration: Add trigger `on_device_change` → calls `device-sync` function
- ✅ Update `DeviceService`: Remove direct Notehub calls
- ✅ Update `secureDatabase.ts`: Handle device operations through DB only

### 3. Device Data Ingestion

**Current Flow:** ✅ ALREADY CORRECT
- Notehub → Webhook Edge Function → Supabase
- Device data, health, location all come through webhooks

**No changes needed** - this is already architected correctly!

### 4. Device Configuration & Commands

**Current Flow:**
- Frontend → Notehub (firmware updates, environment variables) ❌ DIRECT

**New Flow:**
- Frontend → Supabase (update device_settings or create command record)
- Database trigger → Edge Function → Notehub (send command)

**Implementation:**
- Create `device-command` edge function
- Add `device_commands` table to track commands and their status
- Add database trigger on INSERT to `device_commands` table
- Edge function processes commands (firmware updates, env vars, etc.)
- Update command status when complete

**Changes Required:**
- ✅ New Table: `device_commands` (command_type, device_id, payload, status, result)
- ✅ New Edge Function: `device-command`
- ✅ New Migration: Add `device_commands` table and trigger
- ✅ Update `DeviceService`: Create command records instead of calling Notehub
- ✅ Update frontend: Poll or listen for command completion

### 5. Fleet Group Management

**Current Flow:**
- Frontend → Supabase (create fleet_groups) ✅ CORRECT
- Notehub fleet management happens during device assignment

**New Flow:** (mostly same, with improvements)
- Frontend → Supabase (create/update/delete fleet_groups)
- When device is assigned to fleet_group → trigger updates device in Notehub

**Changes Required:**
- ✅ Update `device-sync` function to handle fleet_group_id changes
- ✅ Map fleet_group → Notehub fleet via tenant's notehub_fleet_uid

## Database Schema Changes

### New Tables

```sql
-- Track Notehub fleet UIDs for tenants
ALTER TABLE tenants ADD COLUMN notehub_fleet_uid TEXT;

-- Track device commands and their execution
CREATE TABLE device_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
  command_type TEXT NOT NULL, -- 'firmware_update', 'env_variable', 'fleet_assign'
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  result JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);
```

### New Triggers

```sql
-- Trigger on tenant changes
CREATE TRIGGER on_tenant_change
  AFTER INSERT OR UPDATE OR DELETE ON tenants
  FOR EACH ROW EXECUTE FUNCTION notify_tenant_sync();

-- Trigger on device changes
CREATE TRIGGER on_device_change
  AFTER INSERT OR UPDATE OR DELETE ON devices
  FOR EACH ROW EXECUTE FUNCTION notify_device_sync();

-- Trigger on device commands
CREATE TRIGGER on_device_command_insert
  AFTER INSERT ON device_commands
  FOR EACH ROW EXECUTE FUNCTION process_device_command();
```

## New Edge Functions

### 1. `tenant-sync` Function
- **Purpose:** Sync tenant changes with Notehub fleets
- **Triggered by:** Database trigger on `tenants` table
- **Operations:**
  - INSERT: Create fleet in Notehub, store fleet UID
  - UPDATE: Update fleet name if company name changed
  - DELETE: Archive fleet (Notehub doesn't support delete)

### 2. `device-sync` Function
- **Purpose:** Sync device changes with Notehub
- **Triggered by:** Database trigger on `devices` table
- **Operations:**
  - INSERT: Add device to Notehub, assign to tenant's fleet
  - UPDATE: Update fleet assignment if tenant_id or fleet_group_id changed
  - DELETE: Remove device from Notehub project

### 3. `device-command` Function
- **Purpose:** Execute device commands in Notehub
- **Triggered by:** Database trigger on `device_commands` table
- **Operations:**
  - firmware_update: Initiate OTA firmware update
  - env_variable: Set environment variables
  - fleet_assign: Assign to specific fleet

## Service Layer Changes

### Remove from Services
- All direct `NotehubService` calls from `TenantService`
- All direct `NotehubService` calls from `DeviceService`
- Frontend never imports `NotehubService` anymore

### Update Services
- `TenantService.createTenant()` → Just insert to Supabase
- `DeviceService.createDevice()` → Just insert to Supabase
- `DeviceService.updateDevice()` → Just update Supabase
- `DeviceService.updateDeviceFirmware()` → Create command record in `device_commands`

### Keep in Services
- `DeviceService.syncDevicesWithNotehub()` - Admin tool for manual sync

## Benefits

1. **Single Source of Truth:** All data queries go to Supabase
2. **Consistency:** No possibility of Supabase/Notehub being out of sync
3. **Security:** API keys never exposed to frontend
4. **Auditability:** All changes tracked in database
5. **Reliability:** Database triggers ensure operations complete
6. **Scalability:** Edge functions handle async operations
7. **Simplified Frontend:** Only needs Supabase client, no Notehub logic

## Migration Strategy

### Phase 1: Preparation (Non-breaking)
1. Add new database tables and columns
2. Deploy new edge functions
3. Add database triggers (initially disabled)
4. Test edge functions manually

### Phase 2: Service Layer Update (Non-breaking)
1. Update services to write to both old and new paths
2. Compare results to ensure correctness
3. Monitor for any discrepancies

### Phase 3: Cut-over (Breaking)
1. Enable database triggers
2. Update services to use new path only
3. Remove old Notehub direct calls from frontend
4. Update SecureDatabase to use new services

### Phase 4: Cleanup
1. Remove unused Notehub functions from frontend
2. Update documentation
3. Archive old code

## Rollback Plan

- Keep old service methods commented out for 1 release
- Disable triggers if issues arise
- Database changes are additive (columns, tables) - no data loss
- Edge functions can be reverted independently

## Testing Checklist

- [ ] Tenant creation creates Notehub fleet
- [ ] Tenant update syncs fleet name
- [ ] Device creation adds to Notehub and fleet
- [ ] Device tenant_id change moves to new fleet
- [ ] Device deletion removes from Notehub
- [ ] Firmware update command executes in Notehub
- [ ] Webhook data still flows correctly
- [ ] Access control still works (SecureDatabase)
- [ ] Admin can see all data
- [ ] Tenant can only see own data

## Questions to Address

1. **How to handle trigger failures?**
   - Log to error table
   - Retry mechanism in edge function
   - Admin dashboard shows failed syncs

2. **What about rate limiting Notehub API?**
   - Edge functions implement exponential backoff
   - Queue system for batched operations

3. **How to handle Notehub being down?**
   - Operations succeed in Supabase
   - Edge function retries periodically
   - Mark sync status in database

4. **Should we store Notehub data locally?**
   - Device status: YES (comes via webhook)
   - Device metadata: YES (as backup)
   - Event history: YES (for offline access)

## Estimated Effort

- Database migrations: 2 hours
- Edge functions development: 6 hours
- Service layer updates: 4 hours
- Frontend updates: 2 hours
- Testing: 4 hours
- **Total: ~18 hours**

## Next Steps

1. Review and approve this plan
2. Create detailed technical specifications for each edge function
3. Begin Phase 1 implementation
4. Set up monitoring and logging
5. Execute migration phases with testing between each
