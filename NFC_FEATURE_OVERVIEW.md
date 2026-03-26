# NFC Tap Feature - Complete Overview

## What Was Added

A complete NFC tap landing page system that allows public access to water flow meter data without requiring login, while maintaining full tenant branding and tracking all interactions.

## Architecture

### 1. Public Landing Page (`/public/device.html`)
- **Purpose**: Standalone HTML page for NFC tap access
- **Features**:
  - Shows real-time flow data from URL parameters
  - Displays tenant branding (logo, colors)
  - Provides login button to access full portal
  - Works without authentication
  - Mobile-optimized responsive design

### 2. Database Schema

#### New Table: `nfc_taps`
Tracks every NFC tap interaction:
- Flow values and units
- Device and tenant associations
- Timestamps (measurement + tap)
- User data (IP, user agent, location)
- Used for analytics and reporting

#### Device Columns Added:
- `nfc_enabled` - Enable/disable NFC per device
- `public_view_enabled` - Control public access
- `last_nfc_tap` - Track last interaction

### 3. Edge Functions

#### `public-device-info`
- Returns device and tenant info for public view
- Bypasses RLS for public access
- Only returns data for NFC-enabled devices
- Includes tenant branding information

#### `record-nfc-tap`
- Records each tap in the database
- Captures flow data and metadata
- Updates device last tap timestamp
- No authentication required

### 4. Tenant Portal Integration

#### New Menu Item: "NFC Tap History"
Located in tenant sidebar between Alerts and Settings.

#### NFCTapHistory Component
Full analytics dashboard showing:
- **Metrics Cards**:
  - Total taps count
  - Unique users (by IP)
  - Average flow rate
- **Filtering**: By device
- **Export**: CSV download of tap data
- **Table View**: Detailed tap history with:
  - Date and time
  - Device name
  - Flow rate values
  - IP addresses
  - User agent info

### 5. Security & Privacy

#### Row Level Security (RLS)
- Public device info: Controlled by database function
- Tap records: Only visible to device owner and admins
- Service role can insert taps (for public access)

#### Data Protection
- Only enabled devices are accessible
- Tenant data isolated by RLS policies
- IP addresses for analytics only
- No sensitive data exposed publicly

## User Journey

### Public User (NFC Tap)
1. User taps phone on water meter NFC tag
2. Phone opens: `device.html?deviceId={ID}&flow={VALUE}...`
3. Page loads with tenant branding
4. Flow data displayed prominently
5. User sees "Access Full Portal" button
6. Optional: User logs in for full features

### Tenant User (Portal)
1. Log in to tenant portal
2. Navigate to "NFC Tap History"
3. View analytics dashboard:
   - How many people tapped devices
   - Which devices are most accessed
   - Average flow rates from taps
4. Filter by specific device
5. Export data for external analysis

### Admin User
- Can view all tenant NFC taps
- Access through admin panel
- Monitor system-wide NFC usage

## Key Features

### ✅ No Login Required for Public View
Users get instant access to flow data without account creation or login.

### ✅ Tenant Branding
Each landing page shows:
- Tenant logo
- Custom colors (primary/secondary)
- Company name
- Professional appearance

### ✅ Real-Time Data
Flow values come from NFC URL parameters, showing the most recent measurement.

### ✅ Analytics Tracking
Every interaction is logged:
- Who accessed (IP address)
- When they accessed
- Which device
- What data they saw

### ✅ Easy Portal Access
One-click button to login page for full features.

### ✅ Mobile-First Design
Optimized for phone screens since NFC taps happen on mobile devices.

## Files Modified

### New Files
- `/public/device.html` - Public landing page
- `/supabase/functions/public-device-info/index.ts` - Device info API
- `/supabase/functions/record-nfc-tap/index.ts` - Tap recording API
- `/src/components/Tenant/NFCTapHistory.tsx` - Analytics dashboard
- `/supabase/migrations/20260326090309_add_nfc_tap_tracking.sql` - Database schema
- `NFC_SETUP_GUIDE.md` - Setup documentation
- `NFC_URL_QUICK_REFERENCE.md` - URL format guide

### Modified Files
- `/src/App.tsx` - Added NFCTapHistory route
- `/src/components/Layout/Sidebar.tsx` - Added menu item

### Not Modified
- Existing portal functionality unchanged
- No changes to admin dashboard
- Device management unchanged
- User authentication unchanged

## URL Format

```
https://yourdomain.com/device.html?deviceId={UUID}&flow={NUMBER}&unit={STRING}&timestamp={ISO8601}
```

### Example
```
https://yourdomain.com/device.html?deviceId=a1b2c3d4-e5f6-7890-abcd-ef1234567890&flow=15.3&unit=L/min&timestamp=2026-03-26T10:30:00Z
```

## Configuration

### Enable NFC for Device
```sql
UPDATE devices
SET nfc_enabled = true, public_view_enabled = true
WHERE id = 'device-uuid';
```

### Add Tenant Branding
1. Go to Tenant Settings
2. Upload logo
3. Set primary and secondary colors
4. Save changes

### Program NFC Tag
1. Use NFC Tools app
2. Write URL with device ID
3. Include flow parameter if available
4. Test with phone

## Benefits

### For End Users
- Instant access to device data
- No app installation required
- No account creation needed
- Quick QR code alternative

### For Tenants
- Increased engagement tracking
- Usage analytics
- Professional branded experience
- Lead generation (login button)

### For Admins
- System-wide analytics
- Device usage monitoring
- Tenant engagement metrics

## Next Steps

1. **Deploy Edge Functions** (Already done)
2. **Update device.html** with your domain
3. **Enable NFC** on desired devices
4. **Program NFC tags** with device URLs
5. **Test** with mobile phone
6. **Monitor** NFC Tap History in portal

## Testing Checklist

- [ ] Device.html loads in browser
- [ ] Device info displays correctly
- [ ] Tenant branding shows (logo, colors)
- [ ] Flow data renders properly
- [ ] Login button redirects to /login
- [ ] Tap appears in NFC Tap History
- [ ] Analytics metrics update
- [ ] CSV export works
- [ ] Mobile responsive design works
- [ ] NFC tag opens page on phone

## Support & Troubleshooting

### Device Not Found
Check: `nfc_enabled` and `public_view_enabled` in database

### Branding Not Showing
Upload logo in Tenant Settings and set colors

### Taps Not Recording
Verify Edge Functions are deployed and working

### Page Won't Load
Check device.html Supabase URL is correct

## Future Enhancements

Potential additions (not implemented):
- QR code generation alongside NFC
- Real-time flow updates via WebSocket
- Offline mode support
- Multi-language support
- Custom branded domains per tenant
- GPS location tracking
- Tap notifications to tenant
- Public device map view

## Summary

This NFC feature seamlessly integrates with your existing portal, providing a public gateway to device data while maintaining security, branding, and analytics. The implementation doesn't interfere with existing functionality and can be enabled/disabled per device.
