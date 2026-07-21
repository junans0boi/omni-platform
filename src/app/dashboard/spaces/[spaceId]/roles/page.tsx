import { RoleManager } from "@/components/RoleManager";

export default async function RolesPage({
  params,
}: {
  params: Promise<{ spaceId: string }>;
}) {
  const { spaceId } = await params;
  return <RoleManager spaceId={spaceId} />;
}
