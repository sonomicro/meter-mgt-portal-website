# NFC URL Quick Reference

## Public Device Landing Page URL Format

```
https://yourdomain.com/device.html?deviceId={DEVICE_ID}&flow={VALUE}&unit={UNIT}&timestamp={TIME}
```

## Parameters

| Parameter | Required | Example | Description |
|-----------|----------|---------|-------------|
| `deviceId` | ✅ Yes | `123e4567-e89b-12d3-a456-426614174000` | UUID of the device from database |
| `flow` | ❌ No | `15.3` | Current flow rate value |
| `unit` | ❌ No | `L/min` | Unit of measurement (default: L/min) |
| `timestamp` | ❌ No | `2026-03-26T10:30:00Z` | ISO 8601 timestamp |

## Example URLs

### Minimal (No Flow Data)
```
https://yourdomain.com/device.html?deviceId=a1b2c3d4-e5f6-7890-abcd-ef1234567890
```
User sees device info and branding, but no flow reading.

### With Flow Data
```
https://yourdomain.com/device.html?deviceId=a1b2c3d4-e5f6-7890-abcd-ef1234567890&flow=15.3&unit=L/min
```
User sees device info, branding, and current flow rate of 15.3 L/min.

### Full URL with Timestamp
```
https://yourdomain.com/device.html?deviceId=a1b2c3d4-e5f6-7890-abcd-ef1234567890&flow=15.3&unit=L/min&timestamp=2026-03-26T10:30:00Z
```
User sees complete data including when measurement was taken.

## Alternative Units

- `L/min` - Liters per minute (default)
- `L/h` - Liters per hour
- `gal/min` - Gallons per minute
- `gal/h` - Gallons per hour
- `m3/h` - Cubic meters per hour

## Getting Device IDs

### From Supabase Dashboard
1. Go to Supabase Dashboard
2. Navigate to Table Editor
3. Open `devices` table
4. Copy device `id` column value

### From SQL Query
```sql
SELECT id, name, serial_number
FROM devices
WHERE tenant_id = 'your-tenant-id'
AND nfc_enabled = true;
```

## NFC Tag Programming

### Using NFC Tools App
1. Open NFC Tools app
2. Tap "Write"
3. Add record → URL/URI
4. Paste full URL
5. Write to tag

### URL Length Limits
- Most NFC tags support 256-512 bytes
- Keep URLs under 200 characters for best compatibility
- Use shortened domain if URL is too long

## Testing

### Browser Testing
1. Copy URL with test device ID
2. Open in browser
3. Verify page loads correctly
4. Check NFC Tap History in portal

### NFC Testing
1. Program test tag with URL
2. Tap with phone
3. Verify page opens automatically
4. Confirm tap appears in analytics

## Common Issues

### Device Not Found
- ✅ Check device ID is correct (UUID format)
- ✅ Verify `nfc_enabled = true` in database
- ✅ Verify `public_view_enabled = true` in database

### Flow Data Not Showing
- ✅ Ensure `flow` parameter is numeric
- ✅ Check URL encoding is correct
- ✅ Verify timestamp format is ISO 8601

### Page Not Loading
- ✅ Check device.html is deployed
- ✅ Verify Supabase URL is correct in HTML
- ✅ Test Edge Functions are working

## URL Encoding

If flow values or timestamps contain special characters, encode them:

| Character | Encoded |
|-----------|---------|
| Space | `%20` |
| Plus `+` | `%2B` |
| Colon `:` | `%3A` |

## Dynamic URL Generation (Notecard)

If generating URLs dynamically from device:

```json
{
  "body": {
    "url": "https://yourdomain.com/device.html",
    "params": {
      "deviceId": "{{device.uid}}",
      "flow": "{{sensor.flow}}",
      "unit": "L/min",
      "timestamp": "{{time.iso}}"
    }
  }
}
```

## Portal Integration

After viewing device via NFC:
1. User clicks "Access Full Portal"
2. Redirects to `/login`
3. User logs in to tenant account
4. Full device management available
5. Tap history visible in "NFC Tap History"

## Analytics Tracked

Each NFC tap records:
- Device ID
- Flow value and unit
- Timestamp of measurement
- Timestamp of tap
- User IP address
- User agent (device/browser info)
- Optional GPS location

View in: **Tenant Portal → NFC Tap History**
