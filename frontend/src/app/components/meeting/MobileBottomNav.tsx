import { motion } from "framer-motion";
import { MessageSquare, Settings, Users, Folder } from "lucide-react";

type MobileTab = "chat" | "controls" | "people" | "files";

type MobileBottomNavProps = Readonly<{
  activeTab: MobileTab;
  onSelectTab: (tab: MobileTab) => void;
}>;

const tabs: Array<{ id: MobileTab; label: string; icon: React.ReactNode }> = [
  { id: "chat", label: "Chat", icon: <MessageSquare size={14} /> },
  { id: "controls", label: "Controls", icon: <Settings size={14} /> },
  { id: "people", label: "People", icon: <Users size={14} /> },
  { id: "files", label: "Files", icon: <Folder size={14} /> },
];

export function MobileBottomNav({ activeTab, onSelectTab }: MobileBottomNavProps) {
  return (
    <motion.nav
      initial={{ y: 30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-800 bg-slate-950/95 p-2 backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid max-w-2xl grid-cols-4 gap-1">
        {tabs.map((tab) => (
          <li key={tab.id}>
            <button
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`inline-flex w-full items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold ${
                activeTab === tab.id
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-800 text-slate-300"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          </li>
        ))}
      </ul>
    </motion.nav>
  );
}
