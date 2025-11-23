# Access Control Implementation

This application uses **application-layer access control** instead of Row Level Security (RLS) because it implements custom authentication with bcrypt-hashed passwords stored directly in the database.

## Why RLS is Disabled

- The app uses custom authentication (not Supabase Auth)
- User sessions are stored in localStorage, not as Supabase Auth sessions
- `auth.uid()` is always null since users don't authenticate through Supabase Auth
- RLS policies checking `auth.uid()` would always fail

## Security Model

All access control is enforced in the **SecureDatabase** service layer (`src/services/secureDatabase.ts`).

### Admin Access

Admins have **full access** to everything:
- ✅ View all tenants
- ✅ Create, update, delete tenants
- ✅ View all devices
- ✅ Create, update, delete devices
- ✅ View all device data and alerts
- ✅ Manage all fleet groups
- ✅ Update any device settings

### Tenant Access

Tenants have **restricted access** to only their own data:

#### Can Access:
- ✅ View their own tenant data
- ✅ Update their own tenant profile (name, company, phone, address)
- ✅ View devices assigned to them
- ✅ Update device alias and fleet_group_id
- ✅ Update device alert_config
- ✅ View device data for their devices
- ✅ View alerts for their devices
- ✅ Update alert status (resolve/unresolve)
- ✅ Create, update, delete their own fleet groups
- ✅ View and update device settings for their devices

#### Cannot Access:
- ❌ Delete themselves as a tenant
- ❌ Add or remove devices (only admins can)
- ❌ View or modify other tenants' data
- ❌ Change device ownership (tenant_id)
- ❌ Delete devices

## Usage

Replace direct Supabase queries with the SecureDatabase service:

### Before (Insecure):
```typescript
const { data } = await supabase
  .from('devices')
  .select('*');
```

### After (Secure):
```typescript
import { SecureDatabase } from '../services/secureDatabase';

const devices = await SecureDatabase.getDevices();
```

The service automatically:
1. Checks if user is authenticated
2. Filters data based on user role
3. Prevents unauthorized actions
4. Throws descriptive errors for forbidden operations

## Available Methods

- `getTenants()` - Get tenants (all for admin, own for tenant)
- `updateTenant(id, updates)` - Update tenant
- `deleteTenant(id)` - Delete tenant (admin only)
- `getDevices()` - Get devices (all for admin, own for tenant)
- `updateDevice(id, updates)` - Update device (admins: all fields, tenants: alias, fleet_group_id, alert_config)
- `createDevice(data)` - Create device (admin only)
- `deleteDevice(id)` - Delete device (admin only)
- `getDeviceData(deviceId?)` - Get device data (filtered by tenant)
- `getAlerts()` - Get alerts (filtered by tenant)
- `updateAlert(id, updates)` - Update alert (tenants: only resolved/resolved_at)
- `getFleetGroups()` - Get fleet groups (filtered by tenant)
- `createFleetGroup(data)` - Create fleet group
- `updateFleetGroup(id, updates)` - Update fleet group
- `deleteFleetGroup(id)` - Delete fleet group
- `getDeviceSettings(deviceId)` - Get device settings (filtered by tenant)
- `updateDeviceSettings(deviceId, settings)` - Update device settings

## Error Handling

The service throws descriptive errors:
- `Unauthorized: Please log in` - No user session found
- `Forbidden: Only admins can...` - Admin-only operation attempted by tenant
- `Forbidden: Cannot access...` - Tenant trying to access another tenant's data

Always wrap calls in try-catch:

```typescript
try {
  const devices = await SecureDatabase.getDevices();
} catch (error) {
  console.error('Access denied:', error.message);
}
```
