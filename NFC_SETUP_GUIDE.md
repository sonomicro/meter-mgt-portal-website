# NFC Tap Landing Page - Setup Guide

## Overview

The NFC tap feature allows users to tap their phone on a water flow meter and instantly see real-time flow data on a branded landing page, without needing to log in.

## How It Works

1. User taps their NFC-enabled phone on the water meter
2. Phone opens a URL with device ID and flow data
3. Public landing page displays:
   - Tenant branding (logo, colors)
   - Device information
   - Current flow rate
   - Button to access full portal
4. Tap is automatically recorded in database for analytics

## URL Format

The NFC tag should be programmed with a URL in this format:

```
https://yourdomain.com/device.html?deviceId={DEVICE_ID}&flow={FLOW_VALUE}&unit={UNIT}&timestamp={TIMESTAMP}
```

### URL Parameters

- `deviceId` (required): The unique device ID from your database
- `flow` (optional): Current flow rate value (e.g., 15.3)
- `unit` (optional): Unit of measurement (default: L/min)
- `timestamp` (optional): ISO 8601 timestamp of measurement

### Example URLs

**Simple version (no flow data):**
```
https://yourdomain.com/device.html?deviceId=123e4567-e89b-12d3-a456-426614174000
```

**With flow data:**
```
https://yourdomain.com/device.html?deviceId=123e4567-e89b-12d3-a456-426614174000&flow=15.3&unit=L/min&timestamp=2026-03-26T10:30:00Z
```

## Programming NFC Tags

### Using NFC Tools (Mobile App)

1. Download "NFC Tools" app (iOS/Android)
2. Place NFC tag near phone
3. Select "Write"
4. Choose "Add a record"
5. Select "URL / URI"
6. Enter the device URL with parameters
7. Write to tag

### Using Hardware (Notecard)

If your Notecard device supports NFC and can generate dynamic URLs:

1. Configure the Notecard to generate URLs with current flow data
2. Format: `https://yourdomain.com/device.html?deviceId={device.id}&flow={_body.flow}&unit=L/min&timestamp={when}`
3. Enable NFC transmission in Notecard firmware

## Device Configuration

### Enable NFC for Devices

In the database, each device has NFC settings:

```sql
UPDATE devices
SET
  nfc_enabled = true,           -- Enable NFC functionality
  public_view_enabled = true    -- Allow public viewing
WHERE id = 'your-device-id';
```

### Disable NFC for Specific Devices

```sql
UPDATE devices
SET nfc_enabled = false
WHERE id = 'device-to-disable';
```

## Tenant Branding

The landing page automatically displays tenant branding:

- **Logo**: Upload logo in Tenant Settings
- **Colors**: Set primary and secondary colors in Tenant Customization
- **Company Name**: Automatically pulled from tenant profile

## Analytics

View NFC tap analytics in the tenant portal:

1. Log in to tenant account
2. Navigate to "NFC Tap History" in sidebar
3. View metrics:
   - Total taps
   - Unique users (by IP)
   - Average flow rate
   - Detailed tap history
4. Export data to CSV for further analysis

## Security & Privacy

- Only devices with `nfc_enabled = true` and `public_view_enabled = true` can be accessed
- No authentication required for public view
- IP addresses and user agents are logged for analytics
- Full device management requires login
- All tap data is stored securely in database

## Testing

1. Get a device ID from your database
2. Visit: `https://yourdomain.com/device.html?deviceId={YOUR_DEVICE_ID}&flow=15.5&unit=L/min`
3. Verify:
   - Page loads with tenant branding
   - Flow data displays correctly
   - Login button works
   - Tap appears in NFC Tap History

## Troubleshooting

### "Device Not Available" Error

- Verify device exists in database
- Check `nfc_enabled = true`
- Check `public_view_enabled = true`
- Verify device is associated with a tenant

### Branding Not Showing

- Upload logo in Tenant Settings
- Set colors in Tenant Customization table
- Clear browser cache and reload

### Taps Not Recording

- Check Edge Functions are deployed
- Verify Supabase URL is correct in HTML file
- Check browser console for errors
- Verify RLS policies allow service role to insert

## Deployment Checklist

- [ ] Deploy `public-device-info` Edge Function
- [ ] Deploy `record-nfc-tap` Edge Function
- [ ] Run database migration for NFC tables
- [ ] Update `device.html` with your Supabase URL
- [ ] Upload `device.html` to your web server
- [ ] Configure tenant branding
- [ ] Enable NFC on devices
- [ ] Program NFC tags with device URLs
- [ ] Test with sample device
- [ ] Verify analytics tracking

## Best Practices

1. **URL Length**: Keep URLs short for faster NFC reading
2. **Testing**: Test each NFC tag after programming
3. **Placement**: Place NFC tags on flat, metal-free surfaces
4. **Updates**: Use QR codes as backup if NFC fails
5. **Monitoring**: Regularly check NFC Tap History for issues
6. **Privacy**: Inform users about data collection

## Support

For issues or questions:
- Check Supabase Edge Function logs
- Review browser console errors
- Verify database RLS policies
- Test with direct URL access first
