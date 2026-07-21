import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getErrorMessage } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";

async function getManagedCategory(categoryId: string, profileId: string) {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) return { error: "Category not found", status: 404 } as const;

  if (!(await can(profileId, category.spaceId, "MANAGE_CHANNELS"))) {
    return { error: "Forbidden", status: 403 } as const;
  }

  return { category } as const;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const access = await getManagedCategory(id, user.id);
    if ("error" in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const body: unknown = await request.json();
    const name = typeof body === "object" && body !== null && "name" in body
      ? String(body.name).trim()
      : "";
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    const category = await prisma.category.update({
      where: { id },
      data: { name },
    });
    return NextResponse.json(category);
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const access = await getManagedCategory(id, user.id);
    if ("error" in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    await prisma.category.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
