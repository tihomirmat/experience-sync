import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const TenantContext = createContext(null);

export function TenantProvider({ children }) {
  const [currentTenant, setCurrentTenant] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTenantData();
  }, []);

  const loadTenantData = async () => {
    try {
      const user = await base44.auth.me();
      const roles = await base44.entities.UserTenantRole.filter({ user_id: user.id });
      
      if (roles.length > 0) {
        const tenantIds = [...new Set(roles.map(r => r.tenant_id))];
        const allTenants = await base44.entities.Tenant.list();
        const userTenants = allTenants.filter(t => tenantIds.includes(t.id));
        setTenants(userTenants);
        
        const savedTenantId = localStorage.getItem('currentTenantId');
        const activeTenant = userTenants.find(t => t.id === savedTenantId) || userTenants[0];
        
        if (activeTenant) {
          setCurrentTenant(activeTenant);
          const role = roles.find(r => r.tenant_id === activeTenant.id);
          setUserRole(role?.role || 'staff');
        }
      }
    } catch (e) {
      console.error('Failed to load tenant data:', e);
    } finally {
      setLoading(false);
    }
  };

  const switchTenant = (tenant) => {
    setCurrentTenant(tenant);
    localStorage.setItem('currentTenantId', tenant.id);
  };

  return (
    <TenantContext.Provider value={{ 
      currentTenant, tenants, userRole, loading, 
      switchTenant, refreshTenants: loadTenantData 
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}

export default TenantContext;