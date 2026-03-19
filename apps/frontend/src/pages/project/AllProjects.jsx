import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Clock, ArrowUpRight, Image as ImageIcon } from "lucide-react";
import { getMyProjectsApi } from "../../Api/projectApi";
import ProjectSkeleton from "./ProjectSkeleton";

const AllProjects = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        const res = await getMyProjectsApi();
        setProjects(res.data?.projects || []);
      } catch (err) {
        console.error("Failed to load projects", err);
        setProjects([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-8 py-10 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex justify-between items-end mb-12 border-b border-zinc-100 pb-8">
        <div>
          <h1 className="text-2xl font-light tracking-tight text-zinc-900">
            Project{" "}
            <span className="font-semibold text-indigo-600">Archive</span>
          </h1>
          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-[0.15em] mt-1">
            {projects.length} Active Workspaces
          </p>
        </div>

        {/* ✅ Navigate to full-page wizard route */}
        <button
          onClick={() => navigate("/projects/create-new")}
          className="flex items-center gap-2.5 bg-zinc-900 text-white px-5 py-2.5 rounded-none transition-all hover:bg-indigo-600 active:scale-95 shadow-xl"
        >
          <Plus size={14} strokeWidth={2.5} />
          <span className="text-[10px] font-bold uppercase tracking-widest">
            Create Project
          </span>
        </button>
      </div>

      {/* Project Grid */}
      {loading ? (
        <ProjectSkeleton />
      ) : projects.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="w-16 h-16 rounded-2xl bg-zinc-100 flex items-center justify-center mb-4">
            <ImageIcon size={24} className="text-zinc-300" strokeWidth={1.5} />
          </div>
          <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-2">
            No Projects Yet
          </h3>
          <p className="text-xs text-zinc-300 mb-6">
            Create your first project to get started
          </p>
          <button
            onClick={() => navigate("/projects/create-new")}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-indigo-700 transition-colors"
          >
            <Plus size={13} />
            Create First Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
          {projects.map((project) => (
            <div
              key={project._id}
              onClick={() => navigate(`/projects/${project._id}/quotes`)}
              className="group cursor-pointer"
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-zinc-50 border border-zinc-200 transition-all duration-500 group-hover:border-indigo-500 flex items-center justify-center">
                {project.coverImage ? (
                  <img
                    src={project.coverImage}
                    alt={project.name}
                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-zinc-300 gap-2">
                    <ImageIcon size={28} strokeWidth={1} />
                    <span className="text-[9px] uppercase tracking-widest font-bold">
                      No Cover
                    </span>
                  </div>
                )}

                {/* Draft badge */}
                {project.setupStatus === "draft" ||
                project.setupStatus === "in_progress" ? (
                  <div className="absolute top-3 left-3 px-2 py-0.5 bg-amber-400 text-amber-900 text-[8px] font-black uppercase tracking-widest">
                    {project.setupStatus === "draft" ? "Draft" : "In Progress"}
                  </div>
                ) : null}

                <div className="absolute inset-0 bg-indigo-900/0 group-hover:bg-indigo-900/5 transition-colors flex items-center justify-center">
                  <div className="bg-white p-2.5 shadow-2xl opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                    <ArrowUpRight size={18} className="text-indigo-600" />
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex justify-between items-start">
                  <h3 className="text-[14px] font-semibold text-zinc-900 tracking-tight group-hover:text-indigo-600 transition-colors">
                    {project.name}
                  </h3>
                  <div className="flex items-center gap-1 text-[9px] text-zinc-400 font-bold uppercase">
                    <Clock size={10} />
                    {new Date(project.updatedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </div>
                {project.clientName && (
                  <div className="mt-1 flex items-center gap-2 text-[10px] font-bold text-indigo-500 uppercase tracking-wider">
                    <span className="w-4 h-[1px] bg-indigo-500" />
                    {project.clientName}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AllProjects;
