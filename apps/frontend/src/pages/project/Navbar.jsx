import React, { useState, useRef, useEffect, useCallback } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Palette,
  ImageIcon,
  Search,
  DollarSign,
  CheckCircle2,
  Users,
  X,
  Eye,
  Edit3,
  ChevronDown,
  Trash2,
  ShieldCheck,
  UserPlus,
  Mail,
  Copy,
  Check,
  Info,
} from "lucide-react";

// Importing your specific API functions
import {
  addProjectMemberApi,
  removeProjectMemberApi,
  addProjectClientApi,
  removeProjectClientApi,
  getProjectMembersApi,
} from "../../Api/projectApi";

// ==========================
// MEMBER DROPDOWN COMPONENT
// ==========================
const MemberDropdown = ({
  isOpen,
  onClose,
  member,
  onUpdateRole,
  onDisable,
  onDelete,
  dropdownRef,
}) => {
  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-[1000]"
    >
      {member.type === "user" && (
        <>
          <button
            onClick={() => {
              onUpdateRole("edit");
              onClose();
            }}
            className="flex items-center gap-2 w-full px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 transition-colors text-left"
          >
            <Edit3 size={14} className="text-indigo-500" />
            Can Edit
          </button>

          <button
            onClick={() => {
              onUpdateRole("view");
              onClose();
            }}
            className="flex items-center gap-2 w-full px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 transition-colors text-left"
          >
            <Eye size={14} />
            Can View
          </button>

          <div className="h-px bg-slate-100 my-1 mx-2" />
        </>
      )}

      <button
        onClick={() => {
          onDisable();
          onClose();
        }}
        className="flex items-center gap-2 w-full px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 transition-colors text-left"
      >
        {member.disabled ? "Enable Access" : "Disable Access"}
      </button>

      <div className="h-px bg-slate-100 my-1 mx-2" />

      <button
        onClick={() => {
          onDelete();
          onClose();
        }}
        className="flex items-center gap-2 w-full px-4 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors text-left"
      >
        <Trash2 size={14} />
        Remove from project
      </button>
    </div>
  );
};

