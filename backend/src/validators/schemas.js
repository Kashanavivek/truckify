'use strict';

const { z } = require('zod');

const id = z.coerce.number().int().positive();
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

// ------------------------------------------------------------------ auth
const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(72),
  role: z.enum(['customer', 'owner']).default('customer'),
  phone: z.string().trim().max(30).optional().nullable(),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

// ---------------------------------------------------------------- trucks
const truckBody = {
  name: z.string().trim().min(2).max(160),
  tagline: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(4000).optional().nullable(),
  cuisine: z.string().trim().min(2).max(80),
  price_range: z.enum(['$', '$$', '$$$']).default('$$'),
  base_city: z.string().trim().max(120).optional().nullable(),
  image_url: z.string().trim().max(600).optional().nullable(),
  gallery: z.array(z.string().trim().max(600)).max(8).optional(),
};

const createTruckSchema = z.object(truckBody);
const updateTruckSchema = z.object(truckBody).partial();

const menuItemSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(600).optional().nullable(),
  category: z.string().trim().max(60).default('Main'),
  price: z.coerce.number().min(0).max(100000),
  is_veg: z.coerce.boolean().default(false),
  is_available: z.coerce.boolean().default(true),
});

const packageSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1000).optional().nullable(),
  includes: z.array(z.string().trim().max(200)).max(20).optional(),
  price_per_event: z.coerce.number().min(0).max(10000000),
  min_guests: z.coerce.number().int().min(1).max(5000).default(20),
  max_guests: z.coerce.number().int().min(1).max(5000).default(300),
  is_active: z.coerce.boolean().default(true),
}).refine((v) => v.max_guests >= v.min_guests, {
  message: 'max_guests must be greater than or equal to min_guests',
  path: ['max_guests'],
});

// update flavour: no cross-field refine, so .partial() behaves predictably
const packageUpdateSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  includes: z.array(z.string().trim().max(200)).max(20).optional(),
  price_per_event: z.coerce.number().min(0).max(10000000).optional(),
  min_guests: z.coerce.number().int().min(1).max(5000).optional(),
  max_guests: z.coerce.number().int().min(1).max(5000).optional(),
  is_active: z.coerce.boolean().optional(),
});

const serviceAreaSchema = z.object({
  area_name: z.string().trim().min(2).max(120),
  radius_km: z.coerce.number().int().min(1).max(500).optional().nullable(),
});

// -------------------------------------------------------------- bookings
const createBookingSchema = z.object({
  truck_id: id,
  package_id: id,
  event_date: dateStr,
  event_type: z.string().trim().min(2).max(60).default('Private Party'),
  area_name: z.string().trim().min(2).max(120),
  venue_address: z.string().trim().max(400).optional().nullable(),
  guests: z.coerce.number().int().min(1).max(5000),
  notes: z.string().trim().max(1000).optional().nullable(),
});

const reasonSchema = z.object({
  reason: z.string().trim().max(500).optional().nullable(),
});

const ownerStatusSchema = z.object({
  status: z.enum(['en_route', 'arrived', 'completed']),
});

const paySchema = z.object({
  method: z.enum(['card', 'upi', 'netbanking', 'wallet']).default('card'),
  card_name: z.string().trim().max(80).optional().nullable(),
  card_last4: z.string().trim().regex(/^\d{0,4}$/).optional().nullable(),
});

const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional().nullable(),
});

// ----------------------------------------------------------------- admin
const rejectSchema = z.object({ reason: z.string().trim().min(3).max(500) });
const truckStatusSchema = z.object({ status: z.enum(['pending', 'active', 'rejected', 'inactive']) });
const userStatusSchema = z.object({ status: z.enum(['active', 'blocked']) });

module.exports = {
  registerSchema,
  loginSchema,
  createTruckSchema,
  updateTruckSchema,
  menuItemSchema,
  packageSchema,
  packageUpdateSchema,
  serviceAreaSchema,
  createBookingSchema,
  reasonSchema,
  ownerStatusSchema,
  paySchema,
  reviewSchema,
  rejectSchema,
  truckStatusSchema,
  userStatusSchema,
};
