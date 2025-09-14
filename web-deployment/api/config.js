// API endpoint to get environment variables
export default function handler(req, res) {
  res.status(200).json({
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  });
}
