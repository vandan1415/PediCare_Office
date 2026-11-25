// PediCare Office — Comprehensive End-to-End Test Suite
// Tests Authentication, RLS Isolation, Role Permissions, Clinical CRUD, Edge Functions, and Audit Logs.

import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import {
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_EDGE_FUNCTION_URL,
} from '../js/config.js';

function makeClient() {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function runTests() {
  console.log('=== PediCare Office End-to-End Verification Suite ===\n');

  // -------------------------------------------------------------------------
  // 1. GUARDIAN LOGIN & RLS ISOLATION TESTS
  // -------------------------------------------------------------------------
  console.log('1. Testing Guardian Authentication & RLS Isolation (sarah.j@email.com)...');
  const guardianClient = makeClient();
  const { data: gAuth, error: gAuthErr } = await guardianClient.auth.signInWithPassword({
    email: 'sarah.j@email.com',
    password: 'PediCare123!',
  });
  assert.ifError(gAuthErr);
  assert.ok(gAuth.user?.id, 'Guardian should sign in');

  const { data: gProfile, error: gProfErr } = await guardianClient
    .from('profiles')
    .select('*')
    .eq('id', gAuth.user.id)
    .single();
  assert.ifError(gProfErr);
  assert.equal(gProfile.role, 'guardian', 'Role must be guardian');

  // Guardian should ONLY see their own child (Leo Jenkins, PC-56801)
  const { data: gPatients, error: gPatErr } = await guardianClient
    .from('patients')
    .select('*');
  assert.ifError(gPatErr);
  assert.ok(gPatients.length >= 1, 'Guardian should see at least Leo Jenkins');
  assert.ok(
    gPatients.every((p) => p.full_name.includes('Jenkins')),
    'RLS must isolate patients so Sarah Jenkins only sees her own children'
  );
  console.log(`   ✓ Guardian sees ${gPatients.length} patient(s): ${gPatients.map((p) => p.full_name).join(', ')} (other families hidden by RLS)`);

  // Guardian attempting self-role escalation to admin MUST fail
  const { error: escalateErr } = await guardianClient
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', gAuth.user.id);
  assert.ok(escalateErr, 'RLS must block guardian from self-escalating role to admin');
  console.log('   ✓ Self-role escalation to admin blocked by database RLS');

  // Guardian attempting to insert a prescription MUST fail
  const { error: fakeRxErr } = await guardianClient.from('prescriptions').insert({
    patient_id: gPatients[0].id,
    medication_name: 'Unauthorized Med',
    dosage: '10mg',
    instructions: 'Unauthorized',
  });
  assert.ok(fakeRxErr, 'RLS must block guardian from prescribing medication');
  console.log('   ✓ Unauthorized prescription insert blocked by database RLS');

  // Guardian attempting to call Admin Edge Function MUST return 403
  const edgeRes = await fetch(SUPABASE_EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${gAuth.session.access_token}`,
    },
    body: JSON.stringify({ action: 'toggle_active', profile_id: gAuth.user.id, is_active: true }),
  });
  assert.equal(edgeRes.status, 403, 'Edge function must reject non-admin JWT with 403');
  console.log('   ✓ Admin Edge Function rejected Guardian token with HTTP 403');

  // -------------------------------------------------------------------------
  // 2. DOCTOR LOGIN & CLINICAL WORKFLOW TESTS
  // -------------------------------------------------------------------------
  console.log('\n2. Testing Doctor Authentication & Clinical CRUD (aaron.smith@pedicare.demo)...');
  const docClient = makeClient();
  const { data: dAuth, error: dAuthErr } = await docClient.auth.signInWithPassword({
    email: 'aaron.smith@pedicare.demo',
    password: 'PediCare123!',
  });
  assert.ifError(dAuthErr);

  const { data: dPatients } = await docClient.from('patients').select('*');
  assert.ok(dPatients.length >= 7, 'Doctor should access all clinic patients');
  console.log(`   ✓ Doctor retrieved ${dPatients.length} clinic patients`);

  const benjamin = dPatients.find((p) => p.patient_code === 'PC-6821');
  assert.ok(benjamin, 'Benjamin Thompson (PC-6821) should exist');

  const { data: dExams } = await docClient
    .from('examinations')
    .select('*')
    .eq('patient_id', benjamin.id);
  assert.ok(dExams.length >= 1, 'Benjamin should have examination records');
  console.log(`   ✓ Doctor loaded Benjamin Thompson's examination findings & vitals`);

  // -------------------------------------------------------------------------
  // 3. NURSE LOGIN & VITALS / TASKS WORKFLOW TESTS
  // -------------------------------------------------------------------------
  console.log('\n3. Testing Nurse Authentication & Workflows (sarah.lee@pedicare.demo)...');
  const nurseClient = makeClient();
  const { data: nAuth, error: nAuthErr } = await nurseClient.auth.signInWithPassword({
    email: 'sarah.lee@pedicare.demo',
    password: 'PediCare123!',
  });
  assert.ifError(nAuthErr);

  const { data: nTasks, error: nTaskErr } = await nurseClient
    .from('nurse_tasks')
    .select('*')
    .order('id');
  assert.ifError(nTaskErr);
  assert.ok(nTasks.length >= 4, 'Nurse tasks should be loaded');

  // Toggle first task and restore
  const firstTask = nTasks[0];
  const { error: toggleErr } = await nurseClient
    .from('nurse_tasks')
    .update({ is_completed: !firstTask.is_completed })
    .eq('id', firstTask.id);
  assert.ifError(toggleErr);
  await nurseClient
    .from('nurse_tasks')
    .update({ is_completed: firstTask.is_completed })
    .eq('id', firstTask.id);
  console.log('   ✓ Nurse task checklist toggle persisted to Supabase');

  // Nurse attempting to prescribe medication MUST be blocked by RLS
  const { error: nurseRxErr } = await nurseClient.from('prescriptions').insert({
    patient_id: benjamin.id,
    medication_name: 'Nurse Test Med',
    dosage: '5mg',
    instructions: 'Test',
  });
  assert.ok(nurseRxErr, 'RLS must block nurse from prescribing medication');
  console.log('   ✓ Nurse blocked from creating prescriptions by RLS');

  // -------------------------------------------------------------------------
  // 4. ADMIN LOGIN, CLINIC MANAGEMENT & AUDIT LOG TESTS
  // -------------------------------------------------------------------------
  console.log('\n4. Testing Admin Authentication, Staff Management & Audit Logs (admin@pedicare.demo)...');
  const adminClient = makeClient();
  const { data: aAuth, error: aAuthErr } = await adminClient.auth.signInWithPassword({
    email: 'admin@pedicare.demo',
    password: 'PediCare123!',
  });
  assert.ifError(aAuthErr);

  const [doctorsRes, nursesRes, guardiansRes, apptsRes, logsRes] = await Promise.all([
    adminClient.from('doctors').select('*'),
    adminClient.from('nurses').select('*'),
    adminClient
      .from('guardians')
      .select('*, profile:profiles!inner(role)')
      .eq('profile.role', 'guardian'),
    adminClient.from('appointments').select('*'),
    adminClient.from('audit_logs').select('*').limit(25),
  ]);

  assert.ok(doctorsRes.data.length >= 2, 'Admin sees all doctors');
  assert.ok(nursesRes.data.length >= 2, 'Admin sees all nurses');
  assert.ok(guardiansRes.data.length >= 5, 'Admin sees all guardians');
  assert.ok(apptsRes.data.length >= 7, 'Admin sees all appointments');
  assert.ok(logsRes.data.length >= 10, 'Admin sees audit logs');

  console.log(
    `   ✓ Admin verified: ${doctorsRes.data.length} doctors, ${nursesRes.data.length} nurses, ${guardiansRes.data.length} guardians, ${apptsRes.data.length} appointments, ${logsRes.data.length}+ audit log entries`
  );

  console.log('\n=== ALL END-TO-END TESTS PASSED SUCCESSFULLY ===');
}

runTests().catch((err) => {
  console.error('E2E Test Failed:', err);
  process.exit(1);
});
