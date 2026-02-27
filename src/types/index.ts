import { Role, RequestStatus, LoadingStatus, DeliveryStatus, LocationType } from "@prisma/client";

export type { Role, RequestStatus, LoadingStatus, DeliveryStatus, LocationType };

export interface SessionUser {
  id: string;
  name: string;
  phone: string;
  role: Role;
}

export interface KPI {
  label: string;
  value: string | number;
  change?: string;
  icon: string;
  color: string;
}

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  roles: Role[];
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard", roles: ["ADMIN", "LM"] },
  { label: "Pickups", href: "/pickups", icon: "Package", roles: ["ADMIN", "LM", "CM"] },
  { label: "Deliveries", href: "/deliveries", icon: "Truck", roles: ["ADMIN", "LM"] },
  { label: "Users", href: "/admin/users", icon: "Users", roles: ["ADMIN"] },
  { label: "Centers", href: "/admin/centers", icon: "Building2", roles: ["ADMIN"] },
  { label: "Factories", href: "/admin/factories", icon: "Factory", roles: ["ADMIN"] },
  { label: "Mapping", href: "/admin/mapping", icon: "Link", roles: ["ADMIN"] },
  { label: "Activity Log", href: "/admin/activity", icon: "ScrollText", roles: ["ADMIN"] },
];
