"use client";

import { Check, Image as ImageIcon } from "lucide-react";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { cn } from "@/lib/utils";

export const backgrounds = [
  { id: "bg-gray-50", type: "color", value: "bg-gray-50 dark:bg-gray-950", label: "Default" },
  { id: "bg-blue-50", type: "color", value: "bg-blue-50 dark:bg-blue-950/50", label: "Soft Blue" },
  { id: "bg-green-50", type: "color", value: "bg-green-50 dark:bg-green-950/50", label: "Soft Green" },
  { id: "bg-purple-50", type: "color", value: "bg-purple-50 dark:bg-purple-950/50", label: "Soft Purple" },
  { id: "bg-amber-50", type: "color", value: "bg-amber-50 dark:bg-amber-950/50", label: "Soft Amber" },
  { id: "bg-rose-50", type: "color", value: "bg-rose-50 dark:bg-rose-950/50", label: "Soft Rose" },
  {
    id: "img-mountains",
    type: "image",
    value: "url('https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=2000')",
    label: "Mountains",
  },
  {
    id: "img-ocean",
    type: "image",
    value: "url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=2000')",
    label: "Ocean",
  },
  {
    id: "img-forest",
    type: "image",
    value: "url('https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&q=80&w=2000')",
    label: "Forest",
  },
  {
    id: "img-abstract",
    type: "image",
    value: "url('https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&q=80&w=2000')",
    label: "Abstract",
  },
];

interface Props {
  currentBg: string;
  onSelect: (bgId: string) => void;
}

export function BackgroundChooser({ currentBg, onSelect }: Props) {

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <ImageIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Background</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 p-2" align="end">
        <DropdownMenuLabel>Choose Background</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="grid grid-cols-2 gap-2 mt-2">
          {backgrounds.map((bg) => (
            <button
              key={bg.id}
              onClick={() => onSelect(bg.id)}
              className={cn(
                "relative h-16 w-full rounded-md border text-xs font-medium text-muted-foreground transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring",
                currentBg === bg.id && "ring-2 ring-primary border-primary",
                bg.type === "color" ? bg.value : "bg-cover bg-center"
              )}
              style={bg.type === "image" ? { backgroundImage: bg.value } : {}}
            >
              {currentBg === bg.id && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-md">
                  <Check className="h-4 w-4 text-white" />
                </div>
              )}
              <span className={cn(
                "absolute bottom-0 left-0 right-0 p-1 text-[10px] text-center bg-white/80 backdrop-blur-sm rounded-b-md truncate",
                 bg.type === "image" && "text-black"
              )}>
                {bg.label}
              </span>
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
