import { supabase } from '../lib/supabase';
import bcrypt from 'bcryptjs';
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

console.log('🔧 Supabase URL:', supabaseUrl);
console.log('🔧 Supabase Anon Key length:', supabaseAnonKey?.length);
console.log('🔧 URL includes supabase.co:', supabaseUrl?.includes('supabase.co'));
console.log('🔧 URL is not placeholder:', supabaseUrl !== 'https://placeholder.supabase.co');
console.log('🔧 Key is not placeholder:', supabaseAnonKey !== 'placeholder-key');
console.log('🔧 Key length > 50:', (supabaseAnonKey?.length || 0) > 50);

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

export async function signIn(email: string, password: string, role?: 'admin' | 'tenant') {
  console.log('🔍 Starting authentication process...');
  console.log('📧 Email:', email);
  console.log('👤 Expected role:', role);
  console.log('⚙️ Supabase configured:', isSupabaseConfigured);

  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not properly configured. Please check your environment variables.');
  }

  try {
    let userData = null;
    let userRole = null;

    if (role === 'admin') {
      console.log('🔍 Checking admins table...');
      const { data: adminData, error: adminError } = await supabase
        .from('admins')
        .select('*')
        .eq('email', email)
        .single();

      if (adminError) {
        console.log('❌ Admin not found:', adminError.message);
        throw new Error('Invalid email or password. Please check your credentials.');
      }

      if (adminData) {
        console.log('📊 Admin data from database:', adminData);
        console.log('✅ Admin found, verifying password...');
        console.log('🔐 Stored password hash:', adminData.password_hash);
        console.log('🔑 Plain text password:', password);
        const passwordMatch = await bcrypt.compare(password, adminData.password_hash);
        console.log('🔍 Password match result:', passwordMatch);
        
        if (!passwordMatch) {
          console.log('❌ Password does not match');
          throw new Error('Invalid email or password. Please check your credentials.');
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
      }
    } else if (role === 'tenant') {
      console.log('🔍 Checking tenants table...');
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select('*')
        .eq('email', email)
        .single();

      if (tenantError) {
        console.log('❌ Tenant not found:', tenantError.message);
        throw new Error('Invalid email or password. Please check your credentials.');
      }

      if (tenantData) {
        console.log('📊 Tenant data from database:', tenantData);
        console.log('✅ Tenant found, verifying password...');
        console.log('🔐 Stored password hash:', tenantData.password_hash);
        console.log('🔑 Plain text password:', password);
        
        // Generate hash from plaintext to see what it would look like
        const generatedHash = await bcrypt.hash(password, 10);
        console.log('🔨 Generated hash from plaintext:', generatedHash);
        
        const passwordMatch = await bcrypt.compare(password, tenantData.password_hash);
        console.log('🔍 Password match result:', passwordMatch);
        
        if (!passwordMatch) {
          console.log('❌ Password does not match');
          throw new Error('Invalid email or password. Please check your credentials.');
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
      }
    }

    if (!userData) {
      console.log('❌ No user found with provided credentials');
      throw new Error('Invalid email or password. Please check your credentials.');
    }

    console.log('✅ User authenticated successfully:', userData);

    // Update last login timestamp
    const tableName = role === 'admin' ? 'admins' : 'tenants';
    await supabase
      .from(tableName)
      .update({ last_login: new Date().toISOString() })
      .eq('id', userData.id);

    // Store user session
    localStorage.setItem('currentUser', JSON.stringify(userData));

    return {
      user: userData,
      role: userRole
    };

  } catch (error) {
    console.error('❌ Authentication error:', error);
    throw error;
  }
}

export async function signOut() {
  localStorage.removeItem('currentUser');
  return { error: null };
}

export async function getCurrentUser(): Promise<User | null> {
  const userStr = localStorage.getItem('currentUser');
  
  if (!userStr) {
    return null;
  }

  try {
    const user = JSON.parse(userStr);
    return user;
  } catch {
    return null;
  }
}

export async function createAdmin(email: string, password: string, name: string) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not properly configured. Please check your environment variables.');
  }

  const hashedPassword = await hashPassword(password);
  console.log('🔐 Creating admin with hashed password:', hashedPassword);
  
  const { data, error } = await supabase
    .from('admins')
    .insert([{
      email: email,
      password_hash: hashedPassword,
      name: name
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating admin:', error);
    throw new Error('Failed to create admin account: ' + error.message);
  }
  
  return data;
}

export async function createTenant(tenantData: any) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not properly configured. Please check your environment variables.');
  }

  const hashedPassword = await hashPassword(tenantData.password);
  console.log('🔐 Creating tenant with hashed password:', hashedPassword);
  
  const { data, error } = await supabase
    .from('tenants')
    .insert([{
      email: tenantData.email,
      password_hash: hashedPassword,
      name: tenantData.name,
      company: tenantData.company,
      phone: tenantData.phone,
      address: tenantData.address,
      plan: tenantData.plan || 'basic'
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating tenant:', error);
    throw new Error('Failed to create tenant account: ' + error.message);
  }
  
  return data;
}

export async function updatePassword(newPassword: string) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('No authenticated user');
  }

  const hashedPassword = await hashPassword(newPassword);
  
  // Update in the appropriate table based on user role
  const tableName = user.role === 'admin' ? 'admins' : 'tenants';
  
  const { error } = await supabase
    .from(tableName)
    .update({ password_hash: hashedPassword })
    .eq('email', user.email);

  if (error) throw error;
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