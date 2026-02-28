"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api/react";
import {
  Camera,
  Check,
  Clock,
  Copy,
  Loader2,
  Plus,
  Radio,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";

type ExpiryOption = "never" | "1d" | "7d" | "30d";

function expiryToIso(option: ExpiryOption): string | undefined {
  const now = new Date();
  if (option === "1d") {
    now.setDate(now.getDate() + 1);
    return now.toISOString();
  }
  if (option === "7d") {
    now.setDate(now.getDate() + 7);
    return now.toISOString();
  }
  if (option === "30d") {
    now.setDate(now.getDate() + 30);
    return now.toISOString();
  }
  return undefined;
}

function formatExpiry(expiresAt: string | null): string {
  if (!expiresAt) return "Never";
  return new Date(expiresAt).toLocaleDateString();
}

function formatLastAccessed(lastAccessedAt: string | null): string {
  if (!lastAccessedAt) return "Not yet accessed";
  return new Date(lastAccessedAt).toLocaleDateString();
}

type CreateFormState = {
  label: string;
  scopeMode: "all" | "specific";
  selectedSetIds: string[];
  mode: "live" | "snapshot";
  expiry: ExpiryOption;
};

const defaultForm: CreateFormState = {
  label: "",
  scopeMode: "all",
  selectedSetIds: [],
  mode: "live",
  expiry: "never",
};

export function ShareLinksDialog({ children }: { children: React.ReactNode }) {
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateFormState>(defaultForm);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const utils = api.useUtils();

  const { data: links, isLoading: isLoadingLinks } =
    api.wantlistShareLink.list.useQuery(undefined, { enabled: open });

  const { data: userSets } = api.userSet.getList.useQuery(undefined, {
    enabled: open && form.scopeMode === "specific",
  });

  const createMutation = api.wantlistShareLink.create.useMutation({
    onSuccess: () => {
      void utils.wantlistShareLink.list.invalidate();
      setShowForm(false);
      setForm(defaultForm);
    },
  });

  const revokeMutation = api.wantlistShareLink.revoke.useMutation({
    onSuccess: () => {
      void utils.wantlistShareLink.list.invalidate();
    },
  });

  async function handleCopy(id: string) {
    const url = new URL(`/share/${id}`, window.location.origin).toString();
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function handleCreate() {
    createMutation.mutate({
      label: form.label || undefined,
      userSetIds:
        form.scopeMode === "specific" && form.selectedSetIds.length > 0
          ? form.selectedSetIds
          : undefined,
      isSnapshot: form.mode === "snapshot",
      expiresAt: expiryToIso(form.expiry),
    });
  }

  function toggleSetId(id: string) {
    setForm((prev) => ({
      ...prev,
      selectedSetIds: prev.selectedSetIds.includes(id)
        ? prev.selectedSetIds.filter((s) => s !== id)
        : [...prev.selectedSetIds, id],
    }));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            <FormattedMessage
              id="share-links.dialog.title"
              defaultMessage="Share Links"
            />
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Existing links */}
          {isLoadingLinks ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : links && links.length > 0 ? (
            <div className="space-y-3">
              {links.map((link) => (
                <div key={link.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {link.label ?? (
                          <span className="text-muted-foreground italic">
                            <FormattedMessage
                              id="share-links.untitled"
                              defaultMessage="Untitled link"
                            />
                          </span>
                        )}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          {link.is_snapshot ? (
                            <>
                              <Camera className="h-3 w-3" />
                              <FormattedMessage
                                id="share-links.snapshot"
                                defaultMessage="Snapshot"
                              />
                            </>
                          ) : (
                            <>
                              <Radio className="h-3 w-3" />
                              <FormattedMessage
                                id="share-links.live"
                                defaultMessage="Live"
                              />
                            </>
                          )}
                        </span>
                        {link.setNames ? (
                          <span>
                            <FormattedMessage
                              id="share-links.scoped"
                              defaultMessage="{count, plural, one {# set} other {# sets}}"
                              values={{ count: link.setNames.length }}
                            />
                            {": "}
                            {link.setNames.join(", ")}
                          </span>
                        ) : (
                          <span>
                            <FormattedMessage
                              id="share-links.all-sets"
                              defaultMessage="All sets"
                            />
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {link.expires_at ? (
                            <FormattedMessage
                              id="share-links.expires"
                              defaultMessage="Expires {date}"
                              values={{
                                date: formatExpiry(link.expires_at),
                              }}
                            />
                          ) : (
                            <FormattedMessage
                              id="share-links.no-expiry"
                              defaultMessage="No expiry"
                            />
                          )}
                        </span>
                        <span>
                          <FormattedMessage
                            id="share-links.last-accessed"
                            defaultMessage="Accessed: {date}"
                            values={{
                              date: formatLastAccessed(link.last_accessed_at),
                            }}
                          />
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleCopy(link.id)}
                        title={intl.formatMessage({
                          id: "share-links.copy",
                          defaultMessage: "Copy link",
                        })}
                      >
                        {copiedId === link.id ? (
                          <Check className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => revokeMutation.mutate({ id: link.id })}
                        disabled={revokeMutation.isPending}
                        title={intl.formatMessage({
                          id: "share-links.revoke",
                          defaultMessage: "Revoke link",
                        })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            !showForm && (
              <p className="text-sm text-muted-foreground text-center py-6">
                <FormattedMessage
                  id="share-links.empty"
                  defaultMessage="No share links yet. Create one to share your wantlist."
                />
              </p>
            )
          )}

          {/* Create form */}
          {showForm && (
            <>
              {links && links.length > 0 && <Separator />}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">
                    <FormattedMessage
                      id="share-links.create.title"
                      defaultMessage="New share link"
                    />
                  </h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => {
                      setShowForm(false);
                      setForm(defaultForm);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Label */}
                <div className="space-y-1.5">
                  <Label htmlFor="link-label">
                    <FormattedMessage
                      id="share-links.create.label"
                      defaultMessage="Label (optional)"
                    />
                  </Label>
                  <Input
                    id="link-label"
                    placeholder={intl.formatMessage({
                      id: "share-links.create.label.placeholder",
                      defaultMessage: "e.g. For trading with Jonas",
                    })}
                    value={form.label}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, label: e.target.value }))
                    }
                  />
                </div>

                {/* Scope */}
                <div className="space-y-2">
                  <Label>
                    <FormattedMessage
                      id="share-links.create.scope"
                      defaultMessage="Which sets to include"
                    />
                  </Label>
                  <RadioGroup
                    value={form.scopeMode}
                    onValueChange={(v) =>
                      setForm((p) => ({
                        ...p,
                        scopeMode: v as "all" | "specific",
                        selectedSetIds: [],
                      }))
                    }
                    className="gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="all" id="scope-all" />
                      <Label
                        htmlFor="scope-all"
                        className="font-normal cursor-pointer"
                      >
                        <FormattedMessage
                          id="share-links.create.scope.all"
                          defaultMessage="All my sets"
                        />
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="specific" id="scope-specific" />
                      <Label
                        htmlFor="scope-specific"
                        className="font-normal cursor-pointer"
                      >
                        <FormattedMessage
                          id="share-links.create.scope.specific"
                          defaultMessage="Specific sets"
                        />
                      </Label>
                    </div>
                  </RadioGroup>

                  {form.scopeMode === "specific" && (
                    <div className="ml-6 space-y-1.5 border rounded-md p-3 max-h-36 overflow-y-auto">
                      {userSets?.length ? (
                        userSets.map((set) => (
                          <div key={set.id} className="flex items-center gap-2">
                            <Checkbox
                              id={`set-${set.id}`}
                              checked={form.selectedSetIds.includes(set.id)}
                              onCheckedChange={() => toggleSetId(set.id)}
                            />
                            <Label
                              htmlFor={`set-${set.id}`}
                              className="font-normal cursor-pointer text-sm"
                            >
                              {set.name}
                            </Label>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          <FormattedMessage
                            id="share-links.create.scope.no-sets"
                            defaultMessage="No sets found"
                          />
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Mode: Live vs Snapshot */}
                <div className="space-y-2">
                  <Label>
                    <FormattedMessage
                      id="share-links.create.mode"
                      defaultMessage="Content"
                    />
                  </Label>
                  <RadioGroup
                    value={form.mode}
                    onValueChange={(v) =>
                      setForm((p) => ({ ...p, mode: v as "live" | "snapshot" }))
                    }
                    className="gap-2"
                  >
                    <div className="flex items-start gap-2">
                      <RadioGroupItem
                        value="live"
                        id="mode-live"
                        className="mt-0.5"
                      />
                      <div>
                        <Label
                          htmlFor="mode-live"
                          className="font-normal cursor-pointer"
                        >
                          <FormattedMessage
                            id="share-links.create.mode.live"
                            defaultMessage="Live"
                          />
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          <FormattedMessage
                            id="share-links.create.mode.live.description"
                            defaultMessage="Always shows your current wantlist"
                          />
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <RadioGroupItem
                        value="snapshot"
                        id="mode-snapshot"
                        className="mt-0.5"
                      />
                      <div>
                        <Label
                          htmlFor="mode-snapshot"
                          className="font-normal cursor-pointer"
                        >
                          <FormattedMessage
                            id="share-links.create.mode.snapshot"
                            defaultMessage="Snapshot"
                          />
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          <FormattedMessage
                            id="share-links.create.mode.snapshot.description"
                            defaultMessage="Frozen list of cards you need right now"
                          />
                        </p>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                {/* Expiry */}
                <div className="space-y-1.5">
                  <Label htmlFor="link-expiry">
                    <FormattedMessage
                      id="share-links.create.expiry"
                      defaultMessage="Expiry"
                    />
                  </Label>
                  <Select
                    value={form.expiry}
                    onValueChange={(v) =>
                      setForm((p) => ({ ...p, expiry: v as ExpiryOption }))
                    }
                  >
                    <SelectTrigger id="link-expiry">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">
                        <FormattedMessage
                          id="share-links.create.expiry.never"
                          defaultMessage="Never expires"
                        />
                      </SelectItem>
                      <SelectItem value="1d">
                        <FormattedMessage
                          id="share-links.create.expiry.1d"
                          defaultMessage="24 hours"
                        />
                      </SelectItem>
                      <SelectItem value="7d">
                        <FormattedMessage
                          id="share-links.create.expiry.7d"
                          defaultMessage="7 days"
                        />
                      </SelectItem>
                      <SelectItem value="30d">
                        <FormattedMessage
                          id="share-links.create.expiry.30d"
                          defaultMessage="30 days"
                        />
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  className="w-full"
                  onClick={handleCreate}
                  disabled={
                    createMutation.isPending ||
                    (form.scopeMode === "specific" &&
                      form.selectedSetIds.length === 0)
                  }
                >
                  {createMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  <FormattedMessage
                    id="share-links.create.submit"
                    defaultMessage="Create link"
                  />
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Footer: add new link button */}
        {!showForm && (
          <>
            <Separator />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowForm(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              <FormattedMessage
                id="share-links.create.open"
                defaultMessage="Create new link"
              />
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
