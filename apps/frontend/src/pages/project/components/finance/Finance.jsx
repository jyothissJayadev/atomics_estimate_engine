import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  Plus,
  RefreshCw,
  Lock,
  Unlock,
  Loader2,
  FileText,
  ShieldCheck,
  ChevronRight,
  GripVertical,
  Layers,
  Clock,
} from "lucide-react";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  restrictToVerticalAxis,
  restrictToFirstScrollableAncestor,
} from "@dnd-kit/modifiers";

import {
  toggleFinanceGstApi,
  syncProjectFinanceApi,
  toggleEstimateInFinanceApi,
  getProjectFinanceApi,
  reorderFinanceEstimatesApi,
} from "../../../../Api/financeApi";

import PreviewFinance from "./EstimatePDFPreview/PreviewFinance";

/* =====================================
    SORTABLE ROW COMPONENT
===================================== */
const SortableRow = ({ est, children }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: est.estimateId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : "auto",
    position: "relative",
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`group border-b border-slate-100 transition-colors ${
        isDragging ? "bg-slate-50 shadow-inner z-50" : "hover:bg-slate-50/50"
      }`}
    >
      <td className="w-10 pl-4">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-indigo-600 p-2"
        >
          <GripVertical size={14} />
        </div>
      </td>
      {children}
    </tr>
  );
};

