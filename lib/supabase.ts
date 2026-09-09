import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Only stand up a real client when the env vars look like a real project.
// This keeps the app fully usable offline / with no backend: createClient()
// throws on an empty or invalid URL, which would crash every page at import
// time. When Supabase isn't configured, `supabase` is null and each helper
// below no-ops (or returns []).
function isConfigured(url?: string, key?: string): boolean {
  if (!url || !key) return false;
  if (!/^https?:\/\//.test(url)) return false;
  // Reject obvious placeholders from a sample .env.
  if (/your[-_]?project|placeholder|example\.com|localhost/i.test(url)) return false;
  return true;
}

export const isSupabaseEnabled = isConfigured(supabaseUrl, supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseEnabled
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;

export async function logActivity(
  action: string,
  target?: string,
  tool?: string,
) {
  if (!supabase) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase.from('activity_log').insert({
    user_id: user.id,
    action,
    target,
    tool,
  });
}

export async function saveScanResult(
  tool: 'nmap' | 'nikto',
  target: string,
  output: string,
  profile?: string,
) {
  if (!supabase) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase.from('scan_results').insert({
    user_id: user.id,
    tool,
    target,
    output,
    profile,
    status: 'complete',
  });
}

export async function saveChatMessage(
  role: 'user' | 'assistant',
  content: string,
) {
  if (!supabase) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase.from('chat_sessions').insert({
    user_id: user.id,
    role,
    content,
  });
}

export async function saveReport(
  engagementName: string,
  targetIp: string,
  findings: string,
  reportContent: string,
) {
  if (!supabase) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase.from('reports').insert({
    user_id: user.id,
    engagement_name: engagementName,
    target_ip: targetIp,
    findings,
    report_content: reportContent,
  });
}

export async function getActivityLog(limit = 10) {
  if (!supabase) return [];

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data } = await supabase
    .from('activity_log')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  return data || [];
}
