/**
 * DMO Feed Mapper / Adapter layer
 * ─────────────────────────────────────────────────────
 * Canonical → partner-specific format conversion.
 */

// ─── Canonical builders ───────────────────────────────

export function buildCanonicalListing(experience, tenant) {
  return {
    id: experience.id,
    provider_id: tenant.id,
    provider_name: tenant.name,
    title: { sl: experience.title_sl, en: experience.title_en },
    short_description: { sl: experience.short_description_sl, en: experience.short_description_en },
    full_description:  { sl: experience.full_description_sl,  en: experience.full_description_en  },
    duration_minutes: experience.duration_minutes,
    meeting_point: {
      name:    experience.meeting_point_name,
      address: experience.meeting_point_address,
      lat:     experience.meeting_point_lat,
      lng:     experience.meeting_point_lng,
    },
    price_from:  experience.base_price_from,
    currency:    experience.currency || 'EUR',
    booking_url: experience.booking_url_direct,
    images:      (experience.images || []).map(img => ({ url: img.url, alt: img.alt })),
    categories:  experience.category_tags || [],
    includes:    { sl: experience.includes_sl,             en: experience.includes_en },
    excludes:    { sl: experience.excludes_sl,             en: experience.excludes_en },
    cancellation_policy: { sl: experience.cancellation_policy_sl, en: experience.cancellation_policy_en },
    status:      experience.status,
    updated_at:  experience.updated_date,
  };
}

export function buildCanonicalAvailability(departures) {
  return departures.map(d => ({
    departure_id:       d.id,
    experience_id:      d.experience_id,
    start_at:           d.start_at,
    end_at:             d.end_at,
    capacity_total:     d.capacity_total,
    capacity_remaining: d.capacity_remaining,
    status:             d.status,
  }));
}

export function buildCanonicalPricing(experience, partner) {
  const basePrice = experience.base_price_from || 0;
  let partnerPrice = basePrice;

  if (partner) {
    if (partner.pricing_mode === 'net' || partner.pricing_mode === 'discount') {
      partnerPrice = basePrice * (1 - (partner.commission_rate || 0));
    }
  }

  return {
    experience_id: experience.id,
    price_from:    parseFloat(partnerPrice.toFixed(2)),
    currency:      experience.currency || 'EUR',
    pricing_mode:  partner?.pricing_mode || 'gross',
    commission_rate: partner?.commission_rate || 0,
  };
}

// ─── Adapters ─────────────────────────────────────────

/**
 * Generic adapter: applies a field_map from PartnerFeedProfile.
 * field_map_json: { "our.nested.field": "their_field_name" }
 */
export function applyFieldMap(canonicalObj, fieldMapJson) {
  let fieldMap = {};
  try { fieldMap = JSON.parse(fieldMapJson || '{}'); } catch { /* ignore */ }
  const result = {};
  for (const [srcPath, destKey] of Object.entries(fieldMap)) {
    const value = getNestedValue(canonicalObj, srcPath);
    if (value !== undefined) result[destKey] = value;
  }
  return result;
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((acc, key) => (acc != null ? acc[key] : undefined), obj);
}

/**
 * JABOOK adapter — placeholder, update fields when spec arrives.
 */
export function toJabookJson(canonical) {
  return {
    offer_id:           canonical.id,
    offer_name_sl:      canonical.title?.sl,
    offer_name_en:      canonical.title?.en,
    description_sl:     canonical.short_description?.sl,
    description_en:     canonical.short_description?.en,
    latitude:           canonical.meeting_point?.lat,
    longitude:          canonical.meeting_point?.lng,
    address:            canonical.meeting_point?.address,
    duration_min:       canonical.duration_minutes,
    price_from:         canonical.price_from,
    currency:           canonical.currency,
    booking_url:        canonical.booking_url,
    images:             (canonical.images || []).map(i => i.url),
    themes:             canonical.categories,
    provider:           canonical.provider_name,
    last_updated:       canonical.updated_at,
  };
}

/**
 * Dispatch to the right adapter.
 */
export function adaptListing(canonicalListing, format, fieldMapJson) {
  switch (format) {
    case 'jabook_json':  return toJabookJson(canonicalListing);
    case 'custom_json':  return applyFieldMap(canonicalListing, fieldMapJson);
    case 'canonical_json':
    default:             return canonicalListing;
  }
}