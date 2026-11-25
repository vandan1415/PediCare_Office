// PediCare Office — Public Supabase Configuration
// Only public/publishable keys are stored here. Never place service_role keys in frontend code.

export const SUPABASE_URL = 'https://aovgsiaqdacfvvlxexrt.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_DfaveZD2N2MQJBtFruqa4Q_UtH32_HY';
export const SUPABASE_EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/clinic-auth-admin`;

export const DEMO_ACCOUNTS = [
  {
    label: 'Patient / Guardian (Sarah Jenkins)',
    email: 'sarah.j@email.com',
    password: 'PediCare123!',
    role: 'guardian',
  },
  {
    label: 'Doctor (Dr. Aaron Smith)',
    email: 'aaron.smith@pedicare.demo',
    password: 'PediCare123!',
    role: 'doctor',
  },
  {
    label: 'Nurse (Sarah Lee, NP)',
    email: 'sarah.lee@pedicare.demo',
    password: 'PediCare123!',
    role: 'nurse',
  },
  {
    label: 'Admin (Victoria Sterling)',
    email: 'admin@pedicare.demo',
    password: 'PediCare123!',
    role: 'admin',
  },
];
