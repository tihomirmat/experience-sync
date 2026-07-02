/**
 * enrollSequenceTrigger
 * Called by entity automations (Booking create/update, Customer create, GroupOffer update, GroupInquiry create)
 * Checks if any active sequence matches the trigger and enrolls the relevant customer.
 *
 * SECURITY: This endpoint can be invoked without authentication (entity
 * automations call it), so it must NEVER trust the request payload.
 * The payload only tells us WHICH entity changed — the actual entity data is
 * reloaded from the database before any trigger is resolved. An attacker can
 * therefore not enroll arbitrary e-mail addresses; at most they can re-fire a
 * trigger for a real record, which is de-duplicated below.
 *
 * Payload shape (from entity automation):
 *   event: { type, entity_name, entity_id }
 *   data: current entity data (used only for the id fallback)
 *   old_data: previous data (update events; used only for transition gating)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SUPPORTED_ENTITIES = ['Customer', 'Booking', 'GroupOffer', 'GroupInquiry'];

// Map entity events to sequence triggers
function resolveTriggersForEvent(entityName, eventType, data, oldData) {
  const triggers = [];

  if (entityName === 'Customer' && eventType === 'create') {
    triggers.push({ trigger: 'customer_added', customer_id: data.id, customer_email: data.email, tenant_id: data.tenant_id, context: { customer_name: data.name } });
  }

  if (entityName === 'Booking') {
    if (data.status === 'confirmed' && (eventType === 'create' || (eventType === 'update' && oldData?.status !== 'confirmed'))) {
      triggers.push({ trigger: 'booking_confirmed', customer_id: data.customer_id, customer_email: data.customer_email, tenant_id: data.tenant_id, context: { customer_name: data.customer_name, experience_title: data.experience_title, departure_date: data.departure_date } });
    }
    if (eventType === 'update' && oldData?.status !== 'completed' && data.status === 'completed') {
      triggers.push({ trigger: 'booking_completed', customer_id: data.customer_id, customer_email: data.customer_email, tenant_id: data.tenant_id, context: { customer_name: data.customer_name, experience_title: data.experience_title } });
    }
  }

  if (entityName === 'GroupOffer') {
    if (data.status === 'sent' && (eventType === 'create' || (eventType === 'update' && oldData?.status !== 'sent'))) {
      triggers.push({ trigger: 'offer_sent', customer_id: null, customer_email: data.contact_email, tenant_id: data.tenant_id, context: { customer_name: data.contact_name, company_name: data.company_name, offer_number: data.offer_number, experience_title: data.experience_title } });
    }
    if (eventType === 'update' && oldData?.status !== 'accepted' && data.status === 'accepted') {
      triggers.push({ trigger: 'offer_accepted', customer_id: null, customer_email: data.contact_email, tenant_id: data.tenant_id, context: { customer_name: data.contact_name, company_name: data.company_name, offer_number: data.offer_number } });
    }
  }

  if (entityName === 'GroupInquiry' && eventType === 'create') {
    triggers.push({ trigger: 'inquiry_received', customer_id: null, customer_email: data.contact_email, tenant_id: data.tenant_id, context: { customer_name: data.contact_name, company_name: data.company_name, experience_title: data.experience_title } });
  }

  return triggers;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  let payload = {};
  try { payload = await req.json(); } catch { /* ignore */ }
  const { event, data, old_data } = payload || {};

  if (!event || !data) return Response.json({ ok: true, skipped: 'no_data' });

  const entityName = event.entity_name;
  const entityId = event.entity_id || data.id;
  if (!SUPPORTED_ENTITIES.includes(entityName) || !entityId) {
    return Response.json({ ok: true, skipped: 'unsupported_entity' });
  }

  // SECURITY: reload the entity from the database — never trust payload data.
  let dbData = null;
  try { dbData = await base44.asServiceRole.entities[entityName].get(entityId); } catch { /* ignore */ }
  if (!dbData) return Response.json({ ok: true, skipped: 'entity_not_found' });

  const triggers = resolveTriggersForEvent(entityName, event.type, dbData, old_data);
  if (triggers.length === 0) return Response.json({ ok: true, skipped: 'no_matching_trigger' });

  console.log(`[enrollSequenceTrigger] ${entityName} ${event.type} → ${triggers.map(t => t.trigger).join(', ')}`);

  const enrolled = [];

  for (const t of triggers) {
    if (!t.customer_email || !t.tenant_id) continue;

    // Find active sequences matching this trigger
    const sequences = await base44.asServiceRole.entities.EmailSequence.filter({
      tenant_id: t.tenant_id,
      trigger: t.trigger,
      status: 'active',
    });

    for (const seq of sequences) {
      // Check if already enrolled and active
      const existing = await base44.asServiceRole.entities.EmailSequenceEnrollment.filter({
        sequence_id: seq.id,
        customer_email: t.customer_email,
        status: 'active',
      });
      if (existing.length > 0) {
        console.log(`[enrollSequenceTrigger] Already enrolled: ${t.customer_email} in ${seq.name}`);
        continue;
      }

      // Load first step to compute next_send_at
      const steps = await base44.asServiceRole.entities.EmailSequenceStep.filter({
        tenant_id: t.tenant_id,
        sequence_id: seq.id,
      });
      steps.sort((a, b) => a.step_number - b.step_number);
      const firstStep = steps[0];

      const now = new Date();
      let nextSendAt = now.toISOString();
      if (firstStep) {
        const delayMs = ((firstStep.delay_days || 0) * 24 + (firstStep.delay_hours || 0)) * 60 * 60 * 1000;
        nextSendAt = new Date(now.getTime() + delayMs).toISOString();
      }

      await base44.asServiceRole.entities.EmailSequenceEnrollment.create({
        tenant_id: t.tenant_id,
        sequence_id: seq.id,
        customer_id: t.customer_id || '',
        customer_email: t.customer_email,
        status: 'active',
        current_step: firstStep?.step_number || 1,
        next_send_at: nextSendAt,
        started_at: now.toISOString(),
        context_json: JSON.stringify(t.context || {}),
      });

      console.log(`[enrollSequenceTrigger] Enrolled ${t.customer_email} in "${seq.name}" step ${firstStep?.step_number || 1}, next at ${nextSendAt}`);
      enrolled.push({ email: t.customer_email, sequence: seq.name });
    }
  }

  return Response.json({ ok: true, enrolled });
});
