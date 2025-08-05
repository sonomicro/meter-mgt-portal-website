# SonoMicro - Water Flow Monitoring Platform

A comprehensive IoT water management platform built with React, TypeScript, and Supabase. Monitor water usage, manage device fleets, and track analytics across multiple tenants.

## Features

### Admin Dashboard
- **Tenant Management**: Create, edit, and manage customer accounts
- **Device Overview**: Monitor all IoT devices across the platform
- **System Analytics**: View platform-wide metrics and performance data
- **Settings**: Configure system-wide preferences and policies

### Tenant Dashboard
- **Water Usage Monitoring**: Track consumption patterns and trends
- **Fleet Management**: Manage IoT devices with real-time status updates
- **Alert System**: Receive notifications for device issues and anomalies
- **Settings**: Configure account preferences and notifications

### Device Features
- **Real-time Monitoring**: Live flow rate and battery level tracking
- **GPS Location**: Device positioning with Google Maps integration
- **Firmware Management**: Remote firmware updates and version tracking
- **Alert Thresholds**: Configurable alerts for leaks, low battery, and offline devices

## Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Authentication, Real-time)
- **IoT Integration**: Notehub.io for device connectivity
- **Charts**: Recharts for data visualization
- **Icons**: Lucide React
- **Build Tool**: Vite

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- (Optional) Notehub.io account for IoT device integration

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd sonomicro-platform
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Configure your `.env` file with your Supabase credentials:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Optional - for IoT device integration
VITE_NOTEHUB_PROJECT_UID=your_notehub_project_uid
VITE_NOTEHUB_AUTH_TOKEN=your_notehub_auth_token
```

5. Set up the database:
   - Run the SQL migrations in the `supabase/migrations/` directory
   - Or use the Supabase CLI to apply migrations

6. Start the development server:
```bash
npm run dev
```

## Database Setup

The platform uses Supabase with the following main tables:

- **admins**: System administrators
- **tenants**: Customer accounts
- **devices**: IoT water monitoring devices
- **device_data**: Time-series sensor data
- **device_settings**: Device configuration
- **alerts**: System notifications and alerts

### Initial Setup

1. Create your first admin account through the login interface
2. Use the admin dashboard to create tenant accounts
3. Tenants can then add and manage their devices

## Deployment

### Build for Production

```bash
npm run build
```

### Deploy to Netlify

The project is configured for easy deployment to Netlify:

1. Connect your GitHub repository to Netlify
2. Set the build command to `npm run build`
3. Set the publish directory to `dist`
4. Add your environment variables in Netlify's dashboard

## IoT Device Integration

The platform supports integration with Notehub.io for real-time device connectivity:

1. Configure your Notehub project credentials in `.env`
2. Use the webhook endpoint at `/supabase/functions/notehub-webhook/`
3. Devices send sensor data via Notecard cellular/WiFi modules

### Supported Data Types

- Flow rate (L/min)
- Total volume (L)
- Battery level (%)
- Temperature (°C)
- Pressure (bar)
- GPS coordinates

## API Documentation

The platform uses Supabase's auto-generated REST API. Key endpoints include:

- `/rest/v1/tenants` - Tenant management
- `/rest/v1/devices` - Device operations
- `/rest/v1/device_data` - Sensor data
- `/rest/v1/alerts` - Alert management

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:

- Create an issue in this repository
- Contact: support@sonomicro.com

## Acknowledgments

- Built with [Supabase](https://supabase.com) for backend infrastructure
- IoT connectivity powered by [Blues Wireless Notehub](https://notehub.io)
- UI components styled with [Tailwind CSS](https://tailwindcss.com)