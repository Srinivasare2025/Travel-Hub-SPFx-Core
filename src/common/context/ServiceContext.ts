import * as React from 'react';
import { IServiceRegistry } from '../../services/IServiceRegistry';

/**
 * Carries the service registry + resolved configuration down the tree. Provided
 * once by `TravelHub.tsx`; consumed via `useServices()`.
 */
export const ServiceContext = React.createContext<IServiceRegistry | undefined>(undefined);

export function useServices(): IServiceRegistry {
  const registry = React.useContext(ServiceContext);
  if (registry === undefined) {
    throw new Error('useServices() must be used within <ServiceContext.Provider>. Check TravelHub.tsx.');
  }
  return registry;
}
