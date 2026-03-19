import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  byId: {}, // { [projectId]: { _id, name } }
};

const projectsSlice = createSlice({
  name: "projects",
  initialState,
  reducers: {
    upsertProject(state, action) {
      const project = action.payload;
      state.byId[project._id] = project;
    },
  },
});

export const { upsertProject } = projectsSlice.actions;
export default projectsSlice.reducer;
