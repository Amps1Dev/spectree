import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function logActivity(
  action: string,
  target?: string,
  tool?: string,
) {
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
