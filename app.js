// PediCare Office — Main Application Controller

import { supabase } from './supabaseClient.js';
import { DEMO_ACCOUNTS } from './config.js';
import {
  state,
  $,
  escapeHtml,
  toast,
  showFormModal,
} from './state.js';
import {
  callClinicEdgeFunction,
  fetchCurrentUserProfile,
  loadDashboardData,
  getSelectedPatient,
} from './api.js';
import {
  renderPatientDashboardContent,
  registerPatientPortalActions,
} from './views/patientView.js';
import {
  renderDoctorDashboardContent,
  registerDoctorActions,
} from './views/doctorView.js';
import {
  renderNurseDashboardContent,
  registerNurseActions,
} from './views/nurseView.js';
import {
  renderAdminDashboardContent,
  registerAdminActions,
} from './views/adminView.js';

window.pedicare = window.pedicare || {};

const ICONS = {
  Dashboard: '▦',
  'My Information': '♟',
  'Visit Summaries': '▧',
  Messages: '✉',
  'Find Patient': '⌕',
  'Patient History': '▤',
  'Physical Examination': '♧',
  Prescription: '✎',
  Measurements: '♡',
  'Health Info': '♢',
  Reports: '▥',
  Patients: '♟',
  Doctors: '✚',
  Nurses: '♡',
  Guardians: '♢',
  Appointments: '▦',
  'Roles & Permissions': '🛡',
  'Audit Logs': '▤',
};

function renderLogo() {
  return `<div class="brand"><span class="logo">✚</span><span>PediCare Office</span></div>`;
}

function renderHeader(name, sub) {
  return `
    <header class="top">
      ${renderLogo()}
      <div class="userbox">
        <div>
          <strong>${escapeHtml(name)}</strong><br>
          <small>${escapeHtml(sub)}</small>
        </div>
        <button title="Change Password" onclick="window.pedicare.openChangePasswordModal()">🔑</button>
        <button title="Notifications" onclick="window.pedicare.showNotifications()">♧</button>
        <button onclick="window.pedicare.logout()">⇥ Logout</button>
      </div>
    </header>
  `;
}

