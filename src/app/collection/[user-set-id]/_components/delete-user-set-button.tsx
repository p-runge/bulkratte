"use client";

import ConfirmButton from "@/components/confirm-button";
import { api } from "@/lib/api/react";
import { useIntl } from "react-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function DeleteUserSetButton({ userSetId }: { userSetId: string }) {
  const intl = useIntl();
  const router = useRouter();
  const utils = api.useUtils();
  const deleteUserSet = api.userSet.deleteById.useMutation({
    onMutate: async ({ id }) => {
      await utils.userSet.getList.cancel();
      const previous = utils.userSet.getList.getData();
      utils.userSet.getList.setData(undefined, (old) =>
        old?.filter((s) => s.id !== id),
      );
      router.push("/collection");
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous !== undefined) {
        utils.userSet.getList.setData(undefined, ctx.previous);
      }
      toast.error(
        intl.formatMessage({
          id: "page.set.action.delete.error",
          defaultMessage: "Failed to delete set.",
        }),
      );
    },
    onSettled: () => void utils.userSet.getList.invalidate(),
  });

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
        deleteUserSet.mutate({ id: userSetId });
      }}
      disabled={deleteUserSet.isPending}
    >
      {intl.formatMessage({
        id: "page.set.action.delete",
        defaultMessage: "Delete Set",
      })}
    </ConfirmButton>
  );
}
