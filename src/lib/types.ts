export type Role = "member" | "admin";

export type CarStatus = "available" | "rented" | "inactive";

export type RequestStatus = "open" | "matched" | "fulfilled" | "cancelled" | "expired";
export type OfferStatus = "pending" | "accepted" | "rejected" | "withdrawn" | "expired";
export type BookingStatus =
  | "pending_owner_confirmation"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  phone: string | null;
  is_verified: boolean;
  created_at: string;
};

export type Car = {
  id: string;
  owner_id: string;
  make: string;
  model: string;
  year: number | null;
  car_type: string;
  plate: string | null;
  daily_rate: number;
  deposit: number;
  status: CarStatus;
  notes: string | null;
  created_at: string;
};

export type ServiceArea = { id: string; car_id: string; area: string };

export type RentalRequest = {
  id: string;
  requester_id: string;
  car_id: string | null;
  car_type: string | null;
  pickup_area: string;
  start_at: string;
  end_at: string;
  passenger_count: number;
  max_daily_rate: number | null;
  notes: string | null;
  status: RequestStatus;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

export type RequestPrivate = {
  request_id: string;
  customer_name: string;
  customer_phone: string;
  customer_notes: string | null;
};

export type Offer = {
  id: string;
  request_id: string;
  car_id: string;
  offerer_id: string;
  daily_rate: number;
  deposit: number;
  notes: string | null;
  status: OfferStatus;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

export type Booking = {
  id: string;
  request_id: string;
  offer_id: string;
  car_id: string;
  owner_id: string;
  booker_id: string;
  pickup_area: string;
  passenger_count: number;
  daily_rate: number;
  deposit: number;
  start_at: string;
  end_at: string;
  status: BookingStatus;
  confirmed_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
};