function toPageSlug(label) {
  return label
    .toLowerCase()
    .replace(/&/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function renderSidebar(items) {
  return `
    <aside class="sidebar">
      ${items
        .map((label, i) => {
          const slug = toPageSlug(label);
          const isActive = state.page === slug || (!state.page && i === 0);
          return `<button class="navitem ${isActive ? 'active' : ''}" onclick="window.pedicare.navigate('${slug}')"><span class="ico">${ICONS[label] || '▦'}</span>${escapeHtml(label)}</button>`;
        })
        .join('')}
      <button class="navitem logout" onclick="window.pedicare.logout()"><span class="ico">⇥</span>Logout</button>
    </aside>
  `;
}

function renderLoginView() {
  return `
    <div class="login-page">
      <header class="top">
        ${renderLogo()}
        <small style="border-left:2px solid #ddd;padding-left:22px;margin-right:auto;margin-left:22px">Pediatric Doctor's Office</small>
      </header>
      <main class="login-main">
        <div class="welcome">
          <h1>Welcome to<br>PediCare Office</h1>
          <p>A simple and secure way to manage pediatric patient care.</p>
        </div>
        <section class="login-card">
          <h2>Sign in to access your account</h2>
          <form id="loginForm">
            <div class="field">
              <label>User ID (Email)</label>
              <input id="email" type="email" placeholder="✉  Enter your email" required>
            </div>
            <div class="field">
              <label>Password</label>
              <input id="password" type="password" placeholder="▣  Enter your password" required>
            </div>
            <div class="field">
              <label>Select Your Role</label>
              <select id="role">
                <option value="guardian">Patient / Parent / Guardian</option>
                <option value="doctor">Doctor</option>
                <option value="nurse">Nurse</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button class="primary" id="loginSubmitBtn" type="submit">Login</button>
          </form>
          <div class="separator">OR</div>
          <button class="outline" style="width:100%" onclick="window.pedicare.openRegisterGuardianModal()">Create Patient Account</button>
          <div class="hint">
            ⓘ &nbsp; If you are a patient or parent, create an account to access your child's health information.
            <div style="margin-top:8px;padding-top:8px;border-top:1px solid #d7e1f7;font-size:12px">
              <strong>Demo Accounts (Click to Autofill):</strong>
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
                ${DEMO_ACCOUNTS.map(
                  (acc, idx) =>
                    `<button type="button" style="padding:4px 8px;font-size:11px;border-radius:6px" onclick="window.pedicare.fillDemoAccount(${idx})">${escapeHtml(acc.label.split(' (')[0])}</button>`
                ).join('')}
              </div>
            </div>
          </div>
          <div style="text-align:center;margin-top:20px">
            <button type="button" style="border:0;padding:0;color:#496b9c" onclick="window.pedicare.openForgotPasswordModal()">Forgot Password?</button>
          </div>
        </section>
      </main>
      <footer class="login-footer" style="position:relative;padding-bottom:36px">
        <div>🛡<strong>Secure &amp; Confidential</strong><small>Your information is safe and secure.</small></div>
        <div>♟<strong>Multiple User Roles</strong><small>Patients, Nurses, Doctors &amp; Admins</small></div>
        <div>🔒<strong>Authorized Access Only</strong><small>Please do not share your credentials.</small></div>
        <div style="position:absolute;bottom:8px;font-size:13px;color:#f6ed9c;font-weight:700">PediCare Office | Pediatric Doctor's Office | Secure · Simple · Patient-focused</div>
      </footer>
    </div>
  `;
}

function getHeaderSubtitle() {
  if (!state.profile) return '';
  if (state.profile.role === 'guardian') {
    const pt = getSelectedPatient();
    return pt ? `Guardian of ${pt.full_name}` : state.guardians[0]?.relationship || 'Parent / Guardian';
  }
  if (state.profile.role === 'doctor') {
    const doc = state.doctors.find((d) => d.profile_id === state.profile.id);
    return doc?.specialty || 'Pediatrician';
  }
  if (state.profile.role === 'nurse') {
    const nurse = state.nurses.find((n) => n.profile_id === state.profile.id);
    return nurse?.title || 'Nurse Practitioner';
  }
  if (state.profile.role === 'admin') {
    const adm = state.admins.find((a) => a.profile_id === state.profile.id);
    return adm?.title || 'Clinic Administrator';
  }
  return '';
}

export function renderApp() {
  const root = $('#root');
  if (!root) return;

  if (!state.session || !state.profile || state.role === 'login') {
    root.innerHTML = renderLoginView();
    const loginForm = $('#loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', handleLoginSubmit);
    }
    return;
  }

  const role = state.profile.role;
  const headerHtml = renderHeader(state.profile.full_name, getHeaderSubtitle());

  let sidebarItems = [];
  let mainContentHtml = '';

  if (role === 'guardian') {
    sidebarItems = ['Dashboard', 'My Information', 'Visit Summaries', 'Messages'];
    mainContentHtml = renderPatientDashboardContent();
  } else if (role === 'doctor') {
    sidebarItems = ['Dashboard', 'Find Patient', 'Patient History', 'Physical Examination', 'Prescription'];
    mainContentHtml = renderDoctorDashboardContent();
  } else if (role === 'nurse') {
    sidebarItems = ['Dashboard', 'Find Patient', 'Measurements', 'Health Info', 'Patient History', 'Reports'];
    mainContentHtml = renderNurseDashboardContent();
  } else if (role === 'admin') {
    sidebarItems = [
      'Dashboard',
      'Patients',
      'Doctors',
      'Nurses',
      'Guardians',
      'Appointments',
      'Roles & Permissions',
      'Audit Logs',
    ];
    mainContentHtml = renderAdminDashboardContent();
  }

  root.innerHTML = `
    <div class="shell">
      ${headerHtml}
      <div class="app">
        ${renderSidebar(sidebarItems)}
        <main class="content">
          ${mainContentHtml}
        </main>
      </div>
    </div>
  `;

  // Bind child switcher if present on Guardian dashboard
  const childSelect = $('#guardianChildSelect');
  if (childSelect) {
    childSelect.addEventListener('change', (e) => {
      state.selectedPatientId = Number(e.target.value);
      renderApp();
    });
  }

  // Bind Enter key on subpage search input
  const subSearch = $('#subpageSearchInput');
  if (subSearch) {
    subSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        window.pedicare.applySubpageSearch();
      }
    });
  }
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const email = ($('#email')?.value || '').trim().toLowerCase();
  const password = $('#password')?.value || '';
  const selectedRole = $('#role')?.value || 'guardian';
  const btn = $('#loginSubmitBtn');

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Signing in...';
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const profile = await fetchCurrentUserProfile(data.user.id);
    if (!profile.is_active) {
      await supabase.auth.signOut();
      throw new Error('This account has been deactivated by the clinic administrator.');
    }

    state.session = data.session;
    state.profile = profile;
    state.role = profile.role;
    state.page = 'dashboard';
    state.selectedPatientId = null;

    await loadDashboardData();
    renderApp();

    if (selectedRole !== profile.role) {
      toast(
        `Signed in as ${profile.full_name}. Redirected to your authorized ${profile.role.toUpperCase()} dashboard.`
      );
    } else {
      toast(`Welcome back, ${profile.full_name}!`);
    }
  } catch (err) {
    toast(err?.message || 'Sign in failed. Check your email and password.', true);
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Login';
    }
  }
}

