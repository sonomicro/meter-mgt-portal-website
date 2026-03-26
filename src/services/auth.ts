import { supabase, supabaseServiceRole } from '../lib/supabase';
import type { User } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !!(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'https://placeholder.supabase.co' &&
  supabaseAnonKey !== 'placeholder-key' &&
  supabaseUrl.includes('supabase.co') &&
  supabaseAnonKey.length > 50
);

export async function signIn(email: string, password: string, role?: 'admin' | 'tenant') {
  console.log('🔍 Starting authentication...');
  console.log('📧 Email:', email);
  console.log('👤 Expected role:', role);

  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not properly configured. Please check your environment variables.');
  }

  // Clear any existing session to ensure fresh login
  await supabase.auth.signOut();
  localStorage.removeItem('currentUser');

  try {
    console.log('🔐 Attempting Supabase Auth login...');
    console.log('📧 Email:', email);
    console.log('🔑 Password length:', password.length);

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    console.log('📥 Auth response:', {
      hasError: !!authError,
      hasUser: !!authData?.user,
      errorDetails: authError
    });

    if (!authError && authData.user) {
      console.log('✅ User authenticated via Supabase Auth');

      let userData: User | null = null;
      let userRole: 'admin' | 'tenant' | null = null;

      if (role === 'admin') {
        const { data: adminData, error: adminError } = await supabase
          .from('admins')
          .select('*')
          .eq('user_id', authData.user.id)
          .maybeSingle();

        if (adminError || !adminData) {
          throw new Error('Admin account not found or access denied.');
        }

        userData = {
          id: adminData.id,
          email: adminData.email,
          name: adminData.name,
          role: 'admin' as const,
          createdAt: adminData.created_at,
          lastLogin: adminData.last_login
        };
        userRole = 'admin';

        await supabase
          .from('admins')
          .update({ last_login: new Date().toISOString() })
          .eq('id', adminData.id);
      } else if (role === 'tenant') {
        const { data: tenantData, error: tenantError } = await supabase
          .from('tenants')
          .select('*')
          .eq('user_id', authData.user.id)
          .maybeSingle();

        if (tenantError || !tenantData) {
          throw new Error('Tenant account not found or access denied.');
        }

        userData = {
          id: tenantData.id,
          email: tenantData.email,
          name: tenantData.name,
          role: 'tenant' as const,
          company: tenantData.company,
          createdAt: tenantData.created_at,
          lastLogin: tenantData.last_login
        };
        userRole = 'tenant';

        await supabase
          .from('tenants')
          .update({ last_login: new Date().toISOString() })
          .eq('id', tenantData.id);
      }

      if (userData) {
        console.log('✅ User authenticated successfully:', userData);
        localStorage.setItem('currentUser', JSON.stringify(userData));

        return {
          user: userData,
          role: userRole
        };
      }
    }

    console.log('⚠️ Supabase Auth failed, checking for legacy user...');

    const { data: authCheckData, error: authCheckError } = await supabase.rpc('authenticate_legacy_user', {
      p_email: email,
      p_password: password,
      p_role: role
    });

    if (authCheckError || !authCheckData) {
      console.log('❌ Legacy auth check failed:', authCheckError);
      throw new Error('Invalid email or password. Please check your credentials.');
    }

    if (authCheckData.error) {
      console.log('❌ Legacy auth failed:', authCheckData.error);
      throw new Error('Invalid email or password. Please check your credentials.');
    }

    if (authCheckData.success && authCheckData.needs_migration) {
      console.log('✅ Legacy user verified, migrating to Supabase Auth...');

      const apiUrl = `${supabaseUrl}/functions/v1/legacy-auth-migrate`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({
          email,
          password,
          role,
          user_id: authCheckData.user_id
        })
      });

      const result = await response.json();

      if (!response.ok) {
        console.log('❌ Migration failed:', result.error);
        throw new Error('Migration failed. Please try again or contact support.');
      }

      if (result.migrated) {
      console.log('✅ User migrated! Attempting login again...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      const { data: retryAuthData, error: retryAuthError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (retryAuthError || !retryAuthData.user) {
        throw new Error('Migration succeeded but login failed. Please try logging in again.');
      }

      let userData: User | null = null;
      let userRole: 'admin' | 'tenant' | null = null;

      if (role === 'admin') {
        const { data: adminData } = await supabase
          .from('admins')
          .select('*')
          .eq('user_id', retryAuthData.user.id)
          .maybeSingle();

        if (adminData) {
          userData = {
            id: adminData.id,
            email: adminData.email,
            name: adminData.name,
            role: 'admin' as const,
            createdAt: adminData.created_at,
            lastLogin: adminData.last_login
          };
          userRole = 'admin';
        }
      } else if (role === 'tenant') {
        const { data: tenantData } = await supabase
          .from('tenants')
          .select('*')
          .eq('user_id', retryAuthData.user.id)
          .maybeSingle();

        if (tenantData) {
          userData = {
            id: tenantData.id,
            email: tenantData.email,
            name: tenantData.name,
            role: 'tenant' as const,
            company: tenantData.company,
            createdAt: tenantData.created_at,
            lastLogin: tenantData.last_login
          };
          userRole = 'tenant';
        }
      }

      if (userData) {
        console.log('✅ User authenticated successfully after migration:', userData);
        localStorage.setItem('currentUser', JSON.stringify(userData));

        return {
          user: userData,
          role: userRole
        };
      }
      }
    }

    throw new Error('Invalid email or password. Please check your credentials.');

  } catch (error) {
    console.error('❌ Authentication error:', error);
    throw error;
  }
}

export async function signOut() {
  await supabase.auth.signOut();
  localStorage.removeItem('currentUser');
  return { error: null };
}

