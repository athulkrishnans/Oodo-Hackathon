// src/shared/zodSchemas.ts
// Single source of truth for all Zod validation schemas.
// Imported by both Express routes AND frontend forms — never hand-roll a second copy.
// Each module's schemas are added here as features are implemented in H1+.

import { z } from 'zod';

// ── Auth ──────────────────────────────────────
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

// ── Vehicle ───────────────────────────────────
// Section 5.1 (Vehicle model) + Section 6 (ON_TRIP is system-only) + Section 7 rule 1.
// Shared FE/BE — imported by the Express route AND the web create/edit form.

export const vehicleTypeEnum = z.enum(['TRUCK', 'VAN', 'PICKUP', 'BIKE', 'BUS']);
export const fuelTypeEnum = z.enum(['DIESEL', 'PETROL', 'CNG', 'EV']);
export const vehicleStatusEnum = z.enum(['AVAILABLE', 'ON_TRIP', 'IN_SHOP', 'RETIRED']);

// Create: all required/positive-number fields validated up front.
// status is intentionally NOT accepted — new vehicles are always AVAILABLE (Section 6).
export const createVehicleSchema = z.object({
  registrationNumber: z.string().trim().min(1, 'Registration number is required'),
  name: z.string().trim().min(1, 'Name is required'),
  model: z.string().trim().min(1).optional(),
  type: vehicleTypeEnum,
  fuelType: fuelTypeEnum,
  maxLoadCapacityKg: z.number().positive('Max load capacity must be greater than 0'),
  odometerKm: z.number().nonnegative('Odometer cannot be negative').optional(),
  serviceIntervalKm: z.number().int().positive().optional(),
  acquisitionCost: z.number().positive('Acquisition cost must be greater than 0'),
  region: z.string().trim().min(1).optional(),
});

// Update: partial. status may be changed manually EXCEPT to ON_TRIP.
// Section 6: ON_TRIP is a system-only transition — rejected here in the Zod schema,
// not only in the service layer. odometerKm is omitted (monotonic, system-managed).
export const updateVehicleSchema = z
  .object({
    registrationNumber: z.string().trim().min(1).optional(),
    name: z.string().trim().min(1).optional(),
    model: z.string().trim().min(1).optional(),
    type: vehicleTypeEnum.optional(),
    fuelType: fuelTypeEnum.optional(),
    maxLoadCapacityKg: z.number().positive().optional(),
    serviceIntervalKm: z.number().int().positive().optional(),
    acquisitionCost: z.number().positive().optional(),
    region: z.string().trim().min(1).optional(),
    status: vehicleStatusEnum.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status === 'ON_TRIP') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['status'],
        message: 'ON_TRIP is a system-only status and cannot be set through the vehicle API',
      });
    }
    if (Object.values(data).every((v) => v === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one field must be provided to update',
      });
    }
  });

// List filters (Section 12): paginated + filterable by type/status/region.
export const listVehiclesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  type: vehicleTypeEnum.optional(),
  status: vehicleStatusEnum.optional(),
  region: z.string().trim().min(1).optional(),
});

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
export type ListVehiclesQuery = z.infer<typeof listVehiclesQuerySchema>;

// ── Common ───────────────────────────────────
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

// ── Driver ───────────────────────────────────
// Section 5.1 Driver + Section 6 (SUSPENDED/OFF_DUTY manual; ON_TRIP system-only).
export const licenseCategoryEnum = z.enum(['LMV', 'HMV', 'TRANS']);
export const driverStatusEnum = z.enum(['AVAILABLE', 'ON_TRIP', 'OFF_DUTY', 'SUSPENDED']);

export const createDriverSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  licenseNumber: z.string().trim().min(1, 'License number is required'),
  licenseCategory: licenseCategoryEnum,
  licenseExpiryDate: z.coerce.date(),
  contactNumber: z.string().trim().min(1).optional(),
  safetyScore: z.number().int().min(0).max(100).optional(),
});

