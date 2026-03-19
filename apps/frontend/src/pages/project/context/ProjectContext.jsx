import React, { createContext, useState, useEffect, useContext } from "react";
import { useParams } from "react-router-dom";
import { getProjectByIdApi } from "../../../Api/projectApi";

export const ProjectContext = createContext();

export const ProjectProvider = ({ children }) => {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [projectLoading, setProjectLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      try {
        setProjectLoading(true);
        const res = await getProjectByIdApi(projectId);
        setProject(res.data.project || res.data);
      } catch (err) {
        console.error("ProjectContext: failed to load project", err);
      } finally {
        setProjectLoading(false);
      }
    })();
  }, [projectId]);

  const runAISync = (updateType) => {
    console.log(`AI Sync triggered: ${updateType}`);
  };

  return (
    <ProjectContext.Provider
      value={{ project, setProject, projectLoading, runAISync }}
    >
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => useContext(ProjectContext);
