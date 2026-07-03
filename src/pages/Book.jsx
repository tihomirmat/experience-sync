/**
 * Book — public booking page (no login required)
 * URL: /Book?exp=<booking_slug>&lang=sl|en
 *
 * Reads availability and creates bookings exclusively through public backend
 * functions (getPublicAvailability, createPublicBooking) — it never touches
 * entities directly, so it works for anonymous visitors.
 *
 * NOTE: the app must allow public access to this page in Base44 settings
 * (App settings → access), otherwise anonymous visitors are redirected to login.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar, Clock, MapPin, Users, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

const STRINGS = {
  sl: {
    pickDate: 'Izberite termin',
    noDates: 'Trenutno ni prostih terminov. Poskusite kasneje ali nas kontaktirajte.',
    free: 'prosto',
    persons: 'Število oseb',
    adults: 'Odrasli',
    children: 'Otroci',
    yourData: 'Vaši podatki',
    name: 'Ime in priimek',
    email: 'E-pošta',
    phone: 'Telefon (neobvezno)',
    notes: 'Sporočilo / posebne želje (neobvezno)',
    gdpr: 'Strinjam se, da se moji podatki uporabijo za obdelavo te rezervacije.',
    submit: 'Pošlji rezervacijo',
    sending: 'Pošiljam…',
    duration: 'Trajanje',
    meetingPoint: 'Zbirno mesto',
    from: 'od',
    perPerson: '/os.',
    successTitle: 'Rezervacija prejeta!',
    successBody: 'Vaša rezervacija je bila uspešno oddana in čaka na potrditev. Potrditev boste prejeli po e-pošti.',
    paidTitle: 'Plačilo uspešno!',
    paidBody: 'Vaše predplačilo je bilo prejeto in rezervacija je potrjena. Potrditev boste prejeli po e-pošti.',
    cancelledTitle: 'Plačilo ni bilo dokončano',
    cancelledBody: 'Vaša rezervacija je oddana in čaka na potrditev, vendar plačilo ni bilo dokončano. Kontaktirali vas bomo glede plačila.',
    reference: 'Referenčna številka',
    another: 'Nova rezervacija',
    notFound: 'Doživetje ni bilo najdeno ali ni več na voljo.',
    required: 'Izpolnite ime, e-pošto, termin in soglasje.',
    min: 'min',
    total: 'Skupaj (ocena)',
    includes: 'Vključeno',
  },
  en: {
    pickDate: 'Pick a date',
    noDates: 'No available dates at the moment. Please check back later or contact us.',
    free: 'available',
    persons: 'Number of guests',
    adults: 'Adults',
    children: 'Children',
    yourData: 'Your details',
    name: 'Full name',
    email: 'E-mail',
    phone: 'Phone (optional)',
    notes: 'Message / special requests (optional)',
    gdpr: 'I agree that my data is used to process this booking.',
    submit: 'Send booking request',
    sending: 'Sending…',
    duration: 'Duration',
    meetingPoint: 'Meeting point',
    from: 'from',
    perPerson: '/pp',
    successTitle: 'Booking received!',
    successBody: 'Your booking request has been submitted and is awaiting confirmation. You will receive a confirmation by e-mail.',
    paidTitle: 'Payment successful!',
    paidBody: 'Your deposit has been received and the booking is confirmed. You will receive a confirmation by e-mail.',
    cancelledTitle: 'Payment not completed',
    cancelledBody: 'Your booking request has been submitted and is awaiting confirmation, but the payment was not completed. We will contact you about the payment.',
    reference: 'Reference number',
    another: 'New booking',
    notFound: 'Experience not found or no longer available.',
    required: 'Please fill in name, e-mail, a date and consent.',
    min: 'min',
    total: 'Total (estimate)',
    includes: 'Included',
  },
};

function fmtDate(iso, lang) {
  try {
    return new Date(iso).toLocaleDateString(lang === 'sl' ? 'sl-SI' : 'en-GB', {
      weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch { return iso; }
}
function fmtTime(iso) {
  try { return new Date(iso).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
}

export default function Book() {
  const [searchParams, setSearchParams] = useSearchParams();
  const slug = searchParams.get('exp') || '';
  const lang = searchParams.get('lang') === 'en' ? 'en' : 'sl';
  const t = STRINGS[lang];

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [experience, setExperience] = useState(null);
  const [departures, setDepartures] = useState([]);

  const [selectedDep, setSelectedDep] = useState(null);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [form, setForm] = useState({ name: '', email: '', phone: '', notes: '', gdpr: false, website: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (!slug) { setLoading(false); setError('missing_slug'); return; }
    (async () => {
      try {
        setLoading(true);
        const { data } = await base44.functions.invoke('getPublicAvailability', { slug });
        if (data?.error) { setError(data.error); return; }
        setExperience(data.experience);
        setDepartures(data.departures || []);
      } catch (e) {
        setError(e.message || 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const L = (field) => experience?.[`${field}_${lang}`] || experience?.[`${field}_sl`] || experience?.[`${field}_en`] || '';

  const totalPax = adults + children;
  const price = selectedDep?.price ?? experience?.base_price_from ?? null;
  const estimate = useMemo(() => (price != null ? Math.round(price * totalPax * 100) / 100 : null), [price, totalPax]);

  const canSubmit = selectedDep && form.name.trim() && /\S+@\S+\.\S+/.test(form.email) && form.gdpr && totalPax >= 1 && !submitting;

  const submit = async () => {
    if (!canSubmit) { setSubmitError(t.required); return; }
    setSubmitting(true);
    setSubmitError('');
    try {
      const { data } = await base44.functions.invoke('createPublicBooking', {
        slug,
        departure_id: selectedDep.id,
        adults,
        children,
        name: form.name,
        email: form.email,
        phone: form.phone,
        notes: form.notes,
        language: lang,
        gdpr_consent: form.gdpr === true,
        website: form.website, // honeypot
      });
      if (data?.error) { setSubmitError(data.error); return; }
      if (data?.checkout_url) {
        // Redirect to Stripe Checkout for the deposit payment
        window.location.href = data.checkout_url;
        return;
      }
      setSuccess(data);
    } catch (e) {
      setSubmitError(e.message || 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  const switchLang = (l) => {
    const next = new URLSearchParams(searchParams);
    next.set('lang', l);
    setSearchParams(next, { replace: true });
  };

  // Return from Stripe Checkout
  const paidReturn = searchParams.get('paid') === '1';
  const cancelledReturn = searchParams.get('cancelled') === '1';
  const returnRef = searchParams.get('ref') || '';
  if (paidReturn || cancelledReturn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-stone-100 p-8 text-center">
          {paidReturn
            ? <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
            : <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />}
          <h1 className="text-xl font-semibold text-stone-900 mb-2">{paidReturn ? t.paidTitle : t.cancelledTitle}</h1>
          <p className="text-sm text-stone-600 mb-4">{paidReturn ? t.paidBody : t.cancelledBody}</p>
          {returnRef && (
            <>
              <p className="text-xs text-stone-400 uppercase tracking-wide">{t.reference}</p>
              <p className="font-mono text-lg font-semibold text-stone-800">{returnRef}</p>
            </>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="w-8 h-8 animate-spin text-stone-400" />
      </div>
    );
  }

  if (error || !experience) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-6">
        <div className="max-w-md text-center">
          <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <p className="text-stone-600">{t.notFound}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-stone-100 p-8 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-stone-900 mb-2">{t.successTitle}</h1>
          <p className="text-sm text-stone-600 mb-4">{t.successBody}</p>
          <p className="text-xs text-stone-400 uppercase tracking-wide">{t.reference}</p>
          <p className="font-mono text-lg font-semibold text-stone-800 mb-6">{success.booking_reference}</p>
          <Button variant="outline" onClick={() => { setSuccess(null); setSelectedDep(null); }}>{t.another}</Button>
        </div>
      </div>
    );
  }

  const heroImage = experience.images?.[0]?.url;

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <div className="bg-white border-b border-stone-100">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-stone-900 truncate pr-4">{L('title')}</h1>
          <div className="flex gap-1 text-xs shrink-0">
            <button onClick={() => switchLang('sl')} className={`px-2 py-1 rounded ${lang === 'sl' ? 'bg-stone-900 text-white' : 'text-stone-500 hover:bg-stone-100'}`}>SL</button>
            <button onClick={() => switchLang('en')} className={`px-2 py-1 rounded ${lang === 'en' ? 'bg-stone-900 text-white' : 'text-stone-500 hover:bg-stone-100'}`}>EN</button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Hero + info */}
        {heroImage && (
          <img src={heroImage} alt={experience.images?.[0]?.alt || L('title')} className="w-full h-56 object-cover rounded-2xl" />
        )}
        <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6 space-y-3">
          {L('short_description') && <p className="text-stone-700">{L('short_description')}</p>}
          <div className="flex flex-wrap gap-4 text-sm text-stone-500">
            {experience.duration_minutes && (
              <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" />{t.duration}: {experience.duration_minutes} {t.min}</span>
            )}
            {experience.meeting_point_name && (
              <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" />{experience.meeting_point_name}</span>
            )}
            {experience.base_price_from != null && (
              <span className="flex items-center gap-1.5 font-medium text-stone-700">{t.from} {experience.base_price_from.toFixed(2)} € {t.perPerson}</span>
            )}
          </div>
          {L('includes') && (
            <p className="text-sm text-stone-500"><span className="font-medium text-stone-600">{t.includes}:</span> {L('includes')}</p>
          )}
        </div>

        {/* Step 1: date */}
        <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6">
          <h2 className="font-semibold text-stone-900 mb-4 flex items-center gap-2"><Calendar className="w-4 h-4" /> {t.pickDate}</h2>
          {departures.length === 0 ? (
            <p className="text-sm text-stone-500">{t.noDates}</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
              {departures.map(d => (
                <button
                  key={d.id}
                  onClick={() => setSelectedDep(d)}
                  className={`text-left px-4 py-3 rounded-xl border transition-colors ${selectedDep?.id === d.id ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 hover:border-stone-400 bg-white text-stone-800'}`}
                >
                  <p className="text-sm font-medium">{fmtDate(d.start_at, lang)}</p>
                  <p className={`text-xs mt-0.5 ${selectedDep?.id === d.id ? 'text-stone-300' : 'text-stone-500'}`}>
                    {fmtTime(d.start_at)} · {d.capacity_remaining} {t.free}{d.price != null ? ` · ${d.price.toFixed(2)} € ${t.perPerson}` : ''}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Step 2: pax + details */}
        {selectedDep && (
          <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6 space-y-5">
            <h2 className="font-semibold text-stone-900 flex items-center gap-2"><Users className="w-4 h-4" /> {t.persons}</h2>
            <div className="grid grid-cols-2 gap-4 max-w-xs">
              <div className="space-y-1.5">
                <Label>{t.adults}</Label>
                <Input type="number" min={0} max={selectedDep.capacity_remaining} value={adults}
                  onChange={e => setAdults(Math.max(parseInt(e.target.value) || 0, 0))} />
              </div>
              <div className="space-y-1.5">
                <Label>{t.children}</Label>
                <Input type="number" min={0} value={children}
                  onChange={e => setChildren(Math.max(parseInt(e.target.value) || 0, 0))} />
              </div>
            </div>
            {estimate != null && totalPax > 0 && (
              <p className="text-sm text-stone-600">{t.total}: <span className="font-semibold">{estimate.toFixed(2)} €</span></p>
            )}

            <h2 className="font-semibold text-stone-900 pt-2">{t.yourData}</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t.name} *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t.email} *</Label>
                <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>{t.phone}</Label>
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>{t.notes}</Label>
                <Textarea rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>
              {/* Honeypot — hidden from humans */}
              <input
                type="text"
                value={form.website}
                onChange={e => setForm({ ...form, website: e.target.value })}
                autoComplete="off"
                tabIndex={-1}
                aria-hidden="true"
                style={{ position: 'absolute', left: '-9999px', height: 0, width: 0, opacity: 0 }}
              />
            </div>
            <label className="flex items-start gap-2.5 text-sm text-stone-600 cursor-pointer">
              <Checkbox checked={form.gdpr} onCheckedChange={v => setForm({ ...form, gdpr: v === true })} className="mt-0.5" />
              <span>{t.gdpr} *</span>
            </label>

            {submitError && (
              <p className="text-sm text-red-600 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> {submitError}</p>
            )}

            <Button className="w-full sm:w-auto" size="lg" disabled={!canSubmit} onClick={submit}>
              {submitting ? t.sending : t.submit}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
