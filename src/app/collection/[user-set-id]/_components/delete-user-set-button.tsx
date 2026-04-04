"use client";

import ConfirmButton from "@/components/confirm-button";
import { useCollectionActions } from "@/lib/collection/use-collection-actions";
import { useIntl } from "react-intl";
import { useRouter } from "next/navigation";

export function DeleteUserSetButton({ userSetId }: { userSetId: string }) {
  const intl = useIntl();
  const router = useRouter();
  const { set } = useCollectionActions();

  return (
    <ConfirmButton
      title={intl.formatMessage({
        id: "dialog.delete_set.title",
        defaultMessage: "Delete Set",
      })}
      description={intl.formatMessage({
        id: "dialog.delete_set.description",
        defaultMessage:
          "Are you sure you want to delete this set? This action cannot be undone.",
      })}
      destructive
      variant="destructive"
      onClick={() => {
        router.push("/collection");
        set.delete(userSetId);
      }}
      disabled={set.isDeleting}
    >
      {intl.formatMessage({
        id: "page.set.action.delete",
        defaultMessage: "Delete Set",
      })}
    </ConfirmButton>
  );
}
