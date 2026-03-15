import fs from 'fs';
import path from 'path';

interface SecretJson {
  db?: { host?: string; port?: number; user?: string; password?: string; database?: string };
  openrouter_api_key?: string;
  ark_api_key?: string;
  resend_api_key?: string;
  resend_from?: string;
  need_check_email?: boolean;
  daily_gen_limit_enabled?: boolean;
  daily_gen_limit?: number;
  admin_email?: string;
  admin_emails?: string[];
  admin_usernames?: string[];
  prompt_log_enabled?: boolean;
}

function loadSecret(): SecretJson {
  const secretPath = path.resolve(__dirname, '../../../secret_json.json');
  const defaultPath = path.resolve(__dirname, '../../../secret_json_default.json');
  const filePath = fs.existsSync(secretPath) ? secretPath : defaultPath;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return {};
  }
}

export const secret = loadSecret();
