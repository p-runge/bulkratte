"use client";

import { BookOpen, LayoutGrid, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { FormattedMessage } from "react-intl";
import { useDevice } from "@/lib/hooks";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { useBinderContext } from "./binder-context";
import { BrowseMode } from "./modes/browse-mode";
import { SheetManagement } from "./modes/sheet-management";

export function Binder() {
  const { mode, interactionMode, setInteractionMode } = useBinderContext();
  const [activeTab, setActiveTab] = useState("browse");
  const isTouch = useDevice((state) => state.isTouch);

  // Auto-switch from modify to browse mode on non-touch devices (desktop with mouse)
  useEffect(() => {
    if (!isTouch && interactionMode === "modify") {
      setInteractionMode("browse");
      setActiveTab("browse");
    }
  }, [isTouch, interactionMode, setInteractionMode]);

  // In place mode, we only show browse (no tabs needed)
  if (mode === "place") {
    return <BrowseMode />;
  }

  return (
    <Tabs
      value={activeTab}
      className="w-full"
      onValueChange={(value) => {
        setActiveTab(value);
        if (value === "browse" || value === "modify") {
          setInteractionMode(value);
        }
      }}
    >
      <div className="flex justify-center mb-4">
        <TabsList>
          <TabsTrigger value="browse" className="gap-2">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">
              <FormattedMessage
                id="binder.mode.browse"
                defaultMessage="Browse Mode"
              />
            </span>
            <span className="sm:hidden">
              <FormattedMessage
                id="binder.mode.browse.short"
                defaultMessage="Browse"
              />
            </span>
          </TabsTrigger>
          {isTouch && (
            <TabsTrigger value="modify" className="gap-2">
              <Settings className="h-4 w-4" />
              <FormattedMessage
                id="binder.mode.modify"
                defaultMessage="Modify"
              />
            </TabsTrigger>
          )}
          <TabsTrigger value="manage" className="gap-2">
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">
              <FormattedMessage
                id="binder.mode.manage"
                defaultMessage="Manage Sheets"
              />
            </span>
            <span className="sm:hidden">
              <FormattedMessage
                id="binder.mode.manage.short"
                defaultMessage="Manage"
              />
            </span>
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="browse">
        <BrowseMode />
      </TabsContent>

      <TabsContent value="modify">
        <BrowseMode />
      </TabsContent>

      <TabsContent value="manage">
        <SheetManagement />
      </TabsContent>
    </Tabs>
  );
}