// status may be changed manually EXCEPT to ON_TRIP (Section 6 — system-only).
export const updateDriverSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    licenseNumber: z.string().trim().min(1).optional(),
    licenseCategory: licenseCategoryEnum.optional(),
    licenseExpiryDate: z.coerce.date().optional(),
    contactNumber: z.string().trim().min(1).optional(),
    safetyScore: z.number().int().min(0).max(100).optional(),
    status: driverStatusEnum.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status === 'ON_TRIP') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['status'],
        message: 'ON_TRIP is a system-only status and cannot be set through the driver API',
      });
    }
    if (Object.values(data).every((v) => v === undefined)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'At least one field must be provided to update' });
    }
  });

export const listDriversQuerySchema = paginationQuerySchema.extend({
  status: driverStatusEnum.optional(),
  licenseCategory: licenseCategoryEnum.optional(),
});

export type CreateDriverInput = z.infer<typeof createDriverSchema>;
export type UpdateDriverInput = z.infer<typeof updateDriverSchema>;
export type ListDriversQuery = z.infer<typeof listDriversQuerySchema>;

// ── Trip ─────────────────────────────────────
// Section 5.2 Trip + Section 7 rules (validated in service; shapes here).
export const createTripSchema = z.object({
  source: z.string().trim().min(1, 'Source is required'),
  destination: z.string().trim().min(1, 'Destination is required'),
  vehicleId: z.string().trim().min(1),
  driverId: z.string().trim().min(1),
  cargoWeightKg: z.number().positive('Cargo weight must be greater than 0'),
  plannedDistanceKm: z.number().positive('Planned distance must be greater than 0'),
  revenue: z.number().nonnegative().optional(),
});

// Dispatch takes the trip id from the route param; body is empty.
// Idempotency-Key comes from the header (see idempotency middleware).
export const dispatchTripSchema = z.object({}).optional();

// Completion (Section 16): endOdometer must be > start (checked in service against stored start).
export const completeTripSchema = z.object({
  endOdometerKm: z.number().positive('End odometer must be greater than 0'),
  fuelUsedL: z.number().nonnegative('Fuel used cannot be negative').optional(),
});

export const listTripsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['DRAFT', 'DISPATCHED', 'COMPLETED', 'CANCELLED']).optional(),
  vehicleId: z.string().trim().min(1).optional(),
  driverId: z.string().trim().min(1).optional(),
});

export const recommendationQuerySchema = z.object({
  cargoWeightKg: z.coerce.number().positive(),
  plannedDistanceKm: z.coerce.number().positive(),
});

export type CreateTripInput = z.infer<typeof createTripSchema>;
export type CompleteTripInput = z.infer<typeof completeTripSchema>;
export type ListTripsQuery = z.infer<typeof listTripsQuerySchema>;
export type RecommendationQuery = z.infer<typeof recommendationQuerySchema>;

// ── Maintenance ───────────────────────────────
// Section 5.2 MaintenanceLog + Section 7 rules 9/10.
export const maintenanceTypeEnum = z.enum(['SERVICE', 'REPAIR', 'INSPECTION']);

export const createMaintenanceSchema = z.object({
  vehicleId: z.string().trim().min(1),
  type: maintenanceTypeEnum,
  description: z.string().trim().min(1, 'Description is required'),
  cost: z.number().nonnegative().optional(),
});

export const closeMaintenanceSchema = z.object({
  cost: z.number().nonnegative().optional(),
});

export const listMaintenanceQuerySchema = paginationQuerySchema.extend({
  vehicleId: z.string().trim().min(1).optional(),
  status: z.enum(['OPEN', 'CLOSED']).optional(),
});

export type CreateMaintenanceInput = z.infer<typeof createMaintenanceSchema>;
export type CloseMaintenanceInput = z.infer<typeof closeMaintenanceSchema>;
export type ListMaintenanceQuery = z.infer<typeof listMaintenanceQuerySchema>;

// ── Fuel / Expense ────────────────────────────
// Section 5.2 FuelLog + Section 9 anomaly; EV fuel logs blocked in service.
export const createFuelLogSchema = z.object({
  vehicleId: z.string().trim().min(1),
  tripId: z.string().trim().min(1).optional(),
  liters: z.number().positive('Liters must be greater than 0'),
  cost: z.number().nonnegative('Cost cannot be negative'),
  date: z.coerce.date().optional(),
});