export async function getCurrentUser(): Promise<User | null> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    localStorage.removeItem('currentUser');
    return null;
  }

  const userStr = localStorage.getItem('currentUser');
  if (userStr) {
    try {
      return JSON.parse(userStr);
    } catch {
      localStorage.removeItem('currentUser');
    }
  }

  try {
    const { data: adminData } = await supabase
      .from('admins')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (adminData) {
      const userData: User = {
        id: adminData.id,
        email: adminData.email,
        name: adminData.name,
        role: 'admin' as const,
        createdAt: adminData.created_at,
        lastLogin: adminData.last_login
      };
      localStorage.setItem('currentUser', JSON.stringify(userData));
      return userData;
    }

    const { data: tenantData } = await supabase
      .from('tenants')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (tenantData) {
      const userData: User = {
        id: tenantData.id,
        email: tenantData.email,
        name: tenantData.name,
        role: 'tenant' as const,
        company: tenantData.company,
        createdAt: tenantData.created_at,
        lastLogin: tenantData.last_login
      };
      localStorage.setItem('currentUser', JSON.stringify(userData));
      return userData;
    }
  } catch (error) {
    console.error('Error fetching user data:', error);
  }

  return null;
}

export async function createAdmin(email: string, password: string, name: string) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not properly configured. Please check your environment variables.');
  }

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        role: 'admin'
      }
    }
  });

  if (authError) {
    console.error('Error creating auth user:', authError);
    throw new Error('Failed to create admin account: ' + authError.message);
  }

  if (!authData.user) {
    throw new Error('Failed to create admin account.');
  }

  const { data: adminData, error: adminError } = await supabase
    .from('admins')
    .insert([{
      user_id: authData.user.id,
      email: email,
      password_hash: '',
      name: name
    }])
    .select()
    .maybeSingle();

  if (adminError) {
    console.error('Error creating admin record:', adminError);
    throw new Error('Failed to create admin account: ' + adminError.message);
  }

  return adminData;
}

export async function createTenant(tenantData: any) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not properly configured. Please check your environment variables.');
  }

  // Check if tenant already exists
  const { data: existingTenant } = await supabase
    .from('tenants')
    .select('email')
    .eq('email', tenantData.email)
    .maybeSingle();

  if (existingTenant) {
    throw new Error('A tenant with this email already exists.');
  }

  // Try to create auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: tenantData.email,
    password: tenantData.password,
    options: {
      data: {
        name: tenantData.name,
        role: 'tenant'
      }
    }
  });

  // If user already exists in auth, try to find their user_id and create tenant record
  if (authError && authError.message.includes('User already registered')) {
    console.log('Auth user already exists, attempting to create tenant record...');

    if (!supabaseServiceRole) {
      throw new Error('Service role key not configured. Cannot recover from this error.');
    }

    // Use service role to query auth.users table to get user_id by email
    const { data: authUsers, error: authUsersError } = await supabaseServiceRole.auth.admin.listUsers();

    if (authUsersError) {
      throw new Error('Unable to verify user. Please use a different email or contact support.');
    }

    const existingAuthUser = authUsers.users.find(u => u.email === tenantData.email);

    if (!existingAuthUser) {
      throw new Error('User registration is in an inconsistent state. Please contact support.');
    }

    // Check if tenant record already exists for this user_id
    const { data: existingByUserId } = await supabaseServiceRole
      .from('tenants')
      .select('*')
      .eq('user_id', existingAuthUser.id)
      .maybeSingle();

    if (existingByUserId) {
      throw new Error('A tenant account already exists for this user.');
    }

    // Create tenant record with existing user_id using service role to bypass RLS
    const { data: tenantRecord, error: tenantError } = await supabaseServiceRole
      .from('tenants')
      .insert([{
        user_id: existingAuthUser.id,
        email: tenantData.email,
        password_hash: '',
        name: tenantData.name,
        company: tenantData.company,
        phone: tenantData.phone,
        address: tenantData.address,
        plan: tenantData.plan || 'basic'
      }])
      .select()
      .single();

    if (tenantError) {
      console.error('Error creating tenant record:', tenantError);
      throw new Error('Failed to create tenant record: ' + tenantError.message);
    }

    return tenantRecord;
  }

  if (authError) {
    console.error('Error creating auth user:', authError);
    throw new Error('Failed to create tenant account: ' + authError.message);
  }

  if (!authData.user) {
    throw new Error('Failed to create tenant account.');
  }

  // Create tenant record
  const { data: tenantRecord, error: tenantError } = await supabase
    .from('tenants')
    .insert([{
      user_id: authData.user.id,
      email: tenantData.email,
      password_hash: '',
      name: tenantData.name,
      company: tenantData.company,
      phone: tenantData.phone,
      address: tenantData.address,
      plan: tenantData.plan || 'basic'
    }])
    .select()
    .single();

  if (tenantError) {
    console.error('Error creating tenant record:', tenantError);
    throw new Error('Failed to create tenant record: ' + tenantError.message);
  }

  return tenantRecord;
}

export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({
    password: newPassword
  });

  if (error) {
    throw new Error('Failed to update password: ' + error.message);
  }
}

export class AuthService {
  static async signIn(email: string, password: string, role?: 'admin' | 'tenant') {
    return signIn(email, password, role);
  }

  static async signOut() {
    return signOut();
  }

  static async getCurrentUser() {
    return getCurrentUser();
  }

  static async createAdmin(email: string, password: string, name: string) {
    return createAdmin(email, password, name);
  }

  static async createTenant(tenantData: any) {
    return createTenant(tenantData);
  }

  static async updatePassword(newPassword: string) {
    return updatePassword(newPassword);
  }

  static isSupabaseConfigured() {
    return isSupabaseConfigured;
  }
}