// ==========================
// ACCESS MODAL COMPONENT
// ==========================
const AccessModal = ({ isOpen, onClose, buttonRef }) => {
  const [clientEmail, setClientEmail] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState("view");
  const [openDropdown, setOpenDropdown] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const { projectId } = useParams();

  const modalRef = useRef(null);
  const dropdownRefs = useRef({});
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  // FETCH DATA USING YOUR EXPORTED API
  const fetchAccessData = useCallback(async () => {
    try {
      const res = await getProjectMembersApi(projectId);

      // Update Users
      setUsers(
        res.data.members.map((m) => ({
          id: m.user._id,
          email: m.user.email,
          role: m.role,
          type: "user",
          disabled: false,
        })),
      );

      // Update Client
      if (res.data.client) {
        setClients([
          {
            id: "client",
            email: res.data.client.email,
            token: res.data.client.token,
            type: "client",
            disabled: false,
          },
        ]);
      } else {
        setClients([]);
      }
    } catch (err) {
      console.error("Access fetch failed", err);
    }
  }, [projectId]);

  useEffect(() => {
    if (isOpen) fetchAccessData();
  }, [isOpen, fetchAccessData]);

  const handleCopyLink = (client) => {
    const uniqueLink = `${window.location.origin}/share/${projectId}/inspiration?auth=${client.token}`;
    navigator.clipboard.writeText(uniqueLink);
    setCopiedId(client.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const updatePosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const modalWidth = 580;
      setCoords({
        top: rect.bottom + 12,
        left: rect.right - modalWidth,
      });
    }
  }, [buttonRef]);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener("resize", updatePosition);
      window.addEventListener("scroll", updatePosition, true);
    }
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(e.target) &&
        !buttonRef.current.contains(e.target)
      ) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, onClose, buttonRef]);

  const handleAddClient = async (e) => {
    e.preventDefault();
    if (!clientEmail) return;
    try {
      await addProjectClientApi(projectId, clientEmail);
      setClientEmail("");
      fetchAccessData(); // Refresh list
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!userEmail) return;
    try {
      await addProjectMemberApi(projectId, {
        email: userEmail,
        role: selectedRole,
      });
      setUserEmail("");
      fetchAccessData(); // Refresh list
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <motion.div
      ref={modalRef}
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.98 }}
      className="fixed z-[9999] bg-white rounded-2xl shadow-2xl border border-slate-200 w-[580px] flex flex-col overflow-hidden"
      style={{ top: coords.top, left: coords.left }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
            <ShieldCheck size={18} className="text-indigo-600" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-slate-900">
              Project Access
            </h2>
            <p className="text-[11px] text-slate-500">
              Manage visibility and unique client links
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-slate-400 hover:bg-slate-50 rounded-full transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      <div className="max-h-[520px] overflow-y-auto no-scrollbar">
        {/* External Invitees Section */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <UserPlus size={14} className="text-slate-400" />
              <h3 className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                External Invitees
              </h3>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 rounded-md border border-amber-100">
              <Info size={12} className="text-amber-600" />
              <span className="text-[10px] text-amber-700 font-medium">
                Inspiration View Only
              </span>
            </div>
          </div>

          <form onSubmit={handleAddClient} className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Mail
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={14}
              />
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="client@email.com"
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
              />
            </div>
            <button
              type="submit"
              className="bg-indigo-600 text-white px-6 rounded-xl text-xs font-medium hover:bg-indigo-700 transition-colors"
            >
              Add Client
            </button>
          </form>

          <div className="space-y-2">
            {clients.map((c, i) => (
              <div
                key={c.id}
                className={`flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50/50 transition-all ${c.disabled ? "opacity-40" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 text-[10px] font-medium">
                    CL
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm text-slate-600">{c.email}</span>
                    <span className="text-[10px] text-slate-400">
                      Unique Token: {c.token}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopyLink(c)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                      copiedId === c.id
                        ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {copiedId === c.id ? (
                      <Check size={12} />
                    ) : (
                      <Copy size={12} />
                    )}
                    {copiedId === c.id ? "Copied" : "Copy Link"}
                  </button>
                  <div className="relative">
                    <button
                      onClick={() =>
                        setOpenDropdown(openDropdown === c.id ? null : c.id)
                      }
                      className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                      <ChevronDown size={16} />
                    </button>
                    <MemberDropdown
                      isOpen={openDropdown === c.id}
                      onClose={() => setOpenDropdown(null)}
                      member={c}
                      onDisable={() => {
                        const nc = [...clients];
                        nc[i].disabled = !nc[i].disabled;
                        setClients(nc);
                      }}
                      onDelete={async () => {
                        await removeProjectClientApi(projectId);
                        fetchAccessData();
                      }}
                      dropdownRef={(el) => (dropdownRefs.current[c.id] = el)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="h-px bg-slate-100 mx-6" />

        {/* Internal Workspace Section */}
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users size={14} className="text-slate-400" />
            <h3 className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Internal Workspace
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3 bg-slate-100 p-1 rounded-xl">
            {["view", "edit"].map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setSelectedRole(role)}
                className={`py-1.5 rounded-lg text-xs font-medium transition-all ${selectedRole === role ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                {role === "view" ? "Viewer" : "Editor"}
              </button>
            ))}
          </div>

          <form onSubmit={handleAddUser} className="flex gap-2">
            <input
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="team@velocity.com"
              className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
            />
            <button
              type="submit"
              className="bg-slate-900 text-white px-6 rounded-xl text-xs font-medium hover:bg-slate-800 transition-colors"
            >
              Add
            </button>
          </form>

          <div className="mt-4 space-y-1">
            {users.map((u, i) => (
              <div
                key={u.id}
                className={`flex items-center justify-between p-2 rounded-xl border border-transparent hover:border-slate-100 hover:bg-slate-50/50 transition-all ${u.disabled ? "opacity-40" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-white text-[10px] font-medium uppercase">
                    {u.email.charAt(0)}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm text-slate-600">{u.email}</span>
                    <span className="text-[10px] text-indigo-500 font-medium uppercase tracking-tight">
                      {u.role}
                    </span>
                  </div>
                </div>
                <div className="relative">
                  <button
                    onClick={() =>
                      setOpenDropdown(openDropdown === u.id ? null : u.id)
                    }
                    className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    <ChevronDown size={16} />
                  </button>
                  <MemberDropdown
                    isOpen={openDropdown === u.id}
                    onClose={() => setOpenDropdown(null)}
                    member={u}
                    onUpdateRole={(role) => {
                      const nu = [...users];
                      nu[i].role = role;
                      setUsers(nu);
                    }}
                    onDisable={() => {
                      const nu = [...users];
                      nu[i].disabled = !nu[i].disabled;
                      setUsers(nu);
                    }}
                    onDelete={async () => {
                      await removeProjectMemberApi(projectId, u.id);
                      fetchAccessData();
                    }}
                    dropdownRef={(el) => (dropdownRefs.current[u.id] = el)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ==========================
// MAIN NAVBAR COMPONENT
// ==========================
const Navbar = () => {
  const { projectId } = useParams();
  const location = useLocation();
  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);
  const accessButtonRef = useRef(null);

  const navItems = [
    // {
    //   id: "dna",
    //   label: "Project DNA",
    //   path: `/projects/${projectId}/dna`,
    //   icon: <Palette size={14} />,
    // },
    // {
    //   id: "gallery",
    //   label: "Inspiration",
    //   path: `/projects/${projectId}/gallery`,
    //   icon: <ImageIcon size={14} />,
    // },
    {
      id: "quotes",
      label: "Finance",
      path: `/projects/${projectId}/quotes`,
      icon: <DollarSign size={14} />,
    },
    // {
    //   id: "kanban",
    //   label: "Kanban",
    //   path: `/projects/${projectId}/kanban`,
    //   icon: <CheckCircle2 size={14} />,
    // },
  ];

  return (
    <>
      <nav className="sticky top-0 z-[50] bg-white border-b border-slate-200/60 h-14">
        <div className="max-w-[1400px] mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-1 h-full">
            {navItems.map((item) => {
              const isActive = location.pathname.includes(item.id);
              return (
                <Link
                  key={item.id}
                  to={item.path}
                  className={`relative flex items-center gap-2 px-4 h-9 text-xs font-medium transition-all rounded-lg ${
                    isActive
                      ? "text-indigo-600 bg-indigo-50/50"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-50/50"
                  }`}
                >
                  {item.icon}
                  {item.label}
                  {isActive && (
                    <motion.div
                      layoutId="navIndicator"
                      className="absolute -bottom-[10px] left-2 right-2 h-[2px] bg-indigo-600 rounded-t-full"
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* <button
            ref={accessButtonRef}
            onClick={() => setIsAccessModalOpen(!isAccessModalOpen)}
            className="flex items-center gap-2 bg-indigo-600 px-4 py-2 rounded-xl text-xs font-medium text-white hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 active:scale-95"
          >
            <Users size={16} />
            <span>Access</span>
          </button> */}
        </div>
      </nav>

      <AnimatePresence>
        {isAccessModalOpen && (
          <AccessModal
            isOpen={isAccessModalOpen}
            onClose={() => setIsAccessModalOpen(false)}
            buttonRef={accessButtonRef}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
