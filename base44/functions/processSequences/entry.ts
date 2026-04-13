/**
 * processSequences - runs on schedule (every 15 min)
 * For each active enrollment:
 *   1. Check if next_send_at is due
 *   2. Load the step's template, inject context, send via EmailConnection
 *   3. Log the email in EmailMessage
 *   4. Advance to next step (or complete enrollment)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// ── helpers ────────────────────────────────────────────────────────────────

function injectVariables(text, ctx) {
  if (!text || !ctx) return text || '';
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => ctx[key] ?? '');
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

// Send via SMTP
async function sendSmtp(conn, message) {
  // Use a simple fetch to a relay OR use nodemailer-compatible approach
  // Since Deno doesn't have nodemailer, we'll use fetch to the SMTP2Go / Resend fallback
  // If provider is resend, use Resend API
  if (conn.provider === 'resend') {
    const key = conn.resend_api_key_enc;
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${conn.from_name} <${conn.from_email}>`,
        to: [message.to_email],
        subject: message.subject,
        html: message.body_html,
        text: message.body_text,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Resend error: ${JSON.stringify(data)}`);
    return { external_id: data.id };
  }

  // SMTP via smtp2go (if configured) or base44 SendEmail integration fallback
  throw new Error(`SMTP provider "${conn.provider}" not supported for automated sequences. Use "resend".`);
}

// ── main ───────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Allow both scheduled (no user) and manual admin calls
  const now = new Date();
  console.log(`[processSequences] Starting at ${now.toISOString()}`);

  // 1. Load all active enrollments due for processing
  const allEnrollments = await base44.asServiceRole.entities.EmailSequenceEnrollment.filter({ status: 'active' });

  const due = allEnrollments.filter(enr => {
    if (!enr.next_send_at) return true; // never scheduled → process immediately
    return new Date(enr.next_send_at) <= now;
  });

  console.log(`[processSequences] ${allEnrollments.length} active enrollments, ${due.length} due`);

  const results = [];

  for (const enr of due) {
    try {
      // 2. Load sequence + steps
      const sequence = await base44.asServiceRole.entities.EmailSequence.get(enr.sequence_id);
      if (!sequence || sequence.status !== 'active') {
        // Sequence was paused/deleted — stop enrollment
        await base44.asServiceRole.entities.EmailSequenceEnrollment.update(enr.id, {
          status: 'stopped',
          stopped_reason: 'Sekvenca ni aktivna',
        });
        results.push({ enr_id: enr.id, action: 'stopped', reason: 'sequence_not_active' });
        continue;
      }

      const steps = await base44.asServiceRole.entities.EmailSequenceStep.filter(
        { tenant_id: sequence.tenant_id, sequence_id: sequence.id },
      );
      // sort by step_number
      steps.sort((a, b) => a.step_number - b.step_number);

      const currentStep = steps.find(s => s.step_number === enr.current_step);

      if (!currentStep) {
        // No more steps → complete
        await base44.asServiceRole.entities.EmailSequenceEnrollment.update(enr.id, {
          status: 'completed',
          completed_at: now.toISOString(),
        });
        results.push({ enr_id: enr.id, action: 'completed' });
        continue;
      }

      // 3. Load template
      if (!currentStep.template_id) {
        // Skip step - no template configured, advance to next
        const nextStep = steps.find(s => s.step_number > enr.current_step);
        if (nextStep) {
          const nextSendAt = addHours(now, (nextStep.delay_days || 0) * 24 + (nextStep.delay_hours || 0));
          await base44.asServiceRole.entities.EmailSequenceEnrollment.update(enr.id, {
            current_step: nextStep.step_number,
            next_send_at: nextSendAt.toISOString(),
          });
        } else {
          await base44.asServiceRole.entities.EmailSequenceEnrollment.update(enr.id, {
            status: 'completed',
            completed_at: now.toISOString(),
          });
        }
        results.push({ enr_id: enr.id, action: 'skipped_no_template', step: currentStep.step_number });
        continue;
      }

      const template = await base44.asServiceRole.entities.EmailTemplate.get(currentStep.template_id);
      if (!template) {
        results.push({ enr_id: enr.id, action: 'error', reason: 'template_not_found' });
        continue;
      }

      // 4. Load email connection for tenant
      const connections = await base44.asServiceRole.entities.EmailConnection.filter({
        tenant_id: sequence.tenant_id,
        status: 'active',
      });
      const conn = connections[0];
      if (!conn) {
        await base44.asServiceRole.entities.EmailSequenceEnrollment.update(enr.id, {
          status: 'failed',
          stopped_reason: 'Ni aktivne email povezave',
        });
        results.push({ enr_id: enr.id, action: 'failed', reason: 'no_email_connection' });
        continue;
      }

      // 5. Build context for variable injection
      let ctx = {};
      try { ctx = JSON.parse(enr.context_json || '{}'); } catch {}
      ctx.customer_email = enr.customer_email;

      // Try to load customer name
      if (enr.customer_id) {
        try {
          const customer = await base44.asServiceRole.entities.Customer.get(enr.customer_id);
          if (customer) ctx.customer_name = customer.name || ctx.customer_name;
        } catch {}
      }

      // 6. Inject variables into template
      const subject = injectVariables(currentStep.subject_override || template.subject, ctx);
      const bodyHtml = injectVariables(template.body_html, ctx);
      const bodyText = bodyHtml.replace(/<[^>]+>/g, '');

      // 7. Stop on reply check — if stop_on_reply is true, check for inbound emails from this customer
      if (sequence.stop_on_reply) {
        const replies = await base44.asServiceRole.entities.EmailMessage.filter({
          tenant_id: sequence.tenant_id,
          from_email: enr.customer_email,
          direction: 'inbound',
        });
        if (replies.length > 0) {
          await base44.asServiceRole.entities.EmailSequenceEnrollment.update(enr.id, {
            status: 'stopped',
            stopped_reason: 'Stranka je odgovorila',
          });
          results.push({ enr_id: enr.id, action: 'stopped', reason: 'reply_received' });
          continue;
        }
      }

      // 8. Send the email
      let externalId = null;
      let sendError = null;
      try {
        const sent = await sendSmtp(conn, {
          to_email: enr.customer_email,
          subject,
          body_html: bodyHtml,
          body_text: bodyText,
        });
        externalId = sent?.external_id;
      } catch (err) {
        sendError = err.message;
        console.error(`[processSequences] Send failed for enrollment ${enr.id}:`, err.message);
      }

      // 9. Log email message
      await base44.asServiceRole.entities.EmailMessage.create({
        tenant_id: sequence.tenant_id,
        direction: 'outbound',
        folder: 'sent',
        status: sendError ? 'failed' : 'sent',
        from_email: conn.from_email,
        from_name: conn.from_name,
        to_email: enr.customer_email,
        subject,
        body_html: bodyHtml,
        body_text: bodyText,
        customer_id: enr.customer_id,
        sequence_id: sequence.id,
        sequence_step: currentStep.step_number,
        sent_at: sendError ? null : now.toISOString(),
        error: sendError,
      });

      if (sendError) {
        await base44.asServiceRole.entities.EmailSequenceEnrollment.update(enr.id, {
          status: 'failed',
          stopped_reason: sendError,
        });
        results.push({ enr_id: enr.id, action: 'send_failed', step: currentStep.step_number, error: sendError });
        continue;
      }

      // 10. Advance enrollment to next step
      const nextStep = steps.find(s => s.step_number > currentStep.step_number);
      if (nextStep) {
        const delayMs = ((nextStep.delay_days || 0) * 24 + (nextStep.delay_hours || 0)) * 60 * 60 * 1000;
        const nextSendAt = new Date(now.getTime() + delayMs);
        await base44.asServiceRole.entities.EmailSequenceEnrollment.update(enr.id, {
          current_step: nextStep.step_number,
          next_send_at: nextSendAt.toISOString(),
        });
        results.push({ enr_id: enr.id, action: 'sent_advance', step: currentStep.step_number, next_step: nextStep.step_number, next_send_at: nextSendAt.toISOString() });
      } else {
        // Last step sent — complete
        await base44.asServiceRole.entities.EmailSequenceEnrollment.update(enr.id, {
          status: 'completed',
          completed_at: now.toISOString(),
        });
        results.push({ enr_id: enr.id, action: 'sent_completed', step: currentStep.step_number });
      }

    } catch (err) {
      console.error(`[processSequences] Error processing enrollment ${enr.id}:`, err.message);
      results.push({ enr_id: enr.id, action: 'error', error: err.message });
    }
  }

  console.log(`[processSequences] Done. Results:`, JSON.stringify(results));
  return Response.json({ processed: due.length, results });
});