import { createClient } from '@supabase/supabase-js'

// Supabase設定
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://vyvarctfzslbthdbsmvd.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5dmFyY3RmenNsYnRoZGJzbXZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NDU1NjcsImV4cCI6MjA4MDQyMTU2N30.FZDTrLLeFrou-ZYSOhegGkHIe0mqDYS_ne9pginpYE8'

// Supabaseが設定されているかチェック
export const isSupabaseConfigured = () => {
  return !!(supabaseUrl && supabaseAnonKey)
}

// Supabaseクライアント（設定されている場合のみ作成）
export const supabase = isSupabaseConfigured() 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

export default supabase

