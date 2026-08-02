import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/tenant/resolver";
import {
  getList,
  getById,
  createRecord,
  updateRecord,
  deleteRecord,
} from "@/lib/crud/crud-engine";

export async function GET(
  req: NextRequest,
  { params }: { params: { entity: string } }
) {
  const ctx = await resolveTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (id) {
    const { data, error } = await getById(ctx, params.entity, id);
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json(data);
  }

  const filters: Record<string, unknown> = {};
  searchParams.forEach((value, key) => {
    if (key !== "id") filters[key] = value;
  });

  const { data, error } = await getList(ctx, params.entity, filters);
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json(data);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { entity: string } }
) {
  const ctx = await resolveTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { data, error } = await createRecord(ctx, params.entity, body);
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { entity: string } }
) {
  const ctx = await resolveTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const body = await req.json();
  const { data, error } = await updateRecord(ctx, params.entity, id, body);
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json(data);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { entity: string } }
) {
  const ctx = await resolveTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { error } = await deleteRecord(ctx, params.entity, id);
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ success: true });
}
