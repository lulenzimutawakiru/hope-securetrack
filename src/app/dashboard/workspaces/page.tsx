"use client";

import Link from "next/link";
import {
  Crown,
  Landmark,
  Factory,
  Warehouse,
  Shield,
  Users,
  BarChart3,
  ShoppingCart,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ModuleTile } from "@/components/enterprise/module-tile";

const ROLES = [
  {
    title: "CEO / Executive",
    href: "/dashboard/workspaces/ceo",
    icon: Crown,
    description: "Strategic KPIs · AI signals · board packs",
    badge: "C-Level",
  },
  {
    title: "Finance",
    href: "/dashboard/workspaces/finance",
    icon: Landmark,
    description: "Cash · AR/AP · tax · journals",
    badge: "CFO",
  },
  {
    title: "Factory / Manufacturing",
    href: "/dashboard/workspaces/factory",
    icon: Factory,
    description: "Batches · QC · print · machines",
    badge: "Ops",
  },
  {
    title: "Warehouse",
    href: "/dashboard/workspaces/warehouse",
    icon: Warehouse,
    description: "Stock · GRN · transfers · valuation",
    badge: "WMS",
  },
  {
    title: "Sales & CRM",
    href: "/dashboard/workspaces/sales",
    icon: ShoppingCart,
    description: "Pipeline · orders · customers",
    badge: "Rev",
  },
  {
    title: "People (HR)",
    href: "/dashboard/workspaces/hr",
    icon: Users,
    description: "Headcount · leave · payroll",
    badge: "HCM",
  },
  {
    title: "Security & Compliance",
    href: "/dashboard/workspaces/security",
    icon: Shield,
    description: "Fraud · verification · IAM",
    badge: "Risk",
  },
  {
    title: "Analytics & BI",
    href: "/dashboard/reports",
    icon: BarChart3,
    description: "Dashboards · KPIs · AI assistant",
    badge: "BI",
  },
];

export default function WorkspacesIndexPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Role Workspaces"
        description="Persona dashboards for CEO · Finance · Factory · Warehouse · Sales · HR · Security"
        actions={
          <Link href="/dashboard" className="text-sm text-accent hover:underline">
            Main dashboard
          </Link>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {ROLES.map((r) => (
          <ModuleTile key={r.href} {...r} />
        ))}
      </div>
    </div>
  );
}
