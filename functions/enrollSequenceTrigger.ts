/**
 * enrollSequenceTrigger
 * Called by entity automations (Booking create/update, Customer create, GroupOffer update, GroupInquiry create)
 * Checks if any active sequence matches the trigger and enrolls the relevant customer.
 *
 * Payload shape (from entity automation):
 *   event: { type, entity_name, entity_id }
 *   data: current entity data
 *   old_data: previous data (update events)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// Map entity events to sequence triggers
function resolveTriggersForEvent(entityName, eventType, data, oldData) {
  const triggers = [];

  if (entityName === 'Customer' && eventType === 'create') {
    triggers.push({ trigger: 'customer_added', customer_id: data.id, customer_email: data.email, tenant_id: data.tenant_id, context: { customer_name: data.name } });
  }

  if (entityName === 'Booking') {
    if (eventType === 'create' || (eventType === 'update' && oldData?.status !== 'confirmed' && data.status === 'confirmed')) {
      if (data.status === 'confirmed') {
        triggers.push({ trigger: 'booking_confirmed', customer_id: data.customer_id, customer_email: data.customer_email, tenant_id: data.tenant_id, context: { customer_name: data.customer_name, experience_title: data.experience_title, departure_date: data.departure_date } });
      }
    }
    if (eventType === 'update' && oldData?.status !== 'completed' && data.status === 'completed') {
      triggers.push({ trigger: 'booking_completed', customer_id: data.customer_id, customer_email: data.customer_email, tenant_id: data.tenant_id, context: { customer_name: data.customer_name, experience_title: data.experience_title } });
    }
  }

  if (entityName === 'GroupOffer') {
    if (eventType === 'create' && data.status === 'sent') {
      triggers.push({ trigger: 'offer_sent', customer_id: null, customer_email: data.contact_email, tenant_id: data.tenant_id, context: { customer_name: data.contact_name, company_name: data.company_name, offer_number: data.offer_number, experience_title: data.experience_title } });
    }
    if (eventType === 'update' && oldData?.status !== 'sent' && data.status === 'sent') {
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
  const payload = await req.json();
  const { event, data, old_data } = payload;

  if (!event || !data) return Response.json({ ok: true, skipped: 'no_data' });

  const triggers = resolveTriggersForEvent(event.entity_name, event.type, data, old_data);
  if (triggers.length === 0) return Response.json({ ok: true, skipped: 'no_matching_trigger' });

  console.log(`[enrollSequenceTrigger] ${event.entity_name} ${event.type} → ${triggers.map(t => t.trigger).join(', ')}`);

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