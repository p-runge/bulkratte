import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

type Props = {
  children?: React.ReactNode;
}

export default function Loader({ children }: Props) {
  const [showChildren, setShowChildren] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setShowChildren(true);
    }, 1000);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className="relative h-32 w-32 flex justify-center items-center">
      <div className="animate-spin rounded-full w-full h-full border-b-2 border-primary">
      </div>
      {children && <div className={cn("absolute transition-opacity duration-1000 text-center", showChildren ? "opacity-100" : "opacity-0")}>{children}</div>}
    </div>
  )
}
