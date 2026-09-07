import { NotehubService } from './notehub';
import { DeviceService, TenantService } from './database';

export interface FleetAssignmentResult {
  success: boolean;
  deviceId: string;
  error?: string;
}

export class DeviceFleetAssignmentService {
  static async assignDevicesToTenant(
    deviceIds: string[],
    tenantId: string,
    tenantCompany: string
  ): Promise<FleetAssignmentResult[]> {
    console.log('🔄 Assigning devices to tenant:', { deviceIds, tenantId, tenantCompany });

    const results: FleetAssignmentResult[] = [];
    let targetFleetUid: string | null = null;

    if (NotehubService.isConfigured()) {
      try {
        const tenant = await TenantService.getTenant(tenantId);
        targetFleetUid = tenant?.notehub_fleet_uid ?? null;

        if (targetFleetUid) {
          console.log(`✅ Using tenant's stored fleet for "${tenantCompany}": ${targetFleetUid}`);
        } else {
          const fleets = await NotehubService.getFleets();
          const targetFleet = fleets.find(f => f.label === tenantCompany);

          if (targetFleet) {
            targetFleetUid = targetFleet.uid;
            console.log(`✅ Found existing fleet for "${tenantCompany}": ${targetFleetUid}`);
          } else {
            const newFleet = await NotehubService.createFleet(tenantCompany);
            targetFleetUid = newFleet.uid;
            console.log(`✅ Created new fleet for "${tenantCompany}": ${targetFleetUid}`);
          }

          await TenantService.updateTenant(tenantId, { notehub_fleet_uid: targetFleetUid });
          console.log(`✅ Stored resolved fleet uid on tenant ${tenantId}`);
        }
      } catch (err) {
        console.error('Failed to prepare fleet:', err);
      }
    }

    const allDevices = await DeviceService.getDevices();

    for (const id of deviceIds) {
      try {
        const device = allDevices.find(d => d.id === id);
        console.log(`📱 Processing device ${id}:`, device);

        await DeviceService.updateDevice(id, { tenant_id: tenantId });
        console.log(`✅ Supabase updated for device ${id}`);

        if (device?.notehub_device_uid && targetFleetUid) {
          try {
            console.log(`Moving device ${device.notehub_device_uid} to fleet "${tenantCompany}"`);

            const currentDevice = await NotehubService.getDevice(device.notehub_device_uid);
            console.log('🔍 Current device fleets:', currentDevice.fleet_uids);

            if (currentDevice.fleet_uids && currentDevice.fleet_uids.length > 0) {
              console.log(`🗑️ Removing device from ${currentDevice.fleet_uids.length} fleet(s)`);
              await NotehubService.removeDeviceFromFleets(device.notehub_device_uid, currentDevice.fleet_uids);
              console.log('✅ Removed from all current fleets');
            }

            console.log(`➕ Adding device to fleet "${tenantCompany}": ${targetFleetUid}`);
            await NotehubService.addDeviceToFleets(device.notehub_device_uid, [targetFleetUid]);
            console.log(`✅ Successfully added device to fleet "${tenantCompany}"`);

            results.push({ success: true, deviceId: id });
          } catch (notehubError) {
            console.error(`❌ Failed to update device in Notehub:`, notehubError);
            results.push({
              success: false,
              deviceId: id,
              error: notehubError instanceof Error ? notehubError.message : 'Unknown error'
            });
          }
        } else {
          results.push({ success: true, deviceId: id });
        }
      } catch (error) {
        console.error(`❌ Failed to assign device ${id}:`, error);
        results.push({
          success: false,
          deviceId: id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  static async unassignDeviceFromTenant(deviceId: string): Promise<void> {
    console.log('🔍 Unassigning device:', deviceId);

    const allDevices = await DeviceService.getDevices();
    const device = allDevices.find(d => d.id === deviceId);

    await DeviceService.updateDevice(deviceId, { tenant_id: null });
    console.log('✅ Updated device in Supabase (tenant_id set to null)');

    if (device?.notehub_device_uid && NotehubService.isConfigured()) {
      try {
        console.log(`🔄 Moving device ${device.notehub_device_uid} to Unassigned fleet in Notehub...`);

        const fleets = await NotehubService.getFleets();
        console.log('📋 Available fleets:', fleets.map(f => f.label));
        let unassignedFleet = fleets.find(f => f.label === 'Unassigned');

        if (!unassignedFleet) {
          console.log('⚙️ Creating Unassigned fleet in Notehub...');
          unassignedFleet = await NotehubService.createFleet('Unassigned');
          console.log('✅ Created Unassigned fleet:', unassignedFleet.uid);
        } else {
          console.log('✅ Found existing Unassigned fleet:', unassignedFleet.uid);
        }

        const currentDevice = await NotehubService.getDevice(device.notehub_device_uid);
        console.log('🔍 Current device fleets:', currentDevice.fleet_uids);

        if (currentDevice.fleet_uids && currentDevice.fleet_uids.length > 0) {
          console.log(`🗑️ Removing device from fleets: ${currentDevice.fleet_uids.join(', ')}`);
          await NotehubService.removeDeviceFromFleets(device.notehub_device_uid, currentDevice.fleet_uids);
          console.log('✅ Removed from all current fleets');
        }

        console.log(`➕ Adding device to Unassigned fleet: ${unassignedFleet.uid}`);
        await NotehubService.addDeviceToFleets(device.notehub_device_uid, [unassignedFleet.uid]);
        console.log(`✅ Successfully moved device ${device.notehub_device_uid} to Unassigned fleet`);
      } catch (notehubError) {
        console.error(`❌ Failed to move device to Unassigned in Notehub:`, notehubError);
        throw notehubError;
      }
    }
  }
}
