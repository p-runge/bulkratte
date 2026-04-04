import { UserSetContent } from "./_components/user-set-content";

export default async function UserSetPage({
  params,
}: {
  params: Promise<{ ["user-set-id"]: string }>;
}) {
  const { ["user-set-id"]: userSetId } = await params;

  if (!userSetId) return null;

  return <UserSetContent userSetId={userSetId} />;
}
