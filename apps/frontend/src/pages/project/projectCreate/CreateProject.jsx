import React from "react";
import WizardShell from "./components/wizard/WizardShell";

/**
 * CreateProject
 * Full-page route at /projects/create-new.
 * Renders WizardShell without any app chrome (sidebar/navbar).
 * WizardShell owns draft creation, auto-save, and final navigation.
 */
export default function CreateProject() {
  return <WizardShell />;
}
