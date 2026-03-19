import React, { useEffect } from "react";
import {
  Routes,
  Route,
  Navigate,
  useParams,
  useNavigate,
} from "react-router-dom";
import { useDispatch } from "react-redux";
import { upsertProject } from "../../store/projectsSlice";
import { ProjectProvider } from "./context/ProjectContext";
import Navbar from "./Navbar";
import Finance from "./components/finance/Finance";
import EstimateDetail from "./components/finance/EditEstimate/EstimateDetail";

import { getProjectByIdApi } from "../../Api/projectApi";

const Projects = () => {
  const { projectId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    async function loadProject() {
      try {
        const res = await getProjectByIdApi(projectId);
        const project = res.data;

        if (project.isDraft) {
          navigate(`/projects/create-new?resume=${projectId}`, {
            replace: true,
          });
          return;
        }

        dispatch(
          upsertProject({
            _id: project._id,
            name: project.name,
          }),
        );
      } catch (err) {
        console.error("Failed to load project", err);
      }
    }

    loadProject();
  }, [projectId]);
  return (
    <ProjectProvider>
      <div className="bg-[#F8F9FA] text-slate-900 font-sans antialiased">
        <Navbar />
        <main className="w-full">
          <div className="max-w-[1400px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-700">
            <Routes>
              <Route index element={<Navigate to="quotes" replace />} />
              {/* /dna was the old post-setup route — redirect to quotes */}
              <Route path="dna" element={<Navigate to="../quotes" replace />} />

              <Route path="quotes" element={<Finance />} />
              <Route path="quotes/:estimateId" element={<EstimateDetail />} />
            </Routes>
          </div>
        </main>
      </div>
    </ProjectProvider>
  );
};

export default Projects;
