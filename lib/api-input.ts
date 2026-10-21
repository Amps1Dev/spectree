import { z } from 'zod';

const provider = z.enum(['ollama', 'groq']).optional();
export const chatInput = z.object({
  provider,
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().trim().min(1),
  })).min(1),
});
export const reportInput = z.object({
  provider,
  engagementName: z.string().trim().min(1),
  targetIp: z.string().trim().min(1),
  findings: z.string().trim().min(1),
});
