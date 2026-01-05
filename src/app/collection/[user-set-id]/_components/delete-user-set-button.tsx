"use client";

import ConfirmButton from "@/components/confirm-button";
import { api } from "@/lib/api/react";
import { useIntl } from "react-intl";
import { useRouter } from "next/navigation";

export function DeleteUserSetButton({ userSetId }: { userSetId: string }) {
  const intl = useIntl();
  const router = useRouter();
  const utils = api.useUtils();
  const deleteUserSet = api.userSet.deleteById.useMutation({
    onSuccess: () => {
      utils.userSet.getList.invalidate();
      router.push("/collection");
    },
  });

  return (
    <ConfirmButton
      title={intl.formatMessage({
        id: "userSet.delete.confirmTitle",
        defaultMessage: "Delete Set",
      })}
      description={intl.formatMessage({
        id: "userSet.delete.confirmDescription",
        defaultMessage:
          "Are you sure you want to delete this set? This action cannot be undone.",
      })}
      destructive
      variant="destructive"
      onClick={() => {
        deleteUserSet.mutate({ id: userSetId });
      }}
      disabled={deleteUserSet.isPending}
    >
      {intl.formatMessage({
        id: "userSet.action.delete",
        defaultMessage: "Delete Set",
      })}
    </ConfirmButton>
  );
}