function registerGlobalActions() {
  window.pedicare.navigate = (pageSlug) => {
    state.page = pageSlug;
    state.searchQuery = '';
    state.currentPage = 1;
    renderApp();
  };

  window.pedicare.applySubpageSearch = () => {
    const q = ($('#subpageSearchInput')?.value || '').trim();
    state.searchQuery = q;
    state.currentPage = 1;
    renderApp();
  };

  window.pedicare.fillDemoAccount = (idx) => {
    const acc = DEMO_ACCOUNTS[idx];
    if (!acc) return;
    if ($('#email')) $('#email').value = acc.email;
    if ($('#password')) $('#password').value = acc.password;
    if ($('#role')) $('#role').value = acc.role;
    toast(`Filled demo credentials for ${acc.label}`);
  };

  window.pedicare.logout = async () => {
    await supabase.auth.signOut();
    state.session = null;
    state.profile = null;
    state.role = 'login';
    state.page = 'dashboard';
    state.selectedPatientId = null;
    renderApp();
    toast('Signed out securely.');
  };

  window.pedicare.showNotifications = () => {
    const unread = state.messages.filter((m) => !m.is_read && m.sender_id !== state.profile?.id);
    if (unread.length > 0) {
      toast(`You have ${unread.length} unread message(s) from your care team.`);
    } else {
      toast('Notifications: You are all caught up.');
    }
  };

  window.pedicare.openRegisterGuardianModal = () => {
    showFormModal({
      title: 'Create Patient Account',
      description: 'Create an account to access your child’s health information. Public registration creates a verified Guardian/Patient account.',
      fields: [
        { name: 'full_name', label: 'Parent / Guardian Full Name', placeholder: 'e.g. Amanda Miller' },
        { name: 'email', label: 'Email Address', type: 'email', placeholder: 'amanda.miller@email.com' },
        { name: 'password', label: 'Password (min 6 characters)', type: 'password', placeholder: 'Create a strong password' },
        { name: 'phone', label: 'Phone Number', value: '(555) 234-5678' },
        { name: 'patient_name', label: 'Child / Patient Full Name', placeholder: 'e.g. Sophia Miller' },
        { name: 'patient_dob', label: 'Patient Date of Birth', type: 'date', value: '2020-06-15' },
        {
          name: 'patient_gender',
          label: 'Child Gender',
          type: 'select',
          value: 'Female',
          options: [
            { value: 'Female', label: 'Female' },
            { value: 'Male', label: 'Male' },
            { value: 'Other', label: 'Other' },
          ],
        },
        { name: 'blood_group', label: 'Child Blood Group', value: 'O+' },
        { name: 'allergies', label: 'Known Allergies', value: 'None reported' },
        { name: 'insurance_provider', label: 'Insurance Provider', value: 'BlueCare Health' },
      ],
      submitLabel: 'Create Account & Sign In',
      onSubmit: async (values) => {
        await callClinicEdgeFunction({
          action: 'register_guardian',
          ...values,
        });

        const { data, error } = await supabase.auth.signInWithPassword({
          email: values.email.trim().toLowerCase(),
          password: values.password,
        });
        if (error) throw error;

        state.session = data.session;
        state.profile = await fetchCurrentUserProfile(data.user.id);
        state.role = state.profile.role;
        state.page = 'dashboard';
        await loadDashboardData();
        renderApp();
        toast(`Welcome to PediCare Office, ${state.profile.full_name}!`);
      },
    });
  };

  window.pedicare.openForgotPasswordModal = () => {
    showFormModal({
      title: 'Reset Password',
      description: 'Enter your account email to receive password reset instructions from Supabase Auth.',
      fields: [
        { name: 'email', label: 'Email Address', type: 'email', placeholder: 'Enter your registered email' },
      ],
      submitLabel: 'Send Reset Link',
      onSubmit: async (values) => {
        const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        toast(`Password reset instructions sent to ${values.email}.`);
      },
    });
  };

  window.pedicare.openChangePasswordModal = () => {
    showFormModal({
      title: 'Update Account Password',
      description: 'Enter a new password for your signed-in PediCare Office account.',
      fields: [
        { name: 'new_password', label: 'New Password (min 6 characters)', type: 'password', placeholder: 'Enter new password' },
      ],
      submitLabel: 'Update Password',
      onSubmit: async (values) => {
        if (!values.new_password || values.new_password.length < 6) {
          throw new Error('Password must be at least 6 characters.');
        }
        const { error } = await supabase.auth.updateUser({ password: values.new_password });
        if (error) throw error;
        toast('Your password has been updated.');
      },
    });
  };

  registerPatientPortalActions(renderApp);
  registerDoctorActions(renderApp);
  registerNurseActions(renderApp);
  registerAdminActions(renderApp);
}

async function initApp() {
  registerGlobalActions();
  renderApp();

  // Restore existing persistent session if logged in
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.user) {
    try {
      const profile = await fetchCurrentUserProfile(session.user.id);
      if (profile && profile.is_active) {
        state.session = session;
        state.profile = profile;
        state.role = profile.role;
        await loadDashboardData();
        renderApp();
      } else {
        await supabase.auth.signOut();
      }
    } catch {
      // Fallback to login screen
    }
  }

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY' && session) {
      window.pedicare.openChangePasswordModal();
    } else if (event === 'SIGNED_OUT') {
      state.session = null;
      state.profile = null;
      state.role = 'login';
      renderApp();
    }
  });
}

initApp();
