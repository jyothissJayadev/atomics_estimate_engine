import { createSlice } from "@reduxjs/toolkit";

/**
 * Default tab that every user starts with.
 */
const DEFAULT_TABS = [{ id: "projects", title: "Projects", path: "/projects" }];

const initialState = {
  byUser: {}, // Structure: { [userId]: { openTabs: [] } }
};

const tabsSlice = createSlice({
  name: "tabs",
  initialState,
  reducers: {
    /**
     * Initializes the tab structure for a specific user upon login.
     */
    initUserTabs(state, action) {
      const userId = action.payload;

      // Reset invalid old structures (Migration safety)
      if (!state.byUser || typeof state.byUser !== "object") {
        state.byUser = {};
      }

      if (!state.byUser[userId]) {
        state.byUser[userId] = {
          openTabs: [...DEFAULT_TABS],
        };
      }
    },

    /**
     * Adds a new tab or updates an existing one if the path/title changed.
     */
    addTab(state, action) {
      const { userId, tab } = action.payload;

      if (!state.byUser[userId]) {
        state.byUser[userId] = { openTabs: [...DEFAULT_TABS] };
      }

      const tabs = state.byUser[userId].openTabs;
      const existing = tabs.find((t) => t.id === tab.id);

      if (!existing) {
        tabs.push(tab);
      } else {
        // Update details if the tab already exists (e.g., dynamic project name)
        if (existing.title !== tab.title || existing.path !== tab.path) {
          existing.title = tab.title;
          existing.path = tab.path;
        }
      }
    },

    /**
     * Updates specific tab properties.
     */
    updateTab(state, action) {
      const { userId, tab } = action.payload;
      if (!state.byUser[userId]) return;

      const tabs = state.byUser[userId].openTabs;
      const index = tabs.findIndex((t) => t.id === tab.id);
      if (index !== -1) {
        tabs[index] = { ...tabs[index], ...tab };
      }
    },

    /**
     * Removes a tab by ID.
     */
    removeTab(state, action) {
      const { userId, tabId } = action.payload;
      if (!state.byUser[userId]) return;

      state.byUser[userId].openTabs = state.byUser[userId].openTabs.filter(
        (t) => t.id !== tabId,
      );
    },

    /**
     * VS CODE DRAG & DROP LOGIC
     * Replaces the entire array with the new ordered list from the UI.
     */
    reorderTabs(state, action) {
      const { userId, tabs } = action.payload;

      // Ensure the user exists in state before updating
      if (state.byUser && state.byUser[userId]) {
        state.byUser[userId].openTabs = tabs;
      }
    },

    /**
     * Cleans up user data on logout.
     */
    clearUserTabs(state, action) {
      const userId = action.payload;
      if (state.byUser[userId]) {
        delete state.byUser[userId];
      }
    },
  },
});

export const {
  initUserTabs,
  addTab,
  updateTab,
  removeTab,
  reorderTabs,
  clearUserTabs,
} = tabsSlice.actions;

export default tabsSlice.reducer;
