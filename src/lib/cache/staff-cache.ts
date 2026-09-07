interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface StaffData {
  staff: any[];
  roles: any[];
}

interface RolesData {
  roles: any[];
  modules: any[];
}

const cache: {
  staff?: CacheEntry<StaffData>;
  roles?: CacheEntry<RolesData>;
} = {};

// 30 minutes default TTL
const DEFAULT_TTL_MS = 30 * 60 * 1000;

export const staffCache = {
  getStaff: (ttlMs = DEFAULT_TTL_MS): StaffData | null => {
    if (!cache.staff) return null;
    if (Date.now() - cache.staff.timestamp > ttlMs) {
      delete cache.staff;
      return null;
    }
    return cache.staff.data;
  },
  setStaff: (data: StaffData) => {
    cache.staff = { data, timestamp: Date.now() };
  },
  invalidateStaff: () => {
    delete cache.staff;
  },

  getRoles: (ttlMs = DEFAULT_TTL_MS): RolesData | null => {
    if (!cache.roles) return null;
    if (Date.now() - cache.roles.timestamp > ttlMs) {
      delete cache.roles;
      return null;
    }
    return cache.roles.data;
  },
  setRoles: (data: RolesData) => {
    cache.roles = { data, timestamp: Date.now() };
  },
  invalidateRoles: () => {
    delete cache.roles;
  },

  invalidateAll: () => {
    delete cache.staff;
    delete cache.roles;
  }
};

