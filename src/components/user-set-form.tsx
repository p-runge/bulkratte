"use client";

import { CardBrowser } from "@/components/card-browser";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api/react";
import { AppRouter } from "@/lib/api/routers/_app";
import { RHFForm, useRHFForm } from "@/lib/form/utils";
import { Plus, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { Controller } from "react-hook-form";
import { FormattedMessage, useIntl } from "react-intl";
import z from "zod";

type UserSet = Awaited<ReturnType<AppRouter["userSet"]["getById"]>>

type Props = {
  mode: "create" | "edit";
  userSet?: UserSet;
}

export default function UserSetForm({ mode, userSet }: Props) {
  const router = useRouter();
  const intl = useIntl();

  const apiUtils = api.useUtils();
  const { mutateAsync: updateUserSet } = api.userSet.update.useMutation();
  const { mutateAsync: createUserSet } = api.userSet.create.useMutation();

  const form = useRHFForm(FormSchema, {
    defaultValues: {
      name: userSet?.set.name ?? "",
      cardIds: userSet?.cards.map((card) => card.cardId) ?? [],
    }
  });

  const handleCardToggle = (cardId: string) => {
    const currentCardIds = form.getValues("cardIds");
    const cardSet = new Set(currentCardIds);

    if (cardSet.has(cardId)) {
      cardSet.delete(cardId);
    } else {
      cardSet.add(cardId);
    }

    form.setValue("cardIds", Array.from(cardSet), { shouldDirty: true });
  };

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    if (mode === "create") {
      await createUserSet(
        {
          name: data.name,
          cardIds: new Set(data.cardIds),
        },
        {
          onSuccess() {
            router.push("/collection");
          },
          onError(error) {
            console.error("Error creating user set:", error);
          },
        }
      );
    } else {
      await updateUserSet(
        {
          id: userSet!.set.id,
          name: data.name,
          cardIds: new Set(data.cardIds),
        },
        {
          async onSuccess() {
            await apiUtils.userSet.getById.invalidate({ id: userSet!.set.id });
            router.push("/collection");
          },
          onError(error) {
            console.error("Error updating user set:", error);
          },
        }
      );
    }
  };

  return (
    <>
      <Card className="p-6 mb-6">
        <div>
          <RHFForm form={form} onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-4 sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="user-set-name">
                {intl.formatMessage({
                  id: "userSet.nameLabel",
                  defaultMessage: "Set Name",
                })}
              </Label>
              <Input
                {...form.register("name")}
                placeholder={intl.formatMessage({
                  id: "userSet.namePlaceholder",
                  defaultMessage: "My Awesome Set",
                })}
                className="text-lg"
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                {intl.formatMessage(
                  {
                    id: "userSet.cardsSelected",
                    defaultMessage: "{count} cards selected",
                  },
                  { count: form.getValues("cardIds").length }
                )}
              </div>
              <Button
                type="submit"
                disabled={
                  form.formState.isSubmitting || (mode === "edit" && !form.formState.isDirty)
                }
                size="lg"
              >
                {mode === "create" ? (
                  <>
                    <Plus className="h-5 w-5 mr-2" />
                    <FormattedMessage
                      id="userSet.createButton"
                      defaultMessage="Create Set"
                    />
                  </>
                ) : (
                  <>
                    <Save className="h-5 w-5 mr-2" />
                    <FormattedMessage
                      id="userSet.save"
                      defaultMessage="Save Changes"
                    />
                  </>
                )}
              </Button>
            </div>
          </RHFForm>
        </div>
      </Card>

      <hr className="mb-6" />

      <Controller name="cardIds" control={form.control} render={({ field, fieldState }) => (
        <>
          <p className="text-sm text-error">{fieldState.error?.message ?? "\u00A0"}</p>
          <CardBrowser
            selectedCards={new Set(field.value)}
            onCardToggle={(cardId: string) => {
              handleCardToggle(cardId);
            }}
          />
        </>
      )}>
      </Controller>
    </>
  );
}

const FormSchema = z.object({
  name: z.string().min(1, "Set name is required"),
  cardIds: z.array(z.string()).min(1, "At least one card must be selected"),
});
