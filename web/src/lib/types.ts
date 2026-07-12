// Frontend-facing entity types — mirror the backend Prisma selects we consume.
// Kept local (not imported from backend) so the web build stays isolated.

export type Role = 'ADMIN' | 'FLEET_MANAGER' | 'DISPATCHER' | 'SAFETY_OFFICER' | 'FINANCIAL_ANALYST';
export const ALL_ROLES: Role[] = ['ADMIN', 'FLEET_MANAGER', 'DISPATCHER', 'SAFETY_OFFICER', 'FINANCIAL_ANALYST'];

export type VehicleType = 'TRUCK' | 'VAN' | 'PICKUP' | 'BIKE' | 'BUS';
export type FuelType = 'DIESEL' | 'PETROL' | 'CNG' | 'EV';
export type VehicleStatus = 'AVAILABLE' | 'ON_TRIP' | 'IN_SHOP' | 'RETIRED';
export type DriverStatus = 'AVAILABLE' | 'ON_TRIP' | 'OFF_DUTY' | 'SUSPENDED';
export type LicenseCategory = 'LMV' | 'HMV' | 'TRANS';
export type TripStatus = 'DRAFT' | 'DISPATCHED' | 'COMPLETED' | 'CANCELLED';
export type MaintenanceType = 'SERVICE' | 'REPAIR' | 'INSPECTION';
export type ExpenseType = 'TOLL' | 'PARKING' | 'FINE' | 'OTHER';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

export interface Vehicle {
  id: string;
  registrationNumber: string;
  name: string;
  model?: string | null;
  type: VehicleType;
  fuelType: FuelType;
  maxLoadCapacityKg: number;
  odometerKm: number;
  serviceIntervalKm: number;
  kmSinceLastServiceKm: number;
  acquisitionCost: number;
  region?: string | null;
  status: VehicleStatus;
  avgKmPerLiter: number | null;
}

export interface Driver {
  id: string;
  name: string;
  licenseNumber: string;
  licenseCategory: LicenseCategory;
  licenseExpiryDate: string;
  contactNumber?: string | null;
  safetyScore: number;
  status: DriverStatus;
}

export interface Trip {
  id: string;
  code: string;
  source: string;
  destination: string;
  vehicleId: string;
  driverId: string;
  cargoWeightKg: number;
  plannedDistanceKm: number;
  revenue: number;
  status: TripStatus;
  dispatchedAt?: string | null;
  completedAt?: string | null;
  startOdometerKm?: number | null;
  endOdometerKm?: number | null;
  actualDistanceKm?: number | null;
  fuelUsedL?: number | null;
  co2Kg?: number | null;
  vehicle?: Vehicle;
  driver?: Driver;
}

export interface MaintenanceLog {
  id: string;
  vehicleId: string;
  type: MaintenanceType;
  description: string;
  cost: number;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt?: string | null;
}

export interface FuelLog {
  id: string;
  vehicleId: string;
  tripId?: string | null;
  liters: number;
  cost: number;
  date: string;
  expectedLiters?: number | null;
  deviationPct?: number | null;
  isAnomaly: boolean;
  anomalyReviewed: boolean;
  reviewNote?: string | null;
  vehicle?: { registrationNumber: string; name: string; fuelType?: FuelType };
}

export interface Expense {
  id: string;
  vehicleId: string;
  tripId?: string | null;
  type: ExpenseType;
  amount: number;
  date: string;
  notes?: string | null;
  vehicle?: { registrationNumber: string; name: string };
}

export interface EmissionFactor {
  id: string;
  fuelType: FuelType;
  kgCo2PerLiter: number;
  source: string;
}

export interface NotificationItem {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface AuditLogItem {
  id: string;
  actorId: string;
  action: string;
  entity: string;
  entityId: string;
  payload: unknown;
  timestamp: string;
  actor?: { name: string; email: string; role: Role | null };
}

export interface RecommendationCandidate {
  vehicle: Vehicle;
  driver: Driver;
  score: number;
  breakdown: {
    capacityFit: number;
    fuelEfficiency: number;
    maintenanceHeadroom: number;
    driverSafety: number;
  };
  serviceDueWithinDistance: boolean;
}

export interface RecommendationResult {
  weights: { capacity: number; fuel: number; maintenance: number; safety: number };
  recommendations: RecommendationCandidate[];
}

export interface AppSettings {
  anomalyDeviationThreshold: number;
  anomalyMinHistory: number;
  licenseWarningDays: number[];
  dispatchWeightCapacity: number;
  dispatchWeightFuel: number;
  dispatchWeightMaintenance: number;
  dispatchWeightSafety: number;
  defaultServiceIntervalKm: number;
  simulateDayEnabled: boolean;
}

export interface Paginated<T> {
  success: true;
  data: T[];
  meta: { page: number; limit: number; total: number };
}

export interface Wrapped<T> {
  success: true;
  data: T;
  meta?: { page: number; limit: number; total: number };
}
