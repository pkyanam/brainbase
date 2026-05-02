"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Search, MessageSquare, Settings, Database, Network, ChevronLeft, ChevronRight } from "lucide-react";
import { clsx } from "clsx";

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  const navItems = [
    { icon: Search, label: "Search", active: true },
    { icon: MessageSquare, label: "Chats" },
    { icon: Database, label: "Knowledge Base" },
    { icon: Network, label: "Graph Explorer" },
    { icon: Settings, label: "Settings" },
  ];

  return (
    <motion.div
      initial={{ width: 280 }}
      animate={{ width: collapsed ? 80 : 280 }}
      className="h-screen fixed left-0 top-0 z-40 border-r border-border glass-panel rounded-none flex flex-col transition-all bg-surface/50"
    >
      <div className="p-4 flex items-center justify-between border-b border-border/50 min-h-[72px]">
        {!collapsed && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 font-bold text-xl tracking-tight text-white">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#8b5cf6] to-[#3b82f6] flex items-center justify-center text-sm shadow-lg shadow-purple-500/20">B</div>
            Brainbase
          </motion.div>
        )}
        {collapsed && (
          <div className="w-8 h-8 mx-auto rounded-lg bg-gradient-to-br from-[#8b5cf6] to-[#3b82f6] flex items-center justify-center text-sm font-bold text-white shadow-lg shadow-purple-500/20">B</div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-3 flex flex-col gap-2">
        {navItems.map((item, i) => (
          <button
            key={i}
            title={collapsed ? item.label : undefined}
            className={clsx(
              "flex items-center gap-3 px-3 py-3 rounded-xl transition-all w-full text-left overflow-hidden",
              item.active 
                ? "bg-[#3b82f6]/10 text-[#3b82f6]" 
                : "text-white/70 hover:bg-white/5 hover:text-white"
            )}
          >
            <item.icon className={clsx("w-5 h-5 shrink-0", item.active ? "text-[#3b82f6]" : "text-white/50")} />
            {!collapsed && <span className="font-medium whitespace-nowrap">{item.label}</span>}
          </button>
        ))}
      </div>

      <div className="p-4 border-t border-border/50">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full p-2 rounded-lg hover:bg-white/5 text-white/50 hover:text-white transition-colors"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>
    </motion.div>
  );
}