/* =====================================
    MAIN COMPONENT
===================================== */
const Finance = () => {
  const navigate = useNavigate();
  const { projectId } = useParams();

  const [finance, setFinance] = useState(null);
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0); // ✅ ADD
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTogglingGst, setIsTogglingGst] = useState(false);
  const [updatingEstimateId, setUpdatingEstimateId] = useState(null);

  const [companyDetails, setCompanyDetails] = useState({
    companyName: "",
    address: "",
    phone: "",
    email: "",
    gstNumber: "",
  });

  const sensors = useSensors(useSensor(PointerSensor));

  useEffect(() => {
    loadFinance();
  }, [projectId]);

  const loadFinance = async () => {
    try {
      setIsLoading(true);
      const response = await getProjectFinanceApi(projectId);
      setFinance(response.data);

      if (response.data.header) {
        setCompanyDetails({
          companyName: response.data.header.companyName || "",
          address: response.data.header.location || "",
          phone: response.data.header.phone || "",
          email: response.data.header.email || "",
          gstNumber: "",
        });
      }
    } catch (error) {
      if (error.response?.status !== 404) {
        toast.error("Error loading finance data");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = finance.estimates.findIndex(
      (e) => e.estimateId === active.id,
    );
    const newIndex = finance.estimates.findIndex(
      (e) => e.estimateId === over.id,
    );
    const newOrder = arrayMove(finance.estimates, oldIndex, newIndex);

    setFinance((prev) => ({ ...prev, estimates: newOrder }));

    try {
      await reorderFinanceEstimatesApi(
        projectId,
        newOrder.map((e) => e.estimateId),
      );

      setPreviewRefreshKey((k) => k + 1); // ✅ ADD
    } catch (err) {
      toast.error("Reorder failed");
      loadFinance();
    }
  };

  const handleToggleGst = async () => {
    if (isTogglingGst) return;
    try {
      setIsTogglingGst(true);
      const res = await toggleFinanceGstApi(projectId);
      setFinance((prev) => ({
        ...prev,
        gstEnabled: res.data.gstEnabled,
        totals: res.data.totals,
      }));
      setPreviewRefreshKey((k) => k + 1); // ✅ ADD
      toast.success("Tax updated");
    } catch (err) {
      toast.error("Failed to update GST");
    } finally {
      setIsTogglingGst(false);
    }
  };

  const handleSyncEstimates = async () => {
    if (isSyncing) return;
    try {
      setIsSyncing(true);
      const response = await syncProjectFinanceApi(projectId);
      setFinance(response.data);
      setPreviewRefreshKey((k) => k + 1); // ✅ ADD
      toast.info("Data Synced");
    } catch (error) {
      toast.error("Sync failed");
    } finally {
      setIsSyncing(false);
    }
  };
  const handleToggleEstimate = async (estimateId, e) => {
    e.stopPropagation();
    if (updatingEstimateId) return;
    try {
      setUpdatingEstimateId(estimateId);
      const response = await toggleEstimateInFinanceApi(projectId, estimateId);
      setFinance((prev) => ({
        ...prev,
        estimates: response.data.estimates,
        totals: response.data.totals,
      }));
      setPreviewRefreshKey((k) => k + 1); // ✅ ADD
    } catch (error) {
      toast.error("Update failed");
    } finally {
      setUpdatingEstimateId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full min-h-[400px] flex items-center justify-center">
        <Loader2 className="animate-spin text-slate-400" size={24} />
      </div>
    );
  }

  if (!finance || !finance.estimates?.length) {
    return (
      <div className="w-full min-h-[400px] flex flex-col items-center justify-center border border-slate-200">
        <FileText className="text-slate-200 mb-4" size={48} />
        <h3 className="text-slate-900 font-semibold uppercase tracking-widest text-xs">
          No Financial Data
        </h3>
        <button
          onClick={() => navigate(`/projects/${projectId}/quotes/new`)}
          className="mt-6 px-6 py-2 bg-slate-900 text-white text-[10px] font-bold transition-all"
        >
          CREATE ESTIMATE
        </button>
      </div>
    );
  }

  const { subtotal = 0, gstAmount = 0, grandTotal = 0 } = finance?.totals || {};
  const activeEstimates =
    finance?.estimates?.filter((e) => e.includedInBudget) || [];

  return (
    <div className="w-full space-y-4 pb-20 px-5 py-3 select-none overflow-x-hidden">
      <ToastContainer
        position="bottom-right"
        theme="dark"
        hideProgressBar
        autoClose={1500}
      />

      <style>
        {`
          
          .dragging-active { cursor: grabbing !important; }
          body { font-family: 'Inter', sans-serif; }
        `}
      </style>

      {/* --- SHARP SLIM HEADER --- */}
      <div className="bg-slate-900 text-white p-5 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-10">
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider block mb-0.5">
              Net Amount
            </span>
            <p className="text-lg font-semibold tracking-tight">
              ₹{subtotal.toLocaleString("en-IN")}
            </p>
          </div>

          {finance.gstEnabled && (
            <div>
              <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider block mb-0.5">
                Tax (GST)
              </span>
              <p className="text-lg font-semibold text-indigo-400">
                ₹{gstAmount.toLocaleString("en-IN")}
              </p>
            </div>
          )}

          <div className="hidden md:block w-px h-8 bg-slate-800"></div>

          <div>
            <span className="text-[9px] font-medium text-indigo-500 uppercase tracking-widest block mb-0.5">
              Grand Total
            </span>
            <p className="text-2xl font-bold leading-none">
              ₹{grandTotal.toLocaleString("en-IN")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleGst}
            disabled={isTogglingGst}
            className={`px-4 py-2 text-[10px] font-semibold transition-all border ${
              finance.gstEnabled
                ? "bg-indigo-600 border-indigo-500 text-white"
                : "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"
            }`}
          >
            {finance.gstEnabled ? "TAX ON" : "TAX OFF"}
          </button>

          <button
            onClick={handleSyncEstimates}
            disabled={isSyncing}
            className="p-2 bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
          </button>

          <button
            onClick={() => navigate(`/projects/${projectId}/quotes/new`)}
            className="flex items-center gap-2 px-5 py-2 bg-white text-slate-900 text-[10px] font-bold border border-white hover:bg-slate-100"
          >
            <Plus size={14} />
            ADD ITEM
          </button>
        </div>
      </div>

      {/* --- INVENTORY TABLE --- */}
      <div className="bg-white border border-slate-200 shadow-sm relative">
        <div className="overflow-x-auto">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[
              restrictToVerticalAxis,
              restrictToFirstScrollableAncestor,
            ]}
          >
            <SortableContext
              items={finance.estimates.map((e) => e.estimateId)}
              strategy={verticalListSortingStrategy}
            >
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="w-10"></th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Document
                    </th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
                      Security
                    </th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
                      Last Updated
                    </th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">
                      Value (₹)
                    </th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
                      Status
                    </th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {finance.estimates.map((est) => (
                    <SortableRow key={est.estimateId} est={est}>
                      <td className="px-6 py-4">
                        <div className="flex flex-col cursor-pointer"
                          onClick={() => navigate(`/projects/${projectId}/quotes/${est.estimateId}`)}>
                          <span className="text-sm font-semibold text-slate-800 hover:text-indigo-600 transition-colors">
                            {est.estimateName || "Untitled"}
                          </span>
                          <span className="text-[9px] text-slate-400 uppercase font-bold">
                            Ref: {est.estimateId.slice(-6)}
                          </span>
                        </div>
                      </td>

                      {/* LOCK STATUS */}
                      <td className="px-6 py-4 text-center">
                        <div
                          className={`inline-flex items-center gap-1.5 px-2 py-1 text-[9px] font-bold uppercase border ${
                            est.isLocked
                              ? "text-amber-600 bg-amber-50 border-amber-100"
                              : "text-slate-400 bg-slate-50 border-slate-100"
                          }`}
                        >
                          {est.isLocked ? (
                            <Lock size={10} />
                          ) : (
                            <Unlock size={10} />
                          )}
                          {est.isLocked ? "Locked" : "Open"}
                        </div>
                      </td>

                      {/* LAST UPDATED */}
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 text-slate-500">
                          <Clock size={10} className="text-slate-300" />
                          <span className="text-[10px] font-medium">
                            {est.lastUpdatedAt
                              ? new Date(est.lastUpdatedAt).toLocaleDateString(
                                  "en-IN",
                                  {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  },
                                )
                              : "N/A"}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-semibold text-slate-900 tracking-tight">
                          {est.subtotal?.toLocaleString("en-IN")}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={(e) =>
                            handleToggleEstimate(est.estimateId, e)
                          }
                          disabled={updatingEstimateId === est.estimateId}
                          className={`min-w-[85px] py-1.5 text-[9px] font-bold tracking-wider transition-all border ${
                            est.includedInBudget
                              ? "bg-slate-900 text-white border-slate-900"
                              : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"
                          } disabled:opacity-50`}
                        >
                          {updatingEstimateId === est.estimateId ? (
                            <Loader2
                              size={10}
                              className="animate-spin mx-auto"
                            />
                          ) : est.includedInBudget ? (
                            "SELECTED"
                          ) : (
                            "EXCLUDED"
                          )}
                        </button>
                      </td>

                      <td className="px-6 py-4 text-right pr-6">
                        <button
                          onClick={() =>
                            navigate(
                              `/projects/${projectId}/quotes/${est.estimateId}`,
                            )
                          }
                          className="text-slate-300 hover:text-slate-900 transition-colors"
                        >
                          <ChevronRight size={18} />
                        </button>
                      </td>
                    </SortableRow>
                  ))}
                </tbody>
              </table>
            </SortableContext>
          </DndContext>
        </div>
      </div>

      {/* --- PREVIEW SECTION --- */}
      {activeEstimates.length > 0 && (
        <section className="pt-8 mt-4 border-t border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <Layers size={14} className="text-slate-400" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em]">
              Financial Synthesis Output
            </span>
          </div>
          <div className="border border-slate-200 bg-white">
            <PreviewFinance
              projectId={projectId}
              refreshKey={previewRefreshKey} // ✅ ADD
            />
          </div>
        </section>
      )}
    </div>
  );
};

export default Finance;
