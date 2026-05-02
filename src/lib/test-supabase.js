import { supabase } from './supabase'

export async function testSupabaseConnection() {
  try {
    // Test 1: Check connection
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('count', { count: 'exact', head: true })

    if (usersError) {
      console.error('Users table error:', usersError)
      return { success: false, error: usersError.message }
    }

    // Test 2: Check brands table
    const { data: brands, error: brandsError } = await supabase
      .from('brands')
      .select('count', { count: 'exact', head: true })

    if (brandsError) {
      console.error('Brands table error:', brandsError)
      return { success: false, error: brandsError.message }
    }

    console.log('✅ Supabase connection successful!')
    console.log('Users table accessible:', !!users)
    console.log('Brands table accessible:', !!brands)

    return { success: true, message: 'All tables accessible' }
  } catch (error) {
    console.error('Connection error:', error)
    return { success: false, error: error.message }
  }
}