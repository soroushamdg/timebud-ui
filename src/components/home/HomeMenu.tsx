"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, ListChecks, LayoutGrid, Calendar, BarChart2, Coins } from "lucide-react";

const MENU_ITEMS = [
  { label: "All Jobs", href: "/tasks/all", icon: ListChecks },
  { label: "Missions", href: "/projects/select", icon: LayoutGrid },
  { label: "Week Ahead", href: "/planner", icon: Calendar },
  { label: "Timeline", href: "/gantt", icon: BarChart2 },
  { label: "Credits", href: "/credits", icon: Coins },
] as const;

export function HomeMenu() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-11 h-11 bg-secondary-surface rounded-full flex items-center justify-center hover:bg-bg-card-hover/80 transition-colors"
        title="Menu"
      >
        <Menu className="w-5 h-5 text-text-primary" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-56 bg-bg-card border border-border-card rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.5)] z-50 overflow-hidden p-1">
            {MENU_ITEMS.map(({ label, href, icon: Icon }) => (
              <button
                key={href}
                onClick={() => {
                  setIsOpen(false);
                  router.push(href);
                }}
                className="w-full px-3 py-2.5 text-left text-text-primary hover:bg-secondary-surface rounded-xl transition-colors flex items-center gap-3"
              >
                <Icon size={18} className="text-accent-yellow flex-shrink-0" />
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
