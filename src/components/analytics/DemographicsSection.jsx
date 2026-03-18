import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';

const DOMAIN_COUNTRY = {
  '.de': 'Nemčija 🇩🇪',
  '.at': 'Avstrija 🇦🇹',
  '.it': 'Italija 🇮🇹',
  '.hr': 'Hrvaška 🇭🇷',
  '.si': 'Slovenija 🇸🇮',
  '.fr': 'Francija 🇫🇷',
  '.gb': 'VB 🇬🇧',
  '.uk': 'VB 🇬🇧',
  '.nl': 'Nizozemska 🇳🇱',
  '.es': 'Španija 🇪🇸',
  '.ch': 'Švica 🇨🇭',
  '.pl': 'Poljska 🇵🇱',
  '.cz': 'Češka 🇨🇿',
  '.sk': 'Slovaška 🇸🇰',
  '.hu': 'Madžarska 🇭🇺',
};

const FREE_DOMAINS = ['gmail.com', 'googlemail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'live.com', 'aol.com', 'protonmail.com'];

function guessMarket(email) {
  if (!email) return 'Neznano';
  const lower = email.toLowerCase();
  const domain = lower.split('@')[1] || '';
  if (FREE_DOMAINS.includes(domain)) return 'Neznano (free email)';
  for (const [ext, country] of Object.entries(DOMAIN_COUNTRY)) {
    if (domain.endsWith(ext)) return country;
  }
  return 'Ostalo';
}

export default function DemographicsSection({ bookings, customers }) {
  // Market table from bookings
  const marketMap = {};
  const totalBookings = bookings.filter(b => b.status !== 'cancelled').length;
  const totalNet = bookings.filter(b => b.status !== 'cancelled').reduce((s, b) => s + (b.net_total || 0), 0);

  bookings.filter(b => b.status !== 'cancelled').forEach(b => {
    const market = guessMarket(b.customer_email);
    if (!marketMap[market]) marketMap[market] = { bookings: 0, net: 0 };
    marketMap[market].bookings += 1;
    marketMap[market].net += b.net_total || 0;
  });

  const markets = Object.entries(marketMap)
    .map(([name, d]) => ({
      name,
      ...d,
      share: totalBookings > 0 ? ((d.bookings / totalBookings) * 100).toFixed(1) : 0,
    }))
    .sort((a, b) => b.bookings - a.bookings);

  // Repeat guests
  const repeatGuests = customers.filter(c => (c.total_bookings || 0) > 1).length;
  const repeatPct = customers.length > 0 ? ((repeatGuests / customers.length) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Demografija gostov</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Market Table */}
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Top izvorna tržišča</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50/50">
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-400">Tržišče</th>
                  <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-400">Rezervacije</th>
                  <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-400">Prihodek</th>
                  <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-400">Delež %</th>
                </tr>
              </thead>
              <tbody>
                {markets.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-8 text-gray-400">Ni podatkov</td></tr>
                )}
                {markets.slice(0, 10).map((row, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium">{row.name}</td>
                    <td className="text-right px-4 py-3 text-gray-600">{row.bookings}</td>
                    <td className="text-right px-4 py-3 text-gray-600">€{row.net.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
                    <td className="text-right px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-gray-100 rounded-full h-1.5">
                          <div className="bg-[#1a5c38] h-1.5 rounded-full" style={{ width: `${row.share}%` }} />
                        </div>
                        <span className="text-gray-600 w-10 text-right">{row.share}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Repeat Guests Card */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center">
              <Users className="w-7 h-7 text-[#1a5c38]" />
            </div>
            <div>
              <p className="text-4xl font-bold text-gray-900">{repeatGuests}</p>
              <p className="text-sm font-medium text-gray-700 mt-1">Povratnih gostov</p>
              <p className="text-xs text-gray-400 mt-1">{repeatPct}% od vseh {customers.length} gostov</p>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="bg-[#1a5c38] h-2 rounded-full transition-all" style={{ width: `${repeatPct}%` }} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}