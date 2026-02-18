/**
 * RBAC permission matrix
 * Roles: owner > admin > staff / accountant
 */

const PERMISSIONS = {
  // Tenant / Integrations
  'settings:write':       ['owner', 'admin'],
  'integrations:write':   ['owner', 'admin'],

  // Experiences
  'experiences:view':     ['owner', 'admin', 'staff', 'accountant'],
  'experiences:edit':     ['owner', 'admin', 'staff'],

  // Departures
  'departures:view':      ['owner', 'admin', 'staff', 'accountant'],

  // Bookings
  'bookings:view':        ['owner', 'admin', 'staff', 'accountant'],
  'bookings:edit':        ['owner', 'admin', 'staff'],

  // CRM
  'customers:view':       ['owner', 'admin', 'staff', 'accountant'],
  'customers:edit':       ['owner', 'admin', 'staff'],
  'companies:view':       ['owner', 'admin', 'staff', 'accountant'],
  'companies:edit':       ['owner', 'admin', 'staff', 'accountant'],

  // Invoices & Payments
  'invoices:view':        ['owner', 'admin', 'staff', 'accountant'],
  'invoices:create':      ['owner', 'admin', 'accountant'],
  'invoices:send':        ['owner', 'admin', 'accountant'],
  'invoices:void':        ['owner', 'admin', 'accountant'],
  'payments:mark_paid':   ['owner', 'admin', 'accountant'],
  'payments:refund':      ['owner', 'admin'],

  // Partners / DMO
  'partners:view':        ['owner', 'admin'],
  'partners:edit':        ['owner', 'admin'],

  // Monitoring
  'monitoring:view':      ['owner', 'admin', 'staff'],

  // Reports
  'reports:view':         ['owner', 'admin', 'staff', 'accountant'],
  'reports:vat_ledger':   ['owner', 'admin', 'accountant'],
};

/**
 * Check if a role has a permission.
 * @param {string} role - 'owner' | 'admin' | 'staff' | 'accountant'
 * @param {string} permission - e.g. 'invoices:create'
 * @returns {boolean}
 */
export function can(role, permission) {
  if (!role || !permission) return false;
  const allowed = PERMISSIONS[permission];
  if (!allowed) return false;
  return allowed.includes(role);
}

/**
 * React hook: returns a can() function bound to the current user role.
 * Usage: const { can } = usePermissions();  if (can('invoices:create')) ...
 */
import { useTenant } from './TenantContext';

export function usePermissions() {
  const { userRole } = useTenant();
  return {
    role: userRole,
    can: (permission) => can(userRole, permission),
  };
}