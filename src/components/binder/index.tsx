"use client";

import { BookOpen, LayoutGrid, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { FormattedMessage } from "react-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { useBinderContext } from "./binder-context";
import { BrowseMode } from "./modes/browse-mode";
import { SheetManagement } from "./modes/sheet-management";

export function Binder() {
  const { mode, setMode } = useBinderContext();
  const [activeTab, setActiveTab] = useState("browse");

  // Auto-switch from remove to browse mode when screen size changes to desktop
  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)"); // md breakpoint

    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches && mode === "remove") {
        setMode("browse");
        setActiveTab("browse");
      }
    };

    // Check initial state
    handleChange(mediaQuery);

    // Listen for changes
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [mode, setMode]);

  return (
    <Tabs
      value={activeTab}
      className="w-full"
      onValueChange={(value) => {
        setActiveTab(value);
        if (value === "browse" || value === "remove") {
          setMode(value);
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
          <TabsTrigger value="remove" className="gap-2 md:hidden">
            <Trash2 className="h-4 w-4" />
            <FormattedMessage id="binder.mode.remove" defaultMessage="Remove" />
          </TabsTrigger>
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

      <TabsContent value="remove">
        <BrowseMode />
      </TabsContent>

      <TabsContent value="manage">
        <SheetManagement />
      </TabsContent>
    </Tabs>
  );
}
