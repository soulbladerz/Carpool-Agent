export type Role = "owner" | "agent" | "admin";

export type CarStatus = "available" | "flagged" | "rented" | "inactive";

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

export type Flag = {
  id: string;
  car_id: string;
  agent_id: string;
  status: "held" | "confirmed" | "released";
  expires_at: string;
  created_at: string;
};