export const reviewFuelLogSchema = z.object({
  reviewNote: z.string().trim().min(1, 'A review note is required'),
});

export const listFuelLogsQuerySchema = paginationQuerySchema.extend({
  vehicleId: z.string().trim().min(1).optional(),
  isAnomaly: z.coerce.boolean().optional(),
});
export type ListFuelLogsQuery = z.infer<typeof listFuelLogsQuerySchema>;

export const expenseTypeEnum = z.enum(['TOLL', 'PARKING', 'FINE', 'OTHER']);

export const createExpenseSchema = z.object({
  vehicleId: z.string().trim().min(1),
  tripId: z.string().trim().min(1).optional(),
  type: expenseTypeEnum,
  amount: z.number().positive('Amount must be greater than 0'),
  date: z.coerce.date().optional(),
  notes: z.string().trim().min(1).optional(),
});

export const listExpensesQuerySchema = paginationQuerySchema.extend({
  vehicleId: z.string().trim().min(1).optional(),
  type: expenseTypeEnum.optional(),
});
export type ListExpensesQuery = z.infer<typeof listExpensesQuerySchema>;

// ── Reports (Section 13) ──────────────────────
// Shared filter for all report + CSV-export endpoints.
export const reportFilterSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  vehicleId: z.string().trim().min(1).optional(),
  region: z.string().trim().min(1).optional(),
  type: vehicleTypeEnum.optional(),
});
export type ReportFilter = z.infer<typeof reportFilterSchema>;

export const reportNameEnum = z.enum([
  'fuel-efficiency',
  'utilization',
  'operational-cost',
  'roi',
  'carbon',
]);
export type ReportName = z.infer<typeof reportNameEnum>;

export const setRevenueSchema = z.object({
  revenue: z.number().nonnegative(),
});

export type CreateFuelLogInput = z.infer<typeof createFuelLogSchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

// ── Admin: role assignment ────────────────────
export const roleEnum = z.enum(['ADMIN', 'FLEET_MANAGER', 'DISPATCHER', 'SAFETY_OFFICER', 'FINANCIAL_ANALYST']);
export const assignRoleSchema = z.object({
  role: roleEnum,
});

export const updateUserStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE']),
});

// ── Emission factors (Section 10) ─────────────
export const updateEmissionFactorSchema = z.object({
  kgCo2PerLiter: z.number().nonnegative(),
  source: z.string().trim().min(1).optional(),
});

// ── Notifications (Section 11) ────────────────
export const listNotificationsQuerySchema = paginationQuerySchema.extend({
  unreadOnly: z.coerce.boolean().optional(),
});
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;

// ── Audit log viewer (Section 14 #8) ──────────
export const listAuditLogsQuerySchema = paginationQuerySchema.extend({
  entity: z.string().trim().min(1).optional(),
  actorId: z.string().trim().min(1).optional(),
});
export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;

// ── Settings ──────────────────────────────────
export const updateSettingsSchema = z.object({
  anomalyDeviationThreshold: z.number().min(0).max(1).optional(),
  anomalyMinHistory: z.number().int().min(1).optional(),
  licenseWarningDays: z.array(z.number().int().positive()).optional(),
  dispatchWeightCapacity: z.number().int().optional(),
  dispatchWeightFuel: z.number().int().optional(),
  dispatchWeightMaintenance: z.number().int().optional(),
  dispatchWeightSafety: z.number().int().optional(),
  defaultServiceIntervalKm: z.number().int().positive().optional(),
  simulateDayEnabled: z.boolean().optional(),
}).refine(
  (data) => {
    const weights = [
      data.dispatchWeightCapacity,
      data.dispatchWeightFuel,
      data.dispatchWeightMaintenance,
      data.dispatchWeightSafety,
    ];
    if (weights.some((w) => w !== undefined)) {
      const defined = weights.filter((w) => w !== undefined) as number[];
      if (defined.length === 4) {
        return defined.reduce((a, b) => a + b, 0) === 100;
      }
    }
    return true;
  },
  { message: 'Dispatch weights must sum to 100 when all four are provided' },
);
