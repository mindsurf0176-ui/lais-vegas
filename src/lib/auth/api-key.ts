// ========================================
// AI Casino - API Key Authentication
// ========================================

import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import crypto from 'crypto';
import { Agent } from '@/types';

export interface AuthResult {
  success: boolean;
  agent?: Agent;
  error?: string;
}

export async function authenticateAgent(request: NextRequest): Promise<AuthResult> {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { success: false, error: 'Missing or invalid Authorization header' };
  }
  
  const apiKey = authHeader.substring(7);
  
  if (!apiKey.startsWith('casino_')) {
    return { success: false, error: 'Invalid API key format' };
  }
  
  const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
  
  const supabase = createServerClient();
  
  const { data: agent, error } = await supabase
    .from('agents')
    .select('*')
    .eq('api_key_hash', apiKeyHash)
    .single();
  
  if (error || !agent) {
    return { success: false, error: 'Invalid API key' };
  }
  
  if (agent.is_banned) {
    return { success: false, error: `Agent is banned: ${agent.ban_reason || 'No reason provided'}` };
  }
  
  // Update last active
  await supabase
    .from('agents')
    .update({ last_active: new Date().toISOString() })
    .eq('id', agent.id);
  
  return { success: true, agent };
}
