import React, { useState } from "react";
import { useNavigate } from "react-router-dom"; // Switched from Link to useNavigate
import { X, Layers, Briefcase } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { reorderTabs } from "../store/tabsSlice";

const Navbar = ({ tabs, activePath, closeTab }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const userId = useSelector(
    (state) => state.auth.user?._id || state.auth.user?.id,
  );

  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";

    // Create a cleaner drag image if needed, or let browser handle default
    const ghost = e.currentTarget.cloneNode(true);
    ghost.style.opacity = "0.5";
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null) return;
    if (index !== dropIndex) setDropIndex(index);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (
      draggedIndex !== null &&
      dropIndex !== null &&
      draggedIndex !== dropIndex
    ) {
      const newTabs = [...tabs];
      const draggedItem = newTabs[draggedIndex];
      newTabs.splice(draggedIndex, 1);
      newTabs.splice(dropIndex, 0, draggedItem);
      dispatch(reorderTabs({ userId, tabs: newTabs }));
    }
    setDraggedIndex(null);
    setDropIndex(null);
  };

  const handleTabClick = (path) => {
    // Only navigate if we aren't currently dragging
    if (draggedIndex === null) {
      navigate(path);
    }
  };

  return (
    <div
      className="h-10 bg-[#F8F9FA] border-b border-slate-200/60 flex items-center gap-0 overflow-x-auto no-scrollbar select-none px-1"
      onDragLeave={() => setDropIndex(null)}
    >
      {/* Brand/Menu Icon */}
      <div className="flex items-center h-full px-3 text-slate-400">
        <Layers size={14} strokeWidth={2} />
      </div>

      <div className="flex items-center h-full gap-[2px]">
        {tabs.map((tab, index) => {
          const isSpecificProject = ![
            "projects",
            "inventory",
            "design-ai-create",
            "design-ai-ask",
          ].includes(tab.id);

          const isActive =
            tab.id === "projects"
              ? activePath === "/projects"
              : activePath.startsWith(tab.path);

          return (
            <div
              key={tab.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={handleDrop}
              onDragEnd={() => {
                setDraggedIndex(null);
                setDropIndex(null);
              }}
              // Navigate on the container click for better hit area
              onClick={() => handleTabClick(tab.path)}
              className={`group relative flex items-center h-[34px] px-4 transition-all duration-200 ease-out rounded-t-lg cursor-pointer ${
                isActive
                  ? "bg-white text-slate-900 shadow-[0_-1px_3px_rgba(0,0,0,0.04)] z-10"
                  : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-700"
              } ${draggedIndex === index ? "opacity-20 scale-95" : "opacity-100"}`}
              style={{
                minWidth: "140px",
                maxWidth: "220px",
              }}
            >
              {/* Drop Indicator - Minimalist Line */}
              {dropIndex === index && draggedIndex !== index && (
                <div
                  className={`absolute top-1 bottom-1 w-[3px] bg-indigo-500 rounded-full z-50 animate-pulse ${
                    dropIndex > draggedIndex ? "-right-[2px]" : "-left-[2px]"
                  }`}
                />
              )}

              {/* Icon - pointer-events-none prevents child elements from stealing the click/drag focus */}
              {isSpecificProject && (
                <Briefcase
                  size={13}
                  className={`mr-2.5 flex-shrink-0 transition-colors pointer-events-none ${
                    isActive ? "text-indigo-500" : "text-slate-400 opacity-70"
                  }`}
                />
              )}

              {/* Title */}
              <span
                className={`text-[12px] truncate flex-1 tracking-tight pr-2 transition-all pointer-events-none ${
                  isActive ? "font-semibold" : "font-medium"
                }`}
              >
                {tab.title}
              </span>

              {/* Close Button */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation(); // Stops the tab from navigating when you just want to close it
                  closeTab(e, tab.id);
                }}
                className={`flex-shrink-0 p-1 rounded-md transition-all duration-200 z-20 ${
                  isActive
                    ? "text-slate-400 hover:text-slate-900 hover:bg-slate-100"
                    : "opacity-0 group-hover:opacity-100 text-slate-400 hover:bg-slate-200"
                }`}
              >
                <X size={13} strokeWidth={2.5} />
              </button>

              {/* Active Bottom Glow */}
              {isActive && (
                <div className="absolute -bottom-[1px] left-0 right-0 h-[1.5px] bg-indigo-500 rounded-full" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Navbar;
