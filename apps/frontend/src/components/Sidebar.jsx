import React, { useState, useRef, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutGrid,
  Video,
  MessageCircle,
  Archive,
  ChevronRight,
  UserCircle,
  HelpCircle,
  Info,
  ArrowUpCircle,
  LogOut,
  ChevronRight as ChevronIcon,
} from "lucide-react";
import { useSelector, useDispatch } from "react-redux";
import { clearAuth } from "../store/authSlice";

const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem("velocity:sidebar-collapsed");
    return saved === "true"; // default false if null
  });

  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const menuRef = useRef(null);
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  useEffect(() => {
    localStorage.setItem("velocity:sidebar-collapsed", isCollapsed.toString());
  }, [isCollapsed]);

  // ==========================
  // LOAD USER PROFILE
  // ==========================

  // ==========================
  // CLOSE PROFILE MENU ON OUTSIDE CLICK
  // ==========================
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ==========================
  // LOGOUT HANDLER
  // ==========================
  const handleLogout = () => {
    localStorage.clear();
    dispatch(clearAuth());
    navigate("/login", { replace: true });
  };

  const menuItems = [
    { path: "/projects", title: "Projects", icon: <LayoutGrid size={18} /> },

    // {
    //   path: "/design-ai",
    //   title: "Design Ai",
    //   icon: <MessageCircle size={18} />,
    // },
    // { path: "/inventory", title: "Inventory", icon: <Archive size={18} /> },
  ];
  const avatarUrl = user?.avatar || user?.picture || null;

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
    : "U";

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 64 : 240 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="relative flex flex-col h-full bg-white border-r border-slate-200"
    >
      {/* Toggle Button */}
      <button
        onClick={() => setIsCollapsed((prev) => !prev)}
        className="absolute right-0 top-14 z-[51] flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 hover:text-slate-900 shadow-sm transition-colors translate-x-1/2"
      >
        <motion.div animate={{ rotate: isCollapsed ? 0 : 180 }}>
          <ChevronRight size={14} />
        </motion.div>
      </button>

      {/* Brand */}
      <div className="h-14 flex items-center px-[18px] gap-3 overflow-hidden border-b border-slate-50">
        <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center">
          <img
            src="/logo.jpg"
            alt="Velocity Logo"
            className="w-full h-full object-contain"
          />
        </div>

        {!isCollapsed && (
          <motion.span className="font-bold text-sm tracking-tight text-slate-900 uppercase">
            Velocity
          </motion.span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {!isCollapsed && (
          <div className="px-3 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">
            Workspace
          </div>
        )}

        {menuItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path);

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className="block relative group"
            >
              <motion.div
                whileHover={{ x: isCollapsed ? 0 : 2 }}
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 ${
                  isActive
                    ? "bg-indigo-50 text-indigo-600"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {item.icon}

                {!isCollapsed && (
                  <span className="text-[13px] font-medium tracking-tight">
                    {item.title}
                  </span>
                )}

                {!isCollapsed && isActive && (
                  <div className="ml-auto w-1 h-1 rounded-full bg-indigo-600" />
                )}
              </motion.div>

              {isCollapsed && (
                <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-slate-900 text-white text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100">
                  {item.title}
                </div>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* USER SECTION */}
      <div className="p-4 border-t border-slate-100 relative" ref={menuRef}>
        <button
          onClick={() => setShowProfileMenu(!showProfileMenu)}
          className={`flex items-center gap-3 w-full p-1.5 rounded-lg hover:bg-slate-50 transition-colors ${
            isCollapsed ? "justify-center" : ""
          }`}
        >
          <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-indigo-600 flex items-center justify-center">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={user?.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="text-[10px] font-bold text-white uppercase">
                {initials}
              </span>
            )}
          </div>

          {!isCollapsed && (
            <div className="flex flex-col min-w-0 text-left">
              <span className="text-xs font-semibold text-slate-900 truncate">
                {user?.name || "User"}
              </span>
              <span className="text-[10px] text-slate-400 font-medium truncate">
                {user?.email || "Free Plan"}
              </span>
            </div>
          )}
        </button>

        {/* PROFILE MENU */}
        <AnimatePresence>
          {showProfileMenu && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute bottom-16 left-4 w-64 bg-white border border-slate-200 rounded-xl shadow-lg py-2 z-[130]"
            >
              {/* Email */}
              <div className="px-4 py-2 mb-1 border-b border-slate-100">
                <span className="text-[12px] text-slate-400 truncate block font-medium">
                  {user?.email}
                </span>
              </div>

              <div className="pb-2 mb-2 border-b border-slate-100">
                <MenuOption icon={<UserCircle size={16} />} label="Account" />
                <MenuOption icon={<HelpCircle size={16} />} label="Get help" />
                <MenuOption
                  icon={<Info size={16} />}
                  label="Learn more"
                  showChevron
                />
              </div>

              <div className="pb-2 mb-2 border-b border-slate-100">
                <MenuOption
                  icon={<ArrowUpCircle size={16} />}
                  label="Upgrade plan"
                />
              </div>

              <div className="pt-1">
                <MenuOption
                  icon={<LogOut size={16} />}
                  label="Log out"
                  className="text-red-500 hover:bg-red-50"
                  onClick={handleLogout}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
};

// Menu Option Component
const MenuOption = ({
  icon,
  label,
  className = "",
  showChevron = false,
  onClick,
}) => (
  <button
    onClick={onClick}
    className={`flex items-center justify-between w-full px-4 py-2 text-[13px] text-slate-600 hover:bg-slate-50 transition-colors group ${className}`}
  >
    <div className="flex items-center gap-3">
      <span className="text-slate-400 group-hover:text-slate-600">{icon}</span>
      <span>{label}</span>
    </div>
    {showChevron && <ChevronIcon size={14} className="text-slate-300" />}
  </button>
);

export default Sidebar;
